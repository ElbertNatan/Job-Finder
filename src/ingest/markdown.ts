import { parseProfile, type Profile } from "../profile/schema.js";

/**
 * Ingestao deterministica do `.md` de dados brutos do candidato (§4 do plano).
 * Le o markdown no formato de `perfil-candidato-modelo.md`, extrai os campos e
 * devolve um Profile valido. NUNCA inventa dado: campo vazio vira null / lista vazia.
 *
 * Para .md em texto livre (fora do modelo), o normalizador por LLM entra como
 * adapter em src/ingest/llmNormalizer.ts (a implementar) — este parser cobre o
 * caminho estruturado e testavel offline.
 */

function strip(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function valOrNull(v: string | undefined | null): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t.length ? t : null;
}

function splitList(v: string | null, sep: RegExp = /,/): string[] {
  if (!v) return [];
  return v
    .split(sep)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parseBool(v: string | null): boolean | null {
  if (!v) return null;
  const t = strip(v);
  if (["sim", "s", "true", "yes"].includes(t)) return true;
  if (["nao", "n", "false", "no"].includes(t)) return false;
  return null;
}

const DASH = /\s+[-–—]\s+/;

interface Field {
  norm: string;
  value: string;
}

function parseFields(block: string): Field[] {
  const fields: Field[] = [];
  for (const line of block.split(/\r?\n/)) {
    const m = line.match(/^\s*[-*]\s*\*\*(.+?)\*\*\s*[:：]?\s*(.*)$/);
    if (!m) continue;
    const label = (m[1] ?? "").replace(/[:：?]+\s*$/, "").trim();
    fields.push({ norm: strip(label), value: (m[2] ?? "").trim() });
  }
  return fields;
}

/** valor do primeiro campo cujo label normalizado contem algum dos keywords. */
function get(fields: Field[], ...keywords: string[]): string | null {
  for (const kw of keywords) {
    const f = fields.find((x) => x.norm.includes(kw));
    if (f) return valOrNull(f.value);
  }
  return null;
}

/** todos os valores nao-vazios cujos labels contem o keyword (para campos repetidos). */
function getAll(fields: Field[], keyword: string): string[] {
  return fields.filter((x) => x.norm.includes(keyword)).map((x) => x.value.trim()).filter((v) => v.length > 0);
}

interface Section {
  norm: string;
  body: string;
}

function splitSections(md: string): Section[] {
  const sections: Section[] = [];
  let current: { norm: string; lines: string[] } | null = null;
  for (const line of md.split(/\r?\n/)) {
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) {
      if (current) sections.push({ norm: current.norm, body: current.lines.join("\n") });
      current = { norm: strip(h[1] ?? ""), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push({ norm: current.norm, body: current.lines.join("\n") });
  return sections;
}

/** divide o corpo de uma secao em subblocos por "### ". */
function splitSubblocks(body: string): string[] {
  const blocks: string[] = [];
  let buf: string[] | null = null;
  for (const line of body.split(/\r?\n/)) {
    if (/^###\s+/.test(line)) {
      if (buf) blocks.push(buf.join("\n"));
      buf = [];
    } else if (buf) {
      buf.push(line);
    }
  }
  if (buf) blocks.push(buf.join("\n"));
  return blocks;
}

function period(f: Field[]): { inicio: string | null; fim: string | null } {
  const per = get(f, "periodo");
  if (!per) return { inicio: null, fim: null };
  const parts = per.split(DASH);
  return { inicio: valOrNull(parts[0]), fim: valOrNull(parts[1]) };
}

export function ingestMarkdown(md: string): Profile {
  const raw: Record<string, unknown> = {};

  for (const sec of splitSections(md)) {
    const f = parseFields(sec.body);

    if (sec.norm.includes("identificacao")) {
      const cidadeUf = get(f, "cidade");
      let cidade: string | null = cidadeUf;
      let uf: string | null = null;
      if (cidadeUf && cidadeUf.includes("/")) {
        const [c, u] = cidadeUf.split("/");
        cidade = valOrNull(c);
        uf = valOrNull(u);
      }
      raw["identificacao"] = {
        nome: get(f, "nome"),
        email: get(f, "mail"),
        telefone: get(f, "telefone", "whatsapp"),
        cidade,
        uf,
        aceitaMudar: parseBool(get(f, "mudar")),
        links: {
          linkedin: get(f, "linkedin"),
          github: get(f, "github"),
          portfolio: get(f, "portfolio", "site"),
          outros: splitList(get(f, "outros")),
        },
      };
    } else if (sec.norm.includes("objetivo")) {
      raw["objetivo"] = {
        cargoAlvo: get(f, "cargo"),
        senioridade: get(f, "senioridade"),
        resumo: get(f, "resumo"),
      };
    } else if (sec.norm.includes("preferencia")) {
      raw["preferencias"] = {
        pretensaoSalarial: get(f, "salarial", "faixa"),
        modeloTrabalho: get(f, "modelo"),
        localidades: splitList(get(f, "localidades")),
        tipoContrato: splitList(get(f, "contrato")),
        cargosInteresse: splitList(get(f, "cargos")),
        empresasEvitar: splitList(get(f, "evitar")),
      };
    } else if (sec.norm.includes("experiencia")) {
      const exps = [];
      for (const block of splitSubblocks(sec.body)) {
        const bf = parseFields(block);
        const empresa = get(bf, "empresa");
        const cargo = get(bf, "cargo");
        if (!empresa && !cargo) continue;
        const { inicio, fim } = period(bf);
        exps.push({
          empresa: empresa ?? "",
          cargo: cargo ?? "",
          inicio,
          fim,
          local: get(bf, "local"),
          modelo: get(bf, "modelo"),
          descricao: get(bf, "fazia", "descricao", "atividades"),
          conquistas: splitList(get(bf, "conquistas", "resultados"), /;|\n/),
          tecnologias: splitList(get(bf, "tecnologias", "ferramentas")),
        });
      }
      if (exps.length) raw["experiencias"] = exps;
    } else if (sec.norm.includes("formacao")) {
      const fs = [];
      for (const block of splitSubblocks(sec.body)) {
        const bf = parseFields(block);
        const curso = get(bf, "curso");
        if (!curso) continue;
        const { inicio, fim } = period(bf);
        fs.push({ curso, instituicao: get(bf, "instituicao"), inicio, fim, status: get(bf, "status") });
      }
      if (fs.length) raw["formacoes"] = fs;
    } else if (sec.norm.includes("competencia")) {
      raw["competencias"] = {
        tecnicas: splitList(get(f, "tecnicas")).map((nome) => ({ nome, nivel: null })),
        ferramentas: splitList(get(f, "ferramentas", "plataformas")),
        softSkills: splitList(get(f, "soft")),
      };
    } else if (sec.norm.includes("idioma")) {
      const idiomas = getAll(f, "idioma").map((v) => {
        const [idioma, nivel] = v.split(DASH);
        return { idioma: (idioma ?? v).trim(), nivel: valOrNull(nivel) };
      });
      if (idiomas.length) raw["idiomas"] = idiomas;
    } else if (sec.norm.includes("certificac")) {
      const certs = getAll(f, "certificac")
        .map((v) => {
          const [nome, instituicao, ano] = v.split(DASH);
          return { nome: (nome ?? v).trim(), instituicao: valOrNull(instituicao), ano: valOrNull(ano) };
        })
        .filter((c) => c.nome.length > 0);
      if (certs.length) raw["certificacoes"] = certs;
    } else if (sec.norm.includes("projeto")) {
      const projs = [];
      for (const block of splitSubblocks(sec.body)) {
        const bf = parseFields(block);
        const nome = get(bf, "nome");
        if (!nome) continue;
        projs.push({ nome, descricao: get(bf, "descricao"), stack: splitList(get(bf, "stack")), link: get(bf, "link") });
      }
      if (projs.length) raw["projetos"] = projs;
    } else if (sec.norm.includes("formulario") || sec.norm.includes("dados para")) {
      raw["dadosCadastro"] = {
        pcd: parseBool(get(f, "pcd")),
        pretensaoSalarial: get(f, "pretensao", "salarial"),
        viagens: parseBool(get(f, "viagens")),
        autorizacaoTrabalho: get(f, "autorizacao", "visto"),
        cnh: get(f, "cnh"),
      };
    } else if (sec.norm.includes("outra coisa") || sec.norm.includes("extra")) {
      const text = sec.body
        .split(/\r?\n/)
        .map((l) => l.replace(/^\s*>\s?/, "").trim())
        .filter((l) => l.length > 0)
        .join("\n");
      raw["extras"] = text.length ? text : null;
    }
  }

  return parseProfile(raw);
}
