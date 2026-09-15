import { describe, it, expect } from "vitest";
import { parseProfile, emptyProfile } from "../../src/profile/schema.js";
import { renderResumeHtml } from "../../src/render/html.js";

const PROFILE = parseProfile({
  ...emptyProfile(),
  identificacao: { nome: "Maria <Silva>", email: "maria@x.com", cidade: "Sao Paulo", uf: "SP" },
  objetivo: { cargoAlvo: "Engenheira", resumo: "Backend ha 10 anos" },
  experiencias: [{ empresa: "ACME", cargo: "Dev Senior", inicio: "2020", fim: "atual", conquistas: ["Reduzi custo 30%"], tecnologias: ["Node.js"] }],
  competencias: { tecnicas: [{ nome: "Node.js", nivel: "avancado" }], ferramentas: ["Git"], softSkills: [] },
});

describe("renderResumeHtml", () => {
  it("produces a full HTML document with the candidate name", () => {
    const html = renderResumeHtml(PROFILE);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Engenheira");
  });

  it("escapes HTML special characters in user content (no injection)", () => {
    const html = renderResumeHtml(PROFILE);
    expect(html).toContain("Maria &lt;Silva&gt;");
    expect(html).not.toContain("Maria <Silva>");
  });

  it("includes experience content", () => {
    const html = renderResumeHtml(PROFILE);
    expect(html).toContain("ACME");
    expect(html).toContain("Reduzi custo 30%");
  });

  it("is ATS-friendly: no <table> layout", () => {
    const html = renderResumeHtml(PROFILE);
    expect(html.toLowerCase()).not.toContain("<table");
  });

  it("omits empty sections", () => {
    const html = renderResumeHtml(PROFILE);
    // sem projetos no perfil -> nao renderiza o cabecalho de Projetos
    expect(html).not.toContain(">Projetos<");
  });
});
