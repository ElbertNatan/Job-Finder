import type { ApplyResult, Artefatos, Criterios, JobConnector, VagaDetalhe, VagaResumo } from "../types.js";
import { filtrarBloqueadas } from "../../discovery/filtros.js";
import { parseCandidatos } from "./parseCandidatos.js";

/** Card cru extraido da pagina de resultados do LinkedIn (antes de normalizar). */
export interface RawCard {
  titulo: string;
  empresa: string;
  local: string;
  link: string;
  candidatosTexto: string;
}

/**
 * Faz o trabalho de navegador (Playwright/computer-use). Abstraido para a logica
 * do conector ser testavel com um driver fake, sem tocar no site real.
 */
export interface LinkedInDriver {
  buscarCards(criterios: Criterios): Promise<RawCard[]>;
  detalhe(link: string): Promise<{ descricao: string }>;
}

/**
 * Conector do LinkedIn. A logica (mapeamento, parse de candidatos, bloqueio de
 * empresas, gate humano) e testada; o acesso ao site vive no LinkedInDriver.
 *
 * Regras do projeto ja embutidas:
 * - empresas bloqueadas (BairesDev) sao removidas na origem;
 * - `candidatos` e preenchido para a regra "priorizar < 100 candidatos" (ver rankVagas).
 */
export class LinkedInConnector implements JobConnector {
  readonly site = "LinkedIn";

  constructor(private readonly driver: LinkedInDriver) {}

  async buscar(criterios: Criterios): Promise<VagaResumo[]> {
    const cards = await this.driver.buscarCards(criterios);
    const vagas: VagaResumo[] = cards.map((c, i) => ({
      id: c.link || `linkedin-${i}`,
      titulo: c.titulo,
      empresa: c.empresa,
      local: c.local,
      link: c.link,
      snippet: "",
      candidatos: parseCandidatos(c.candidatosTexto),
    }));
    return filtrarBloqueadas(vagas);
  }

  async detalhar(vaga: VagaResumo): Promise<VagaDetalhe> {
    const { descricao } = await this.driver.detalhe(vaga.link);
    return { ...vaga, descricao, snippet: vaga.snippet || descricao.slice(0, 200), campos: [] };
  }

  async candidatar(_vaga: VagaDetalhe, _artefatos: Artefatos): Promise<ApplyResult> {
    // Gate humano obrigatorio: prepara ate aqui e devolve para aprovacao/submissao manual.
    // A submissao real (clique final) NUNCA e automatica.
    return {
      status: "aguardando_aprovacao",
      precisaHumano: true,
      mensagem:
        "Candidatura no LinkedIn preparada. Revise no preview e submeta com sua confirmacao " +
        "(o agente nao clica em 'Enviar candidatura' sozinho, e captcha/anti-bot ficam com voce).",
    };
  }
}
