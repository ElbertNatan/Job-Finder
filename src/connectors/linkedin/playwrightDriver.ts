import { chromium, type BrowserContext } from "playwright";
import type { Criterios } from "../types.js";
import type { LinkedInDriver, RawCard } from "./connector.js";

/**
 * Driver real do LinkedIn via Playwright. NAO E COBERTO POR TESTES automatizados:
 * depende de uma sessao LOGADA e do DOM do site (que muda). Toda a logica testavel
 * fica em LinkedInConnector; aqui e so o acesso ao navegador.
 *
 * Login: usamos um contexto PERSISTENTE (userDataDir). Na primeira vez, rode com
 * headless=false, faca login manualmente na janela que abrir e feche; a sessao fica
 * salva e e reaproveitada. O agente NUNCA guarda sua senha.
 *
 * Requisitos: `npx playwright install chromium`.
 * Os seletores abaixo podem precisar de ajuste quando o LinkedIn mudar o layout —
 * por isso ha fallbacks e try/catch defensivos.
 */
export interface PlaywrightDriverOptions {
  userDataDir: string;
  headless?: boolean;
}

export class PlaywrightLinkedInDriver implements LinkedInDriver {
  private ctx: BrowserContext | null = null;

  constructor(private readonly opts: PlaywrightDriverOptions) {}

  private async context(): Promise<BrowserContext> {
    if (!this.ctx) {
      this.ctx = await chromium.launchPersistentContext(this.opts.userDataDir, {
        headless: this.opts.headless ?? false,
        viewport: { width: 1280, height: 900 },
      });
    }
    return this.ctx;
  }

  async close(): Promise<void> {
    await this.ctx?.close();
    this.ctx = null;
  }

  private buildSearchUrl(c: Criterios): string {
    const p = new URLSearchParams();
    p.set("keywords", c.cargo);
    if (c.localidade) p.set("location", c.localidade);
    if (c.remoto) p.set("f_WT", "2"); // 2 = remoto
    p.set("sortBy", "DD"); // mais recentes primeiro
    return `https://www.linkedin.com/jobs/search/?${p.toString()}`;
  }

  async buscarCards(criterios: Criterios): Promise<RawCard[]> {
    const ctx = await this.context();
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.goto(this.buildSearchUrl(criterios), { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500); // deixa a lista carregar (lazy)

    const cardSel = ["div.job-card-container", "li.scaffold-layout__list-item", "li.jobs-search-results__list-item"].join(", ");
    try {
      return await page.$$eval(cardSel, (nodes) => {
        const text = (el: Element | null) => (el?.textContent ?? "").trim();
        return nodes.map((n) => {
          const tituloEl = n.querySelector("a.job-card-container__link, .job-card-list__title, a.job-card-list__title--link");
          const empresaEl = n.querySelector(".artdeco-entity-lockup__subtitle, .job-card-container__primary-description");
          const localEl = n.querySelector(".job-card-container__metadata-item, .artdeco-entity-lockup__caption");
          const linkEl = n.querySelector<HTMLAnchorElement>("a.job-card-container__link, a.job-card-list__title--link, a[href*='/jobs/view/']");
          const candEl = n.querySelector(".job-card-container__applicant-count, .tvm__text");
          return {
            titulo: (tituloEl?.textContent ?? "").trim(),
            empresa: (empresaEl?.textContent ?? "").trim(),
            local: (localEl?.textContent ?? "").trim(),
            link: linkEl?.href ?? "",
            candidatosTexto: (candEl?.textContent ?? "").trim(),
          };
        }).filter((c) => c.titulo.length > 0);
      });
    } catch {
      return [];
    }
  }

  async detalhe(link: string): Promise<{ descricao: string }> {
    const ctx = await this.context();
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.goto(link, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const descricao = await page
      .$eval(".jobs-description__content, .jobs-box__html-content, #job-details", (el) => (el.textContent ?? "").trim())
      .catch(() => "");
    return { descricao };
  }
}
