import { normalize } from "../tailor/ats.js";
import type { ApplyResult, Artefatos, Criterios, JobConnector, VagaDetalhe, VagaResumo } from "./types.js";

/**
 * Conector de exemplo/teste. Nao acessa a internet: serve de referencia para os
 * conectores reais (Gupy/LinkedIn via Playwright) e garante o contrato — em especial
 * que `candidatar` PARA no gate de aprovacao humana e nunca submete sozinho.
 */
export class StubConnector implements JobConnector {
  constructor(
    public readonly site: string,
    private readonly seed: VagaResumo[] = [],
  ) {}

  async buscar(criterios: Criterios): Promise<VagaResumo[]> {
    const termo = normalize(criterios.cargo);
    if (!termo) return [...this.seed];
    return this.seed.filter((v) => normalize(`${v.titulo} ${v.snippet} ${v.empresa}`).includes(termo));
  }

  async detalhar(vaga: VagaResumo): Promise<VagaDetalhe> {
    return { ...vaga, descricao: vaga.snippet, campos: [] };
  }

  async candidatar(_vaga: VagaDetalhe, _artefatos: Artefatos): Promise<ApplyResult> {
    return {
      status: "aguardando_aprovacao",
      precisaHumano: true,
      mensagem: "Candidatura preparada. Aguardando aprovacao humana antes de submeter (gate obrigatorio).",
    };
  }
}
