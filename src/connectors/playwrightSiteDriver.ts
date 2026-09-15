import { chromium, type BrowserContext } from "playwright";
import type { Criterios } from "./types.js";
import type { RawCard, SiteDriver } from "./browserConnector.js";
import type { SiteConfig } from "./sites.js";

/**
 * Driver de navegador GENERICO, dirigido por SiteConfig. Serve todos os sites.
 * NAO E COBERTO POR TESTES automatizados: depende do DOM ao vivo e (quando
 * `requerLogin`) de uma sessao logada em contexto persistente. Toda a logica
 * testavel fica no BrowserConnector; aqui e so o acesso ao navegador.
 *
 * Requisitos: `npx playwright install chromium`. O agente NUNCA guarda sua senha —
 * o login e feito por voce na janela do navegador e a sessao fica no userDataDir.
 */
export interface PlaywrightSiteDriverOptions {
  userDataDir: string;
  headless?: boolean;
}

export class PlaywrightSiteDriver implements SiteDriver {
  private ctx: BrowserContext | null = null;

  constructor(
    private readonly config: SiteConfig,
    private readonly opts: PlaywrightSiteDriverOptions,
  ) {}

  private async page() {
    // Resiliente: se o contexto foi fechado (usuario fechou a janela, etc.), relanca.
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      try {
        if (!this.ctx) {
          this.ctx = await chromium.launchPersistentContext(this.opts.userDataDir, {
            headless: this.opts.headless ?? false,
            viewport: { width: 1280, height: 900 },
          });
        }
        return this.ctx.pages()[0] ?? (await this.ctx.newPage());
      } catch (e) {
        this.ctx = null;
        if (tentativa === 1) throw e;
      }
    }
    throw new Error("nao foi possivel abrir o navegador");
  }

  async close(): Promise<void> {
    try {
      await this.ctx?.close();
    } catch {
      /* ja fechado */
    }
    this.ctx = null;
  }

  /** True se, ao abrir a home, o site NAO redirecionou para login/authwall. */
  async estaLogado(): Promise<boolean> {
    if (!this.config.requerLogin) return true;
    const page = await this.page();
    await page.goto(this.config.homeUrl ?? this.config.loginUrl ?? "about:blank", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    return !/\/login|authwall|signup|uas\/login|checkpoint/i.test(page.url());
  }

  /** Abre o navegador na tela de login e deixa a janela para o usuario entrar. */
  async abrirParaLogin(): Promise<void> {
    const page = await this.page();
    await page.goto(this.config.loginUrl ?? this.config.homeUrl ?? "about:blank", { waitUntil: "domcontentloaded" });
  }

  async buscarCards(criterios: Criterios): Promise<RawCard[]> {
    const page = await this.page();
    await page.goto(this.config.searchUrl(criterios), { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    const s = this.config.seletores;
    try {
      return await page.$$eval(
        s.card,
        (nodes, sel) => {
          const txt = (el: Element | null) => (el?.textContent ?? "").trim();
          return nodes
            .map((n) => {
              const linkEl = n.querySelector(sel.link) as HTMLAnchorElement | null;
              return {
                titulo: txt(n.querySelector(sel.titulo)),
                empresa: txt(n.querySelector(sel.empresa)),
                local: txt(n.querySelector(sel.local)),
                link: linkEl?.href ?? "",
                candidatosTexto: sel.candidatos ? txt(n.querySelector(sel.candidatos)) : "",
              };
            })
            .filter((c) => c.titulo.length > 0);
        },
        s,
      );
    } catch {
      return [];
    }
  }

  async detalhe(link: string): Promise<{ descricao: string }> {
    const page = await this.page();
    await page.goto(link, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const descricao = await page
      .$eval(this.config.seletores.descricao, (el) => (el.textContent ?? "").trim())
      .catch(() => "");
    return { descricao };
  }
}
