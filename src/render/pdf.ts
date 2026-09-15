import { writeFileSync } from "node:fs";

/**
 * Gera PDF a partir do MESMO HTML do preview (§10). Usa Playwright/Chromium
 * (import dinamico: nao e dependencia obrigatoria do nucleo). Se o Playwright
 * nao estiver instalado, orienta o usuario em vez de quebrar.
 */
export async function renderResumePdf(html: string, outPath: string): Promise<void> {
  let chromium: typeof import("playwright").chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Error(
      "Playwright nao instalado. Rode: npm i -D playwright && npx playwright install chromium. " +
        "Enquanto isso, abra o .html gerado no navegador (o preview e identico ao PDF).",
    );
  }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.pdf({ path: outPath, format: "A4", printBackground: true, margin: { top: "0", bottom: "0", left: "0", right: "0" } });
  } finally {
    await browser.close();
  }
}

/** Salva o HTML do preview em disco (sempre disponivel, sem depender de Chromium). */
export function saveHtml(html: string, outPath: string): void {
  writeFileSync(outPath, html, "utf-8");
}
