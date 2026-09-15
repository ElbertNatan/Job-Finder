import { normalize } from "../../tailor/ats.js";
import type { Profile } from "../../profile/schema.js";
import type { CampoFormulario } from "../types.js";

/**
 * Logica PURA de preenchimento do formulario de candidatura (Easy Apply do LinkedIn
 * e formularios de outros sites). Decide, para cada campo, qual resposta usar — a
 * partir dos dados basicos do candidato, do curriculo gerado e de respostas ja
 * fornecidas. O que nao conseguir resolver e obrigatorio vira "faltante" para o humano.
 *
 * Nao toca no navegador: o walk do modal fica no driver. Assim isto e testavel.
 */

export interface DadosBasicos {
  nome?: string | null;
  email?: string | null;
  telefone?: string | null;
  cidade?: string | null;
  linkedin?: string | null;
  pretensaoSalarial?: string | null;
}

export interface PreenchimentoContexto {
  curriculoArquivo: string;
  carta?: string;
  /** respostas ja conhecidas, chaveadas pelo label normalizado do campo (ou pelo nome). */
  respostas: Record<string, string>;
  dadosBasicos?: DadosBasicos;
}

function achaResposta(ctx: PreenchimentoContexto, label: string, nome: string): string | null {
  const n = normalize(label);
  for (const [k, v] of Object.entries(ctx.respostas)) {
    if (normalize(k) === n || k === nome) return v;
  }
  return null;
}

export function resolverCampo(campo: CampoFormulario, ctx: PreenchimentoContexto): string | null {
  const label = normalize(campo.label);
  const d = ctx.dadosBasicos ?? {};

  // arquivo/curriculo
  if (campo.tipo === "arquivo" || /curriculo|resume|\bcv\b/.test(label)) return ctx.curriculoArquivo;
  // dados basicos
  if (/e-?mail/.test(label)) return d.email ?? null;
  if (/telefone|celular|phone|mobile|whatsapp/.test(label)) return d.telefone ?? null;
  if (/nome|name/.test(label)) return d.nome ?? null;
  if (/cidade|localidade|location/.test(label)) return d.cidade ?? null;
  if (/linkedin/.test(label)) return d.linkedin ?? null;
  if (/salario|salary|pretensao|remuneracao/.test(label)) return d.pretensaoSalarial ?? null;

  // respostas fornecidas (perguntas de triagem)
  return achaResposta(ctx, campo.label, campo.nome);
}

export interface Preenchimento {
  respostas: Record<string, string>;
  faltantes: CampoFormulario[];
}

export function preencherFormulario(campos: CampoFormulario[], ctx: PreenchimentoContexto): Preenchimento {
  const respostas: Record<string, string> = {};
  const faltantes: CampoFormulario[] = [];
  for (const campo of campos) {
    const val = resolverCampo(campo, ctx);
    if (val != null && val !== "") {
      respostas[campo.nome] = val;
    } else if (campo.obrigatorio) {
      faltantes.push(campo);
    }
  }
  return { respostas, faltantes };
}

export function dadosBasicosDoPerfil(p: Profile): DadosBasicos {
  return {
    nome: p.identificacao.nome,
    email: p.identificacao.email,
    telefone: p.identificacao.telefone,
    cidade: p.identificacao.cidade,
    linkedin: p.identificacao.links.linkedin,
    pretensaoSalarial: p.preferencias.pretensaoSalarial ?? p.dadosCadastro.pretensaoSalarial,
  };
}
