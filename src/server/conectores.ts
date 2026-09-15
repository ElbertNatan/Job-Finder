import { criarConector } from "../connectors/factory.js";
import type { ConectorHandle } from "./discoveryService.js";

/**
 * Cria e memoiza um ConectorHandle por site real. Usa Playwright com contexto
 * persistente (a sessao de login e reaproveitada entre requisicoes).
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
    const conn = criarConector(site, { headless: this.opts.headless });
    return {
      priorizarPoucosCandidatos: conn.options.priorizarPoucosCandidatos ?? false,
      requerLogin: conn.requerLogin,
      estaLogado: () => conn.estaLogado(),
      abrirParaLogin: () => conn.abrirParaLogin(),
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
