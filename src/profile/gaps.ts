import type { Profile } from "./schema.js";

/** Uma lacuna do perfil: campo faltante + a pergunta a fazer na entrevista guiada (§4). */
export interface Gap {
  campo: string;
  pergunta: string;
}

interface EssentialScalar {
  campo: string;
  pergunta: string;
  valor: (p: Profile) => string | null;
}

const ESSENCIAIS_ESCALARES: EssentialScalar[] = [
  { campo: "identificacao.nome", pergunta: "Qual e o seu nome completo?", valor: (p) => p.identificacao.nome },
  { campo: "identificacao.email", pergunta: "Qual e o seu e-mail de contato?", valor: (p) => p.identificacao.email },
  { campo: "identificacao.telefone", pergunta: "Qual e o seu telefone/WhatsApp?", valor: (p) => p.identificacao.telefone },
  { campo: "identificacao.cidade", pergunta: "Em qual cidade voce mora?", valor: (p) => p.identificacao.cidade },
  { campo: "objetivo.cargoAlvo", pergunta: "Qual cargo voce esta buscando?", valor: (p) => p.objetivo.cargoAlvo },
  {
    campo: "preferencias.pretensaoSalarial",
    pergunta: "Qual e a sua pretensao salarial?",
    valor: (p) => p.preferencias.pretensaoSalarial ?? p.dadosCadastro.pretensaoSalarial,
  },
];

/** Lacunas de campos essenciais do perfil, para conduzir a entrevista guiada. */
export function detectGaps(p: Profile): Gap[] {
  const gaps: Gap[] = [];
  for (const e of ESSENCIAIS_ESCALARES) {
    if (!e.valor(p)) gaps.push({ campo: e.campo, pergunta: e.pergunta });
  }
  if (p.experiencias.length === 0) {
    gaps.push({ campo: "experiencias", pergunta: "Conte pelo menos uma experiencia profissional (empresa, cargo, o que fazia, resultados)." });
  }
  if (p.competencias.tecnicas.length === 0) {
    gaps.push({ campo: "competencias.tecnicas", pergunta: "Quais sao suas principais competencias tecnicas?" });
  }
  return gaps;
}

function coalesce<T>(base: T | null, incoming: T | null): T | null {
  return base != null && base !== ("" as unknown as T) ? base : incoming;
}

function mergeList<T>(base: T[], incoming: T[]): T[] {
  const seen = new Set(base.map((x) => JSON.stringify(x)));
  const out = [...base];
  for (const item of incoming) {
    const key = JSON.stringify(item);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

/**
 * Combina duas fontes de perfil. Escalares: o valor ja presente no `base` vence;
 * o `incoming` so preenche nulos/vazios. Listas: concatena e de-duplica.
 * Usado para juntar PDF + LinkedIn + .md de dados sem perder informacao.
 */
export function mergeProfiles(base: Profile, incoming: Profile): Profile {
  return {
    identificacao: {
      nome: coalesce(base.identificacao.nome, incoming.identificacao.nome),
      email: coalesce(base.identificacao.email, incoming.identificacao.email),
      telefone: coalesce(base.identificacao.telefone, incoming.identificacao.telefone),
      cidade: coalesce(base.identificacao.cidade, incoming.identificacao.cidade),
      uf: coalesce(base.identificacao.uf, incoming.identificacao.uf),
      aceitaMudar: base.identificacao.aceitaMudar ?? incoming.identificacao.aceitaMudar,
      links: {
        linkedin: coalesce(base.identificacao.links.linkedin, incoming.identificacao.links.linkedin),
        github: coalesce(base.identificacao.links.github, incoming.identificacao.links.github),
        portfolio: coalesce(base.identificacao.links.portfolio, incoming.identificacao.links.portfolio),
        outros: mergeList(base.identificacao.links.outros, incoming.identificacao.links.outros),
      },
    },
    objetivo: {
      cargoAlvo: coalesce(base.objetivo.cargoAlvo, incoming.objetivo.cargoAlvo),
      senioridade: coalesce(base.objetivo.senioridade, incoming.objetivo.senioridade),
      resumo: coalesce(base.objetivo.resumo, incoming.objetivo.resumo),
    },
    preferencias: {
      pretensaoSalarial: coalesce(base.preferencias.pretensaoSalarial, incoming.preferencias.pretensaoSalarial),
      modeloTrabalho: coalesce(base.preferencias.modeloTrabalho, incoming.preferencias.modeloTrabalho),
      localidades: mergeList(base.preferencias.localidades, incoming.preferencias.localidades),
      tipoContrato: mergeList(base.preferencias.tipoContrato, incoming.preferencias.tipoContrato),
      cargosInteresse: mergeList(base.preferencias.cargosInteresse, incoming.preferencias.cargosInteresse),
      empresasEvitar: mergeList(base.preferencias.empresasEvitar, incoming.preferencias.empresasEvitar),
    },
    experiencias: mergeList(base.experiencias, incoming.experiencias),
    formacoes: mergeList(base.formacoes, incoming.formacoes),
    competencias: {
      tecnicas: mergeList(base.competencias.tecnicas, incoming.competencias.tecnicas),
      ferramentas: mergeList(base.competencias.ferramentas, incoming.competencias.ferramentas),
      softSkills: mergeList(base.competencias.softSkills, incoming.competencias.softSkills),
    },
    idiomas: mergeList(base.idiomas, incoming.idiomas),
    certificacoes: mergeList(base.certificacoes, incoming.certificacoes),
    projetos: mergeList(base.projetos, incoming.projetos),
    dadosCadastro: {
      pcd: base.dadosCadastro.pcd ?? incoming.dadosCadastro.pcd,
      pretensaoSalarial: coalesce(base.dadosCadastro.pretensaoSalarial, incoming.dadosCadastro.pretensaoSalarial),
      viagens: base.dadosCadastro.viagens ?? incoming.dadosCadastro.viagens,
      autorizacaoTrabalho: coalesce(base.dadosCadastro.autorizacaoTrabalho, incoming.dadosCadastro.autorizacaoTrabalho),
      cnh: coalesce(base.dadosCadastro.cnh, incoming.dadosCadastro.cnh),
    },
    extras: coalesce(base.extras, incoming.extras),
  };
}
