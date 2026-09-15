import { criarConector } from "../connectors/factory.js";
import type { Criterios, VagaDetalhe, VagaResumo } from "../connectors/types.js";
import type { ConectorHandle } from "./discoveryService.js";

/**
 * Vagas de exemplo para o modo "exemplo (offline)": deixam o app demonstravel na
 * hora, sem login nem sites reais. Inclui uma BairesDev de proposito (para mostrar
 * o bloqueio) e contagens variadas de candidatos (para mostrar a priorizacao).
 */
const VAGAS_EXEMPLO: (VagaResumo & { descricao: string })[] = [
  { id: "e1", titulo: "Engenheiro Backend Node.js", empresa: "PayTech", local: "Remoto", link: "exemplo:e1", snippet: "Node.js, TypeScript, PostgreSQL, AWS", candidatos: 24, descricao: "Buscamos pessoa backend senior. Node.js e TypeScript obrigatorios; PostgreSQL, Docker e AWS. Kafka desejavel." },
  { id: "e2", titulo: "Pessoa Desenvolvedora Full Stack", empresa: "Loja Online SA", local: "Hibrido - SP", link: "exemplo:e2", snippet: "React, Node.js, SQL", candidatos: 180, descricao: "Full stack com React no front e Node.js no back. SQL e REST. Time agil." },
  { id: "e3", titulo: "Engenheiro de Dados", empresa: "DataCorp", local: "Remoto", link: "exemplo:e3", snippet: "Python, Spark, SQL", candidatos: 60, descricao: "Engenharia de dados com Python, Spark e SQL. Pipelines em nuvem." },
  { id: "e4", titulo: "Backend Senior (Golang)", empresa: "BairesDev", local: "Remoto", link: "exemplo:e4", snippet: "Go, Kubernetes", candidatos: 5, descricao: "Vaga em Go e Kubernetes." },
  { id: "e5", titulo: "Tech Lead Node.js", empresa: "Fintech X", local: "Remoto", link: "exemplo:e5", snippet: "Node.js, TypeScript, lideranca, AWS", candidatos: 40, descricao: "Lideranca tecnica de squad Node.js/TypeScript. AWS, Docker, mentoria." },
];

function exemploHandle(): ConectorHandle {
  const byLink = new Map(VAGAS_EXEMPLO.map((v) => [v.link, v]));
  return {
    priorizarPoucosCandidatos: false,
    async buscar(c: Criterios): Promise<VagaResumo[]> {
      const termo = c.cargo.trim().toLowerCase();
      return VAGAS_EXEMPLO.filter((v) =>
        !termo ? true : `${v.titulo} ${v.snippet}`.toLowerCase().includes(termo) || termo.split(/\s+/).some((w) => `${v.titulo} ${v.snippet}`.toLowerCase().includes(w)),
      ).map(({ descricao: _d, ...v }) => v);
    },
    async detalhar(v: VagaResumo): Promise<VagaDetalhe> {
      const full = byLink.get(v.link);
      return { ...v, descricao: full?.descricao ?? "", campos: [] };
    },
  };
}

/**
 * Cria e memoiza um ConectorHandle por site. Sites reais usam Playwright (contexto
 * persistente reaproveitado entre requisicoes); "exemplo" e offline.
 */
export class GerenciadorConectores {
  private readonly cache = new Map<string, ConectorHandle>();

  constructor(private readonly opts: { headless?: boolean } = {}) {}

  get = (site: string): ConectorHandle => {
    const key = site.toLowerCase();
    let h = this.cache.get(key);
    if (!h) {
      h = this.criar(key);
      this.cache.set(key, h);
    }
    return h;
  };

  private criar(site: string): ConectorHandle {
    if (site === "exemplo") return exemploHandle();
    const conn = criarConector(site, { headless: this.opts.headless });
    return {
      priorizarPoucosCandidatos: conn.options.priorizarPoucosCandidatos ?? false,
      buscar: (c) => conn.buscar(c),
      detalhar: (v) => conn.detalhar(v),
      fechar: () => conn.fechar(),
    };
  }

  async fecharTodos(): Promise<void> {
    for (const h of this.cache.values()) await h.fechar?.();
    this.cache.clear();
  }
}
