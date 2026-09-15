import { BrowserConnector } from "./browserConnector.js";
import { PlaywrightSiteDriver } from "./playwrightSiteDriver.js";
import { siteConfig } from "./sites.js";

/**
 * Cria um conector REAL (Playwright) para um site pelo seu key ("linkedin", "gupy",
 * "vagas", "infojobs", "indeed", "catho"). A sessao de login fica em `userDataDir`.
 */
export function criarConector(
  siteKey: string,
  opts: { userDataDir?: string; headless?: boolean } = {},
): BrowserConnector {
  const cfg = siteConfig(siteKey);
  const userDataDir = opts.userDataDir ?? `.browser-session/${siteKey.toLowerCase()}`;
  const driver = new PlaywrightSiteDriver(cfg, { userDataDir, headless: opts.headless });
  return new BrowserConnector(cfg.site, driver, { priorizarPoucosCandidatos: cfg.priorizarPoucosCandidatos });
}
