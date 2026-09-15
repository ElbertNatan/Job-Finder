import type { Profile } from "../profile/schema.js";
import type { VagaResumo } from "../connectors/types.js";
import { analyzeGap } from "../tailor/ats.js";

export interface VagaRankeada {
  vaga: VagaResumo;
  score: number;
  matched: string[];
  missing: string[];
}

/**
 * Ranqueia vagas por aderencia ao perfil (§5). Usa o mesmo gap-analysis do ATS
 * sobre titulo + snippet da vaga. Ordena da maior para a menor aderencia.
 */
export function rankVagas(profile: Profile, vagas: VagaResumo[]): VagaRankeada[] {
  return vagas
    .map((vaga) => {
      const gap = analyzeGap(profile, `${vaga.titulo}. ${vaga.snippet}`);
      return { vaga, score: gap.score, matched: gap.matched, missing: gap.missing };
    })
    .sort((a, b) => b.score - a.score);
}
