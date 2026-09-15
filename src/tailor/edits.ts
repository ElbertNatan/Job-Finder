import type { Profile } from "../profile/schema.js";
import { normalize } from "./ats.js";

/**
 * Edicoes propostas pelo usuario no ciclo de revisao do preview (§6.1 do plano).
 * Sao mudancas estruturais e seguras — ocultar/ajustar o que ja existe. NUNCA
 * adicionam dado inexistente. A reescrita por linguagem livre (via LLM) entra
 * como adapter que traduz o pedido do usuario para este mesmo formato.
 */
export interface ResumeEdits {
  resumo?: string | null;
  cargoAlvo?: string | null;
  ocultarExperiencias?: number[];
  ocultarCompetencias?: string[];
}

export function applyResumeEdits(profile: Profile, edits: ResumeEdits): Profile {
  const ocultarExp = new Set(edits.ocultarExperiencias ?? []);
  const ocultarComp = new Set((edits.ocultarCompetencias ?? []).map(normalize));

  return {
    ...profile,
    objetivo: {
      ...profile.objetivo,
      resumo: edits.resumo !== undefined ? edits.resumo : profile.objetivo.resumo,
      cargoAlvo: edits.cargoAlvo !== undefined ? edits.cargoAlvo : profile.objetivo.cargoAlvo,
    },
    experiencias: profile.experiencias.filter((_, i) => !ocultarExp.has(i)),
    competencias: {
      ...profile.competencias,
      tecnicas: profile.competencias.tecnicas.filter((t) => !ocultarComp.has(normalize(t.nome))),
    },
  };
}
