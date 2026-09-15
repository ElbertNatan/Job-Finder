/**
 * Interpreta o texto de candidatos que o LinkedIn exibe no card/detalhe da vaga
 * e devolve um numero comparavel para a regra "priorizar < 100 candidatos".
 *
 * - "27 applicants" / "48 candidaturas" / "120 candidatos" -> o numero
 * - "Over 100 applicants" / "Mais de 100 candidatos" -> 100 (fora do bucket < 100)
 * - "Seja um dos primeiros a se candidatar" / "early applicant" (sem numero) -> 0 (poucos)
 * - sem sinal -> null (desconhecido)
 */
export function parseCandidatos(texto: string): number | null {
  const t = texto.toLowerCase();
  const m = t.match(/\d[\d.,]*/);
  if (m) return parseInt(m[0].replace(/[.,]/g, ""), 10);
  if (/primeir|first|early/.test(t)) return 0;
  return null;
}
