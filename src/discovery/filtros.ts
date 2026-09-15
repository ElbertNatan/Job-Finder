import type { VagaResumo } from "../connectors/types.js";
import { normalize } from "../tailor/ats.js";

/**
 * Empresas a ignorar em qualquer site (§5 do plano). Comparacao por substring
 * normalizada, entao "BairesDev", "bairesdev LLC" etc. sao todos bloqueados.
 */
export const EMPRESAS_BLOQUEADAS = ["bairesdev"];

export function filtrarBloqueadas(vagas: VagaResumo[]): VagaResumo[] {
  return vagas.filter((v) => {
    const emp = normalize(v.empresa);
    return !EMPRESAS_BLOQUEADAS.some((b) => emp.includes(b));
  });
}
