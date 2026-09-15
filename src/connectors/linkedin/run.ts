import { readFileSync } from "node:fs";
import { parseProfile } from "../../profile/schema.js";
import { rankVagas } from "../../discovery/rank.js";
import { LinkedInConnector } from "./connector.js";
import { PlaywrightLinkedInDriver } from "./playwrightDriver.js";

/**
 * Executa uma busca REAL no LinkedIn (abre o navegador; precisa de login).
 * Uso:
 *   npm run linkedin -- "<cargo>" ["<localidade>"]
 * O perfil vem de $PERFIL ou de saida/perfil.json (gere antes com `jobfinder perfil`).
 *
 * Na primeira vez, a janela do Chromium abre para voce logar no LinkedIn; a sessao
 * fica salva em ./.linkedin-session e e reaproveitada nas proximas.
 * Aplica automaticamente: priorizar vagas com < 100 candidatos e ignorar BairesDev.
 */
const cargo = process.argv[2];
const localidade = process.argv[3];
const perfilPath = process.env.PERFIL ?? "saida/perfil.json";

if (!cargo) {
  console.error('Uso: npm run linkedin -- "<cargo>" ["<localidade>"]');
  process.exit(1);
}

const profile = parseProfile(JSON.parse(readFileSync(perfilPath, "utf-8")));
const driver = new PlaywrightLinkedInDriver({ userDataDir: ".linkedin-session", headless: false });
const conn = new LinkedInConnector(driver);

try {
  console.log(`Buscando "${cargo}"${localidade ? ` em ${localidade}` : ""} no LinkedIn...`);
  const vagas = await conn.buscar({ cargo, localidade, remoto: true });
  const ranked = rankVagas(profile, vagas, { priorizarPoucosCandidatos: true, limiteCandidatos: 100 });
  if (ranked.length === 0) {
    console.log("Nenhuma vaga encontrada (verifique se esta logado e se os seletores ainda batem).");
  }
  for (const r of ranked) {
    const cand = r.vaga.candidatos != null ? `${r.vaga.candidatos} cand.` : "cand.?";
    console.log(`[${r.score}% | ${cand}] ${r.vaga.titulo} — ${r.vaga.empresa}`);
    console.log(`   ${r.vaga.link}`);
  }
} finally {
  await driver.close();
}
