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

/** Remove vagas repetidas pelo link (a mesma vaga aparece varias vezes na pagina). */
function dedup(cards: RawCard[]): RawCard[] {
  const vistos = new Set<string>();
  const out: RawCard[] = [];
  for (const c of cards) {
    if (!vistos.has(c.link)) {
      vistos.add(c.link);
      out.push(c);
    }
  }
  return out;
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

  private async autoScroll(): Promise<void> {
    const page = await this.page();
    // A maioria dos sites (LinkedIn incluso) carrega a lista conforme rola (lazy).
    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => window.scrollBy(0, 1600)).catch(() => {});
      await page.mouse.wheel(0, 1600).catch(() => {});
      await page.waitForTimeout(500);
    }
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  }

  async buscarCards(criterios: Criterios): Promise<RawCard[]> {
    const page = await this.page();
    await page.goto(this.config.searchUrl(criterios), { waitUntil: "domcontentloaded" });
    const s = this.config.seletores;
    // Espera aparecer algo (card ou link de vaga) antes de raspar; rola para carregar a lista.
    await page.waitForSelector(`${s.card}, ${s.link}`, { timeout: 15000 }).catch(() => {});
    await this.autoScroll();

    // Estrategia 1: cards estruturados pelos seletores da config.
    const porCards = await page
      .$$eval(
        s.card,
        (nodes, sel) => {
          const txt = (el: Element | null) => (el?.textContent ?? "").trim();
          return nodes
            .map((n) => {
              const linkEl = n.querySelector(sel.link) as HTMLAnchorElement | null;
              return {
                titulo: txt(n.querySelector(sel.titulo)) || (linkEl?.getAttribute("aria-label") ?? "").trim(),
                empresa: txt(n.querySelector(sel.empresa)),
                local: txt(n.querySelector(sel.local)),
                link: linkEl?.href ?? "",
                candidatosTexto: sel.candidatos ? txt(n.querySelector(sel.candidatos)) : "",
              };
            })
            .filter((c) => c.titulo.length > 0 && c.link.length > 0);
        },
        s,
      )
      .catch(() => [] as RawCard[]);

    if (porCards.length) return dedup(porCards);

    // Estrategia 2 (fallback robusto): extrai pelas ancoras de vaga + heuristica de vizinhanca.
    const porLinks = await page
      .$$eval(
        s.link,
        (anchors) => {
          const txt = (el: Element | null | undefined) => (el?.textContent ?? "").trim();
          const perto = (base: Element, pistas: string[]) => {
            const card = base.closest("li, article, [data-job-id], [class*='card'], [class*='result']") ?? base.parentElement;
            for (const p of pistas) {
              const el = card?.querySelector(`[class*='${p}']`);
              const t = txt(el);
              if (t) return t;
            }
            return "";
          };
          return (anchors as HTMLAnchorElement[])
            .map((a) => ({
              titulo: (a.getAttribute("aria-label") || a.textContent || "").trim(),
              empresa: perto(a, ["subtitle", "company", "empresa", "employer"]),
              local: perto(a, ["caption", "location", "local", "metadata"]),
              link: a.href,
              candidatosTexto: perto(a, ["applicant", "candidat", "tvm"]),
            }))
            .filter((c) => c.titulo.length > 0 && c.link.length > 0);
        },
      )
      .catch(() => [] as RawCard[]);

    return dedup(porLinks);
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
