import type { Profile } from "../profile/schema.js";
import type { VagaResumo } from "../connectors/types.js";
import { analyzeGap } from "../tailor/ats.js";
import { filtrarBloqueadas } from "./filtros.js";

export interface VagaRankeada {
  vaga: VagaResumo;
  score: number;
  matched: string[];
  missing: string[];
}

export interface RankOptions {
  /** Coloca vagas com menos de `limiteCandidatos` candidatos primeiro (regra do LinkedIn). */
  priorizarPoucosCandidatos?: boolean;
  /** Limite de candidatos para a prioridade acima (default 100). */
  limiteCandidatos?: number;
}

/**
 * Ranqueia vagas por aderencia ao perfil (§5). Usa o mesmo gap-analysis do ATS
 * sobre titulo + snippet da vaga. SEMPRE remove empresas bloqueadas (ex.: BairesDev).
 * Com `priorizarPoucosCandidatos`, vagas abaixo do limite de candidatos vem primeiro,
 * e so depois desempata pela aderencia.
 */
export function rankVagas(profile: Profile, vagas: VagaResumo[], opts: RankOptions = {}): VagaRankeada[] {
  const limite = opts.limiteCandidatos ?? 100;
  const ranked = filtrarBloqueadas(vagas).map((vaga) => {
    const gap = analyzeGap(profile, `${vaga.titulo}. ${vaga.snippet}`);
    return { vaga, score: gap.score, matched: gap.matched, missing: gap.missing };
  });

  return ranked.sort((a, b) => {
    if (opts.priorizarPoucosCandidatos) {
      const pa = a.vaga.candidatos != null && a.vaga.candidatos < limite ? 0 : 1;
      const pb = b.vaga.candidatos != null && b.vaga.candidatos < limite ? 0 : 1;
      if (pa !== pb) return pa - pb;
    }
    return b.score - a.score;
  });
}
