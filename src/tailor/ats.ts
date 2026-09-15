import type { Profile } from "../profile/schema.js";

/**
 * Nucleo de adequacao ATS (§6 do plano): gap-analysis entre a descricao da vaga
 * e o perfil, score de aderencia e reordenacao que DESTACA dados verdadeiros —
 * nunca inventa competencia que o candidato nao tem.
 *
 * Deterministico e testavel offline. O enriquecimento por LLM (reescrever bullets,
 * gerar resumo sob medida) entra como adapter opcional em src/tailor/llmTailor.ts.
 */

const DEFAULT_VOCAB = [
  "Node.js", "TypeScript", "JavaScript", "Python", "Java", "Kotlin", "Go", "Rust", "C#", "C++", "PHP", "Ruby",
  "React", "Vue", "Angular", "Svelte", "Next.js", "Spring", "Django", "Flask", "Grails", "Rails", "Laravel",
  "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform",
  "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "Kafka", "RabbitMQ", "Elasticsearch",
  "Git", "REST", "GraphQL", "gRPC", "Linux", "CI/CD", "Scrum", "Agile", "Kanban",
];

export function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Termos do vocabulario presentes no texto (case/acento-insensitive, com fronteira de palavra). */
export function extractKeywords(text: string, vocab: string[]): string[] {
  const hay = normalize(text);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const term of vocab) {
    const n = normalize(term);
    if (seen.has(n)) continue;
    const re = new RegExp(`(?<![a-z0-9+#])${escapeRegExp(n)}(?![a-z0-9+#])`, "i");
    if (re.test(hay)) {
      out.push(term);
      seen.add(n);
    }
  }
  return out;
}

/** Conjunto de competencias reais do candidato (tecnicas, ferramentas, tecnologias de experiencias e stacks de projetos). */
export function candidateSkills(p: Profile): string[] {
  const all = [
    ...p.competencias.tecnicas.map((t) => t.nome),
    ...p.competencias.ferramentas,
    ...p.experiencias.flatMap((e) => e.tecnologias),
    ...p.projetos.flatMap((pr) => pr.stack),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of all) {
    const n = normalize(s);
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(s);
    }
  }
  return out;
}

export interface GapAnalysis {
  jobKeywords: string[];
  matched: string[];
  missing: string[];
  score: number; // 0..100
}

/** Compara a vaga com o perfil e devolve match/gap + score ATS. */
export function analyzeGap(p: Profile, jobText: string, extraVocab: string[] = []): GapAnalysis {
  const vocab = [...DEFAULT_VOCAB, ...candidateSkills(p), ...extraVocab];
  const jobKeywords = extractKeywords(jobText, vocab);
  const candSet = new Set(candidateSkills(p).map(normalize));
  const matched = jobKeywords.filter((k) => candSet.has(normalize(k)));
  const missing = jobKeywords.filter((k) => !candSet.has(normalize(k)));
  const score = jobKeywords.length === 0 ? 0 : Math.round((matched.length / jobKeywords.length) * 100);
  return { jobKeywords, matched, missing, score };
}

export interface TailoredResume {
  profile: Profile;
  matched: string[];
  missing: string[];
  score: number;
  ajustes: string[];
}

/**
 * Gera a versao adaptada do curriculo para uma vaga: reordena competencias e
 * experiencias para destacar o que casa com a vaga, e lista os ajustes/recomendacoes.
 * Nunca adiciona uma competencia ausente — apenas recomenda incluir se for verdade.
 */
export function tailorResume(p: Profile, jobText: string, extraVocab: string[] = []): TailoredResume {
  const gap = analyzeGap(p, jobText, extraVocab);
  const matchedSet = new Set(gap.matched.map(normalize));

  const isMatch = (name: string) => matchedSet.has(normalize(name));
  const bump = <T>(arr: T[], key: (x: T) => boolean): T[] => [...arr.filter(key), ...arr.filter((x) => !key(x))];

  const tecnicas = bump(p.competencias.tecnicas, (t) => isMatch(t.nome));
  const experiencias = bump(p.experiencias, (e) => e.tecnologias.some(isMatch));

  const profile: Profile = {
    ...p,
    competencias: { ...p.competencias, tecnicas },
    experiencias,
  };

  const ajustes: string[] = [];
  ajustes.push(`Score ATS estimado: ${gap.score}% (${gap.matched.length}/${gap.jobKeywords.length} palavras-chave da vaga).`);
  if (gap.matched.length) {
    ajustes.push(`Competencias/experiencias reordenadas para destacar: ${gap.matched.join(", ")}.`);
  }
  if (gap.missing.length) {
    ajustes.push(
      `Palavras-chave da vaga ausentes no seu perfil: ${gap.missing.join(", ")}. ` +
        `Inclua no curriculo apenas se voce realmente tiver essa experiencia — o agente nao inventa dados por voce.`,
    );
  }
  return { profile, matched: gap.matched, missing: gap.missing, score: gap.score, ajustes };
}
