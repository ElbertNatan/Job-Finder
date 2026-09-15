import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname, normalize } from "node:path";
import { ingestMarkdown } from "../ingest/markdown.js";
import type { Profile } from "../profile/schema.js";
import type { DiscoveryService } from "./discoveryService.js";

const TIPOS: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".map": "application/json",
};

function enviarJson(res: ServerResponse, obj: unknown, status = 200): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

async function lerBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
}

export interface ServidorOpts {
  service: DiscoveryService;
  fallbackProfile: Profile;
  distDir?: string;
}

/** Servidor local: expoe /api/buscar e /api/detalhar e (opcional) serve o app buildado. */
export function criarServidor({ service, fallbackProfile, distDir }: ServidorOpts) {
  async function tratarApi(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await lerBody(req);
    const profile = typeof body.profileMd === "string" && body.profileMd ? ingestMarkdown(body.profileMd) : fallbackProfile;
    if (req.url === "/api/buscar") {
      const vagas = await service.buscar(profile, {
        site: String(body.site ?? "exemplo"),
        cargo: String(body.cargo ?? ""),
        localidade: body.localidade ? String(body.localidade) : undefined,
      });
      return enviarJson(res, { vagas });
    }
    if (req.url === "/api/detalhar") {
      const r = await service.detalhar({ site: String(body.site ?? "exemplo"), link: String(body.link ?? "") });
      return enviarJson(res, r);
    }
    enviarJson(res, { erro: "rota nao encontrada" }, 404);
  }

  async function servirEstatico(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = (req.url ?? "/").split("?")[0] ?? "/";
    let rel = decodeURIComponent(url);
    if (rel === "/") rel = "/index.html";
    const file = normalize(join(distDir!, rel));
    if (!file.startsWith(normalize(distDir!))) {
      res.writeHead(403);
      return void res.end("forbidden");
    }
    const alvo = existsSync(file) ? file : join(distDir!, "index.html"); // SPA fallback
    const data = await readFile(alvo);
    res.writeHead(200, { "content-type": TIPOS[extname(alvo)] ?? "application/octet-stream" });
    res.end(data);
  }

  return createServer((req, res) => {
    (async () => {
      try {
        if (req.url?.startsWith("/api/")) return await tratarApi(req, res);
        if (distDir) return await servirEstatico(req, res);
        res.writeHead(404);
        res.end("not found");
      } catch (e) {
        enviarJson(res, { erro: (e as Error).message }, 500);
      }
    })();
  });
}
