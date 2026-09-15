import type { Profile } from "../profile/schema.js";
import type { Criterios, VagaDetalhe, VagaResumo } from "../connectors/types.js";
import { rankVagas, type VagaRankeada } from "../discovery/rank.js";

/**
 * Servico de descoberta: e O AGENTE quem sai buscando as vagas. A UI so pede
 * (site + cargo); aqui buscamos no conector e ranqueamos pelo perfil, ja aplicando
 * as regras do projeto (BairesDev fora; no LinkedIn, < 100 candidatos primeiro).
 *
 * Sites que exigem login: se o usuario ainda nao esta logado, NAO buscamos —
 * devolvemos precisaLogin para a UI pedir o login (a janela do navegador ja abre).
 */
export interface ConectorHandle {
  priorizarPoucosCandidatos: boolean;
  requerLogin?: boolean;
  estaLogado?(): Promise<boolean>;
  abrirParaLogin?(): Promise<void>;
  buscar(criterios: Criterios): Promise<VagaResumo[]>;
  detalhar(vaga: VagaResumo): Promise<VagaDetalhe>;
  fechar?(): Promise<void>;
}

export type GetConector = (site: string) => ConectorHandle;

export interface ResultadoBusca {
  precisaLogin: boolean;
  vagas: VagaRankeada[];
}

export class DiscoveryService {
  constructor(private readonly getConector: GetConector) {}

  async buscar(profile: Profile, input: { site: string; cargo: string; localidade?: string }): Promise<ResultadoBusca> {
    const c = this.getConector(input.site);
    if (c.requerLogin && c.estaLogado && !(await c.estaLogado())) {
      return { precisaLogin: true, vagas: [] };
    }
    const vagas = await c.buscar({ cargo: input.cargo, localidade: input.localidade, remoto: true });
    return { precisaLogin: false, vagas: rankVagas(profile, vagas, { priorizarPoucosCandidatos: c.priorizarPoucosCandidatos }) };
  }

  /** Abre o navegador no site para o usuario fazer login (janela persistente). */
  async login(site: string): Promise<void> {
    await this.getConector(site).abrirParaLogin?.();
  }

  async detalhar(input: { site: string; link: string }): Promise<{ descricao: string }> {
    const c = this.getConector(input.site);
    const vaga: VagaResumo = { id: input.link, titulo: "", empresa: "", local: "", link: input.link, snippet: "" };
    const d = await c.detalhar(vaga);
    return { descricao: d.descricao };
  }
}
