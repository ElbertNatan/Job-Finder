#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { ingestMarkdown } from "../ingest/markdown.js";
import { parseProfile, type Profile } from "../profile/schema.js";
import { detectGaps, mergeProfiles } from "../profile/gaps.js";
import { tailorResume } from "../tailor/ats.js";
import { renderResumeHtml } from "../render/html.js";
import { saveHtml, renderResumePdf } from "../render/pdf.js";
import { rankVagas } from "../discovery/rank.js";
import { FileTracker } from "../tracker/tracker.js";
import type { VagaResumo } from "../connectors/types.js";

const program = new Command();
program.name("jobfinder").description("Agente de adequacao de curriculo (ATS) e candidatura — CLI do nucleo").version("0.1.0");

function loadProfile(path: string): Profile {
  return parseProfile(JSON.parse(readFileSync(path, "utf-8")));
}

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

program
  .command("perfil")
  .description("Ingere um .md de dados brutos (e/ou funde com um perfil.json existente) e mostra as lacunas")
  .requiredOption("--md <arquivo>", "arquivo .md de dados brutos do candidato")
  .option("--merge <perfil.json>", "perfil.json existente para fundir (o existente vence nos escalares)")
  .option("--out <dir>", "diretorio de saida", "saida")
  .action((opts) => {
    let profile = ingestMarkdown(readFileSync(opts.md, "utf-8"));
    if (opts.merge && existsSync(opts.merge)) profile = mergeProfiles(loadProfile(opts.merge), profile);
    ensureDir(opts.out);
    const out = join(opts.out, "perfil.json");
    writeFileSync(out, JSON.stringify(profile, null, 2), "utf-8");
    console.log(`Perfil gravado em ${out}`);
    const gaps = detectGaps(profile);
    if (gaps.length === 0) {
      console.log("Sem lacunas essenciais. Perfil pronto para adaptar.");
    } else {
      console.log(`\nLacunas a preencher (entrevista guiada) — ${gaps.length}:`);
      for (const g of gaps) console.log(`  - [${g.campo}] ${g.pergunta}`);
    }
  });

program
  .command("adaptar")
  .description("Adapta o curriculo para uma vaga: gera HTML (preview=PDF), score ATS e relatorio de ajustes")
  .requiredOption("--perfil <perfil.json>", "perfil.json do candidato")
  .requiredOption("--vaga <arquivo.txt>", "arquivo com a descricao da vaga")
  .option("--out <dir>", "diretorio de saida", "saida")
  .option("--pdf", "tambem gerar PDF (requer Playwright)", false)
  .action(async (opts) => {
    const profile = loadProfile(opts.perfil);
    const jd = readFileSync(opts.vaga, "utf-8");
    const t = tailorResume(profile, jd);
    ensureDir(opts.out);
    const html = renderResumeHtml(t.profile);
    const htmlPath = join(opts.out, "curriculo.html");
    saveHtml(html, htmlPath);
    writeFileSync(join(opts.out, "relatorio-ats.md"), `# Relatorio ATS\n\nScore: ${t.score}%\n\n## Ajustes\n${t.ajustes.map((a) => `- ${a}`).join("\n")}\n`, "utf-8");
    console.log(`Score ATS: ${t.score}%`);
    for (const a of t.ajustes) console.log(`  - ${a}`);
    console.log(`\nPreview do curriculo (abra no navegador): ${htmlPath}`);
    if (opts.pdf) {
      try {
        const pdfPath = join(opts.out, "curriculo.pdf");
        await renderResumePdf(html, pdfPath);
        console.log(`PDF gerado: ${pdfPath}`);
      } catch (e) {
        console.warn(`PDF nao gerado: ${(e as Error).message}`);
      }
    }
  });

program
  .command("rankear")
  .description("Ranqueia vagas (JSON com VagaResumo[]) por aderencia ao perfil")
  .requiredOption("--perfil <perfil.json>", "perfil.json do candidato")
  .requiredOption("--vagas <vagas.json>", "arquivo JSON com uma lista de vagas")
  .action((opts) => {
    const profile = loadProfile(opts.perfil);
    const vagas = JSON.parse(readFileSync(opts.vagas, "utf-8")) as VagaResumo[];
    const ranked = rankVagas(profile, vagas);
    for (const r of ranked) {
      console.log(`[${r.score}%] ${r.vaga.titulo} — ${r.vaga.empresa} (${r.vaga.local})`);
      console.log(`       bate: ${r.matched.join(", ") || "-"} | falta: ${r.missing.join(", ") || "-"}`);
    }
  });

program
  .command("tracker")
  .description("Lista as candidaturas registradas")
  .option("--file <candidaturas.json>", "arquivo do tracker", join("saida", "candidaturas.json"))
  .action((opts) => {
    const list = new FileTracker(opts.file).list();
    if (list.length === 0) return console.log("Nenhuma candidatura registrada.");
    for (const c of list) console.log(`${c.data} | ${c.status.padEnd(20)} | ${c.site} | ${c.vaga} @ ${c.empresa}`);
  });

program.parseAsync(process.argv);
