import { normalize, skillsDoTexto } from "../tailor/ats.js";

/**
 * Converte o TEXTO cru extraido de um PDF de curriculo num markdown no formato de
 * `perfil-candidato-modelo.md`. Alem de nome/e-mail/telefone/LinkedIn, tambem:
 *  - detecta o CARGO/headline (texto apos o nome, ate o primeiro "|");
 *  - extrai as COMPETENCIAS tecnicas conhecidas mencionadas no texto (o que o ATS usa);
 *  - preserva TODO o texto na secao livre.
 * Funciona tanto com texto em linhas quanto com texto corrido (pdf.js junta tudo).
 * Nao inventa dado — so reconhece o que esta escrito.
 */

const PAPEL = new Set(
  [
    "desenvolvedor", "desenvolvedora", "engenheiro", "engenheira", "analista", "arquiteto", "arquiteta",
    "programador", "programadora", "software", "full", "stack", "fullstack", "full-stack", "dev", "developer",
    "tech", "lead", "senior", "pleno", "junior", "especialista", "consultor", "consultora", "resumo",
    "curriculum", "curriculo", "vitae", "profissional", "engineer",
  ].map(normalize),
);

function detectarNome(texto: string): string {
  const toks = texto.trim().split(/\s+/);
  const nome: string[] = [];
  for (const t of toks) {
    const limpo = t.replace(/[|,.;:]+$/, "");
    if (/^[A-ZÀ-Ý][A-Za-zÀ-ÿ'’-]+$/.test(limpo) && !PAPEL.has(normalize(limpo))) {
      nome.push(limpo);
      if (nome.length >= 5) break;
    } else break;
  }
  return nome.length >= 2 ? nome.join(" ") : "";
}

function detectarCargo(texto: string, nome: string): string {
  const base = texto.trim();
  const resto = (nome && base.startsWith(nome) ? base.slice(nome.length) : base).trim();
  let cargo = (resto.split(/[|\n]/)[0] ?? "").trim();
  if (cargo.length > 60 || /@|\d{4}/.test(cargo)) cargo = (cargo.split(/\s{2,}/)[0] ?? "").trim();
  return cargo.length > 60 ? "" : cargo;
}

export function pdfTextToDadosMd(texto: string): string {
  const nome = detectarNome(texto);
  const cargo = detectarCargo(texto, nome);
  const email = texto.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? "";
  const linkedin = texto.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s|,)]+/i)?.[0] ?? "";
  const telefone = texto.match(/\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}/)?.[0]?.trim() ?? "";
  const skills = skillsDoTexto(texto);

  return `# Perfil do Candidato

## 1. Identificacao
- **Nome completo:** ${nome}
- **E-mail:** ${email}
- **Telefone / WhatsApp:** ${telefone}
- **LinkedIn:** ${linkedin}

## 2. Objetivo profissional
- **Cargo(s) que busca:** ${cargo}

## 6. Competencias
- **Tecnicas (com nivel, se souber):** ${skills.join(", ")}

## 11. Qualquer outra coisa
${texto.trim()}
`;
}
