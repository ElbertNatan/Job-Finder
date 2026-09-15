import type { ApplyResult, Artefatos, CampoFormulario, Criterios, JobConnector, VagaDetalhe, VagaResumo } from "./types.js";
import { filtrarBloqueadas } from "../discovery/filtros.js";
import { parseCandidatos } from "./linkedin/parseCandidatos.js";
import { preencherFormulario } from "./linkedin/easyApply.js";

/** Card cru extraido da pagina de resultados de um site (antes de normalizar). */
export interface RawCard {
  titulo: string;
  empresa: string;
  local: string;
  link: string;
  /** texto de candidatos, quando o site expoe (ex.: LinkedIn). "" se nao houver. */
  candidatosTexto?: string;
}

/**
 * Faz o trabalho de navegador de UM site (Playwright/computer-use). Abstraido para
 * a logica do conector ser testavel com um driver fake. `extrairCampos` e
 * `preencherAteRevisao` sao opcionais: sites com candidatura no proprio site
 * (Easy Apply) os implementam; os demais so preparam ate o gate.
 */
export interface SiteDriver {
  buscarCards(criterios: Criterios): Promise<RawCard[]>;
  detalhe(link: string): Promise<{ descricao: string }>;
  extrairCampos?(link: string): Promise<CampoFormulario[]>;
  preencherAteRevisao?(link: string, respostas: Record<string, string>): Promise<void>;
  /** Diz se o usuario ja esta logado no site (sites que exigem login). */
  estaLogado?(): Promise<boolean>;
  /** Abre o navegador na tela de login para o usuario entrar. */
  abrirParaLogin?(): Promise<void>;
  close?(): Promise<void>;
}

export interface BrowserConnectorOptions {
  /** Prioriza vagas com poucos candidatos (regra do LinkedIn). Informa o consumidor do rank. */
  priorizarPoucosCandidatos?: boolean;
  /** Site exige login para buscar (ex.: LinkedIn). */
  requerLogin?: boolean;
}

/**
 * Conector generico baseado em navegador, reutilizado por todos os sites. Embute as
 * regras do projeto: bloqueio de empresas (BairesDev), parse do nº de candidatos,
 * preenchimento de formulario (Easy Apply) e GATE HUMANO — nunca submete sozinho.
 * Um site novo = um SiteDriver (ou uma config de driver), sem reescrever isto.
 */
export class BrowserConnector implements JobConnector {
  constructor(
    public readonly site: string,
    protected readonly driver: SiteDriver,
    public readonly options: BrowserConnectorOptions = {},
  ) {}

  async buscar(criterios: Criterios): Promise<VagaResumo[]> {
    const cards = await this.driver.buscarCards(criterios);
    const vagas: VagaResumo[] = cards.map((c, i) => ({
      id: c.link || `${this.site.toLowerCase()}-${i}`,
      titulo: c.titulo,
      empresa: c.empresa,
      local: c.local,
      link: c.link,
      snippet: "",
      candidatos: parseCandidatos(c.candidatosTexto ?? ""),
    }));
    return filtrarBloqueadas(vagas);
  }

  async detalhar(vaga: VagaResumo): Promise<VagaDetalhe> {
    const { descricao } = await this.driver.detalhe(vaga.link);
    return { ...vaga, descricao, snippet: vaga.snippet || descricao.slice(0, 200), campos: [] };
  }

  async candidatar(vaga: VagaDetalhe, artefatos: Artefatos): Promise<ApplyResult> {
    // Sem preenchimento no site: prepara e devolve para o gate humano.
    if (!this.driver.extrairCampos) {
      return this.gate(`Candidatura no ${this.site} preparada. Revise no preview e submeta com sua confirmacao.`);
    }

    const campos = await this.driver.extrairCampos(vaga.link);
    const { respostas, faltantes } = preencherFormulario(campos, {
      curriculoArquivo: artefatos.curriculoArquivo,
      carta: artefatos.carta,
      respostas: artefatos.respostas,
      dadosBasicos: artefatos.dadosBasicos,
    });

    if (faltantes.length > 0) {
      return {
        status: "aguardando_aprovacao",
        precisaHumano: true,
        camposFaltantes: faltantes,
        mensagem: `Faltam dados para completar a candidatura no ${this.site}: ${faltantes.map((f) => f.label).join(", ")}.`,
      };
    }

    if (this.driver.preencherAteRevisao) {
      await this.driver.preencherAteRevisao(vaga.link, respostas);
    }
    return this.gate(
      `Candidatura no ${this.site} preenchida ate a etapa de revisao. Confirme e submeta voce mesmo ` +
        `(o agente nao clica em "Enviar", e captcha/anti-bot ficam com voce).`,
    );
  }

  private gate(mensagem: string): ApplyResult {
    return { status: "aguardando_aprovacao", precisaHumano: true, mensagem };
  }

  get requerLogin(): boolean {
    return this.options.requerLogin ?? false;
  }

  /** Se o site exige login, diz se o usuario ja esta logado (default: true quando nao aplicavel). */
  async estaLogado(): Promise<boolean> {
    return this.driver.estaLogado ? this.driver.estaLogado() : true;
  }

  /** Abre o navegador na tela de login do site. */
  async abrirParaLogin(): Promise<void> {
    await this.driver.abrirParaLogin?.();
  }

  /** Libera o navegador do driver (se houver). */
  async fechar(): Promise<void> {
    await this.driver.close?.();
  }
}
