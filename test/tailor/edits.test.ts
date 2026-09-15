import { describe, it, expect } from "vitest";
import { parseProfile, emptyProfile } from "../../src/profile/schema.js";
import { applyResumeEdits } from "../../src/tailor/edits.js";

const PROFILE = parseProfile({
  ...emptyProfile(),
  objetivo: { cargoAlvo: "Dev", resumo: "original" },
  experiencias: [
    { empresa: "ACME", cargo: "Senior" },
    { empresa: "Startup", cargo: "Pleno" },
  ],
  competencias: { tecnicas: [{ nome: "Node.js", nivel: null }, { nome: "PHP", nivel: null }], ferramentas: [], softSkills: [] },
});

describe("applyResumeEdits", () => {
  it("overrides resumo and cargoAlvo when provided", () => {
    const p = applyResumeEdits(PROFILE, { resumo: "novo resumo", cargoAlvo: "Tech Lead" });
    expect(p.objetivo.resumo).toBe("novo resumo");
    expect(p.objetivo.cargoAlvo).toBe("Tech Lead");
  });

  it("hides experiences by index without touching the others", () => {
    const p = applyResumeEdits(PROFILE, { ocultarExperiencias: [0] });
    expect(p.experiencias.map((e) => e.empresa)).toEqual(["Startup"]);
  });

  it("hides a competencia by name, case-insensitively, and never adds one", () => {
    const p = applyResumeEdits(PROFILE, { ocultarCompetencias: ["php"] });
    expect(p.competencias.tecnicas.map((t) => t.nome)).toEqual(["Node.js"]);
  });

  it("leaves the profile unchanged when no edits are given", () => {
    const p = applyResumeEdits(PROFILE, {});
    expect(p).toEqual(PROFILE);
  });

  it("does not mutate the input profile", () => {
    applyResumeEdits(PROFILE, { ocultarExperiencias: [0], resumo: "x" });
    expect(PROFILE.experiencias).toHaveLength(2);
    expect(PROFILE.objetivo.resumo).toBe("original");
  });
});
