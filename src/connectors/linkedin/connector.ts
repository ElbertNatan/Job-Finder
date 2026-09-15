import { BrowserConnector, type RawCard, type SiteDriver } from "../browserConnector.js";

// Compat: mantidos os nomes historicos usados por testes/consumidores.
export type { RawCard };
export type LinkedInDriver = SiteDriver;

/**
 * Conector do LinkedIn. Toda a logica vive no BrowserConnector generico; aqui so
 * fixamos o nome do site e ligamos a regra "priorizar < 100 candidatos".
 * O acesso ao site vive no PlaywrightLinkedInDriver.
 */
export class LinkedInConnector extends BrowserConnector {
  constructor(driver: SiteDriver) {
    super("LinkedIn", driver, { priorizarPoucosCandidatos: true });
  }
}
