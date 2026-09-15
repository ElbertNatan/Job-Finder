import { rmSync } from "node:fs";
import { join } from "node:path";
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
  private abrindo: Promise<BrowserContext> | null = null;

  constructor(
    private readonly config: SiteConfig,
    private readonly opts: PlaywrightSiteDriverOptions,
  ) {}

  /**
   * Remove os locks de perfil que sobram quando um Chromium anterior nao fechou
   * direito — a causa do erro "Target page, context or browser has been closed"
   * (o novo processo detecta o lock e sai na hora, sem abrir a janela).
   */
  private limparLock(): void {
    for (const f of ["SingletonLock", "SingletonCookie", "SingletonSocket", "lockfile"]) {
      try {
        rmSync(join(this.opts.userDataDir, f), { force: true, recursive: true });
      } catch {
        /* ok */
      }
    }
  }

  private async getContexto(): Promise<BrowserContext> {
    if (this.ctx) return this.ctx;
    // Um unico launch em voo (evita duas requisicoes lancarem o mesmo perfil juntas).
    if (!this.abrindo) {
      this.abrindo = (async () => {
        this.limparLock();
        const ctx = await chromium.launchPersistentContext(this.opts.userDataDir, {
          headless: this.opts.headless ?? false,
          viewport: { width: 1280, height: 900 },
        });
        // Shim para o helper `__name` que o tsx/esbuild injeta nas funcoes: sem ele,
        // os callbacks de $$eval (serializados para o navegador) quebram com
        // "ReferenceError: __name is not defined" e a captura retorna vazio.
        await ctx.addInitScript("window.__name = window.__name || function (f) { return f; };");
        ctx.on("close", () => {
          if (this.ctx === ctx) this.ctx = null;
        });
        this.ctx = ctx;
        return ctx;
      })().finally(() => {
        this.abrindo = null;
      });
    }
    return this.abrindo;
  }

  private async page() {
    // Resiliente: se o contexto foi fechado (janela fechada, lock antigo), relanca.
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      try {
        const ctx = await this.getContexto();
        return ctx.pages()[0] ?? (await ctx.newPage());
      } catch (e) {
        this.ctx = null;
        this.abrindo = null;
        this.limparLock();
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
    this.abrindo = null;
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
    // Sites de vaga sao SPAs: espera a rede assentar e aparecer algo antes de raspar.
    await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
    await page.waitForSelector(`${s.card}, ${s.link}, a[href*='/vaga'], a[href*='/job']`, { timeout: 15000 }).catch(() => {});
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

    if (porLinks.length) return dedup(porLinks);

    // Estrategia 3 (universal): garimpa qualquer ancora cujo href pareca uma vaga.
    // Independe dos seletores do site — util quando o layout muda.
    const universal = await page
      .$$eval("a[href]", (anchors) => {
        const rx = /\/(vagas?|jobs?|job|emprego|empregos|oportunidade|carreiras?|posting)\//i;
        const txt = (el: Element | null | undefined) => (el?.textContent ?? "").trim();
        return (anchors as HTMLAnchorElement[])
          .filter((a) => rx.test(a.href))
          .map((a) => {
            const card = a.closest("li, article, [class*='card'], [class*='result'], [class*='job'], [class*='vaga']") ?? a.parentElement;
            const acha = (pistas: string[]) => {
              for (const p of pistas) {
                const t = txt(card?.querySelector(`[class*='${p}']`));
                if (t) return t;
              }
              return "";
            };
            return {
              titulo: (a.getAttribute("aria-label") || a.textContent || "").trim(),
              empresa: acha(["subtitle", "company", "empresa", "employer"]),
              local: acha(["caption", "location", "local", "metadata"]),
              link: a.href,
              candidatosTexto: acha(["applicant", "candidat", "tvm"]),
            };
          })
          .filter((c) => c.titulo.length > 2 && c.link.length > 0);
      })
      .catch(() => [] as RawCard[]);

    return dedup(universal);
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
