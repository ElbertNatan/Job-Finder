import type { Profile } from "../profile/schema.js";

/**
 * Render do curriculo em HTML ATS-friendly (§6/§10 do plano).
 * O MESMO HTML alimenta o preview (na UI) e o PDF (via Playwright em src/render/pdf.ts).
 * Regras ATS: coluna unica, sem <table> de layout, texto selecionavel, fontes padrao.
 */

function esc(s: string | null | undefined): string {
  if (s == null) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function section(title: string, inner: string): string {
  if (!inner.trim()) return "";
  return `<section><h2>${esc(title)}</h2>${inner}</section>`;
}

function periodo(inicio: string | null, fim: string | null): string {
  if (!inicio && !fim) return "";
  return `${esc(inicio ?? "")}${inicio || fim ? " – " : ""}${esc(fim ?? "")}`;
}

export function renderResumeHtml(p: Profile): string {
  const id = p.identificacao;

  const contatoPartes = [
    id.email,
    id.telefone,
    [id.cidade, id.uf].filter(Boolean).join("/") || null,
    id.links.linkedin,
    id.links.github,
    id.links.portfolio,
  ].filter((x): x is string => !!x);
  const contato = contatoPartes.map(esc).join(" · ");

  const resumo = p.objetivo.resumo ? `<p class="resumo">${esc(p.objetivo.resumo)}</p>` : "";

  const experiencias = p.experiencias
    .map((e) => {
      const conq = e.conquistas.length ? `<ul>${e.conquistas.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : "";
      const tech = e.tecnologias.length ? `<p class="tech">${esc(e.tecnologias.join(", "))}</p>` : "";
      const desc = e.descricao ? `<p>${esc(e.descricao)}</p>` : "";
      return `<article><h3>${esc(e.cargo)} — ${esc(e.empresa)}</h3><p class="meta">${periodo(e.inicio, e.fim)}${
        e.local ? " · " + esc(e.local) : ""
      }</p>${desc}${conq}${tech}</article>`;
    })
    .join("");

  const formacoes = p.formacoes
    .map((f) => `<article><h3>${esc(f.curso)}</h3><p class="meta">${esc(f.instituicao ?? "")} ${periodo(f.inicio, f.fim)} ${esc(f.status ?? "")}</p></article>`)
    .join("");

  const competenciasInner = [
    p.competencias.tecnicas.length ? `<p><strong>Tecnicas:</strong> ${esc(p.competencias.tecnicas.map((t) => t.nome).join(", "))}</p>` : "",
    p.competencias.ferramentas.length ? `<p><strong>Ferramentas:</strong> ${esc(p.competencias.ferramentas.join(", "))}</p>` : "",
    p.competencias.softSkills.length ? `<p><strong>Soft skills:</strong> ${esc(p.competencias.softSkills.join(", "))}</p>` : "",
  ].join("");

  const idiomas = p.idiomas.length
    ? `<p>${p.idiomas.map((i) => esc(`${i.idioma}${i.nivel ? " (" + i.nivel + ")" : ""}`)).join(" · ")}</p>`
    : "";

  const certificacoes = p.certificacoes.length
    ? `<ul>${p.certificacoes.map((c) => `<li>${esc([c.nome, c.instituicao, c.ano].filter(Boolean).join(" — "))}</li>`).join("")}</ul>`
    : "";

  const projetos = p.projetos
    .map((pr) => `<article><h3>${esc(pr.nome)}</h3>${pr.descricao ? `<p>${esc(pr.descricao)}</p>` : ""}${
      pr.stack.length ? `<p class="tech">${esc(pr.stack.join(", "))}</p>` : ""
    }${pr.link ? `<p class="meta">${esc(pr.link)}</p>` : ""}</article>`)
    .join("");

  const style = `
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; padding: 32px 40px; line-height: 1.4; max-width: 820px; }
    header h1 { margin: 0 0 4px; font-size: 24px; }
    header .cargo { margin: 0 0 6px; font-size: 15px; color: #333; }
    header .contato { margin: 0; font-size: 12px; color: #444; }
    .resumo { font-size: 13px; margin: 12px 0 0; }
    h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .5px; border-bottom: 1px solid #ccc; padding-bottom: 3px; margin: 20px 0 8px; }
    h3 { font-size: 13px; margin: 10px 0 2px; }
    .meta { font-size: 11px; color: #555; margin: 0 0 4px; }
    .tech { font-size: 11px; color: #333; margin: 4px 0 0; font-style: italic; }
    ul { margin: 4px 0 0; padding-left: 18px; }
    li, p { font-size: 12px; }
  `;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${esc(id.nome ?? "Curriculo")}</title>
<style>${style}</style>
</head>
<body>
<header>
<h1>${esc(id.nome ?? "")}</h1>
${p.objetivo.cargoAlvo ? `<p class="cargo">${esc(p.objetivo.cargoAlvo)}</p>` : ""}
${contato ? `<p class="contato">${contato}</p>` : ""}
${resumo}
</header>
${section("Experiencia", experiencias)}
${section("Formacao", formacoes)}
${section("Competencias", competenciasInner)}
${section("Idiomas", idiomas)}
${section("Certificacoes", certificacoes)}
${section("Projetos", projetos)}
</body>
</html>`;
}
