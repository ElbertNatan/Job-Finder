import { readFileSync } from "node:fs";
import { parseProfile } from "../profile/schema.js";
import { rankVagas } from "../discovery/rank.js";
import { criarConector } from "./factory.js";
import { siteConfig } from "./sites.js";

/**
 * Busca REAL de vagas num site (abre o navegador; alguns exigem login).
 * Uso:
 *   npm run buscar -- <site> "<cargo>" ["<localidade>"]
 *   sites: linkedin | gupy | vagas | infojobs | indeed | catho
 * Perfil: $PERFIL ou saida/perfil.json (gere antes com `jobfinder perfil`).
 *
 * Aplica automaticamente as regras do projeto: BairesDev ignorada em qualquer site;
 * no LinkedIn, vagas com < 100 candidatos primeiro. Na primeira vez o navegador abre
 * para voce logar; a sessao fica salva em .browser-session/<site>.
 */
const site = process.argv[2];
const cargo = process.argv[3];
const localidade = process.argv[4];
const perfilPath = process.env.PERFIL ?? "saida/perfil.json";

if (!site || !cargo) {
  console.error('Uso: npm run buscar -- <site> "<cargo>" ["<localidade>"]');
  console.error("sites: linkedin | gupy | vagas | infojobs | indeed | catho");
  process.exit(1);
}

const cfg = siteConfig(site); // valida o site cedo (lanca se desconhecido)
const profile = parseProfile(JSON.parse(readFileSync(perfilPath, "utf-8")));
const conn = criarConector(site, { headless: false });

try {
  console.log(`[${cfg.site}] buscando "${cargo}"${localidade ? ` em ${localidade}` : ""}...`);
  const vagas = await conn.buscar({ cargo, localidade, remoto: true });
  const ranked = rankVagas(profile, vagas, { priorizarPoucosCandidatos: cfg.priorizarPoucosCandidatos });
  if (ranked.length === 0) {
    console.log("Nenhuma vaga (verifique login e se os seletores do site ainda batem).");
  }
  for (const r of ranked) {
    const cand = r.vaga.candidatos != null ? `${r.vaga.candidatos} cand.` : "cand.?";
    console.log(`[${r.score}% | ${cand}] ${r.vaga.titulo} — ${r.vaga.empresa}`);
    console.log(`   ${r.vaga.link}`);
  }
} finally {
  await conn.fechar();
}
