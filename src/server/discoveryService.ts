import type { Profile } from "../profile/schema.js";
import type { Criterios, VagaDetalhe, VagaResumo } from "../connectors/types.js";
import { rankVagas, type VagaRankeada } from "../discovery/rank.js";

/**
 * Servico de descoberta: e O AGENTE quem sai buscando as vagas. A UI so pede
 * (site + cargo); aqui buscamos no conector e ranqueamos pelo perfil, ja aplicando
 * as regras do projeto (BairesDev fora; no LinkedIn, < 100 candidatos primeiro).
 * O usuario NAO precisa colar descricao de vaga.
 */
export interface ConectorHandle {
  priorizarPoucosCandidatos: boolean;
  buscar(criterios: Criterios): Promise<VagaResumo[]>;
  detalhar(vaga: VagaResumo): Promise<VagaDetalhe>;
  fechar?(): Promise<void>;
}

export type GetConector = (site: string) => ConectorHandle;

export class DiscoveryService {
  constructor(private readonly getConector: GetConector) {}

  async buscar(profile: Profile, input: { site: string; cargo: string; localidade?: string }): Promise<VagaRankeada[]> {
    const c = this.getConector(input.site);
    const vagas = await c.buscar({ cargo: input.cargo, localidade: input.localidade, remoto: true });
    return rankVagas(profile, vagas, { priorizarPoucosCandidatos: c.priorizarPoucosCandidatos });
  }

  async detalhar(input: { site: string; link: string }): Promise<{ descricao: string }> {
    const c = this.getConector(input.site);
    const vaga: VagaResumo = { id: input.link, titulo: "", empresa: "", local: "", link: input.link, snippet: "" };
    const d = await c.detalhar(vaga);
    return { descricao: d.descricao };
  }
}
