import type { JobConnector } from "./types.js";

/** Registro de conectores plugaveis. Somar um site novo = registrar um JobConnector. */
export class ConnectorRegistry {
  private readonly connectors = new Map<string, JobConnector>();

  register(connector: JobConnector): void {
    this.connectors.set(connector.site, connector);
  }

  get(site: string): JobConnector {
    const c = this.connectors.get(site);
    if (!c) throw new Error(`Conector nao registrado para o site: ${site}. Registrados: ${this.list().join(", ") || "(nenhum)"}`);
    return c;
  }

  list(): string[] {
    return [...this.connectors.keys()];
  }
}
