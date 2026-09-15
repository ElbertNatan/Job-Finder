import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseProfile, emptyProfile, type Profile } from "../profile/schema.js";
import { DiscoveryService } from "./discoveryService.js";
import { GerenciadorConectores } from "./conectores.js";
import { criarServidor } from "./http.js";

/**
 * Sobe o servidor local do JobFinder: API de descoberta (o AGENTE busca as vagas)
 * + serve o app buildado (web/dist), se existir. A UI chama /api/buscar e /api/detalhar.
 *
 * Env/args: PORT (default 8787); PERFIL (default saida/perfil.json).
 * Sites reais abrem o navegador para login na 1a vez; "exemplo" e offline.
 */
const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const port = Number(process.env.PORT ?? 8787);
const perfilPath = process.env.PERFIL ?? join(raiz, "saida", "perfil.json");

function carregarProfile(): Profile {
  try {
    if (existsSync(perfilPath)) return parseProfile(JSON.parse(readFileSync(perfilPath, "utf-8")));
  } catch {
    /* ignora: a UI envia o perfil junto da busca */
  }
  return emptyProfile();
}

const gerenciador = new GerenciadorConectores({ headless: false });
const service = new DiscoveryService(gerenciador.get);
const distDir = existsSync(join(raiz, "web", "dist", "index.html")) ? join(raiz, "web", "dist") : undefined;

const server = criarServidor({ service, fallbackProfile: carregarProfile(), distDir });
server.listen(port, () => {
  console.log(`JobFinder no ar em http://localhost:${port}`);
  console.log(distDir ? "Servindo o app buildado (web/dist)." : "API apenas (rode `npm run web:dev` para a UI, com proxy /api).");
});

async function encerrar() {
  await gerenciador.fecharTodos();
  server.close(() => process.exit(0));
}
process.on("SIGINT", encerrar);
process.on("SIGTERM", encerrar);
