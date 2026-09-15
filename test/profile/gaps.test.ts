import { describe, it, expect } from "vitest";
import { emptyProfile, parseProfile } from "../../src/profile/schema.js";
import { detectGaps, mergeProfiles } from "../../src/profile/gaps.js";

describe("detectGaps", () => {
  it("flags missing essentials on an empty profile", () => {
    const gaps = detectGaps(emptyProfile());
    const campos = gaps.map((g) => g.campo);
    expect(campos).toContain("identificacao.nome");
    expect(campos).toContain("identificacao.email");
    expect(campos).toContain("objetivo.cargoAlvo");
    expect(campos).toContain("experiencias");
    // toda lacuna traz uma pergunta em pt para a entrevista guiada
    expect(gaps.every((g) => g.pergunta.length > 0)).toBe(true);
  });

  it("does not flag a field that is present", () => {
    const p = parseProfile({ ...emptyProfile(), identificacao: { nome: "Ana", email: "ana@x.com" } });
    const campos = detectGaps(p).map((g) => g.campo);
    expect(campos).not.toContain("identificacao.nome");
    expect(campos).not.toContain("identificacao.email");
  });

  it("does not flag experiencias when at least one exists", () => {
    const p = parseProfile({
      ...emptyProfile(),
      experiencias: [{ empresa: "ACME", cargo: "Dev" }],
    });
    expect(detectGaps(p).map((g) => g.campo)).not.toContain("experiencias");
  });
});

describe("mergeProfiles", () => {
  it("incoming fills null scalars of base but never overwrites existing values", () => {
    const base = parseProfile({ ...emptyProfile(), identificacao: { nome: "Ana", email: null } });
    const incoming = parseProfile({ ...emptyProfile(), identificacao: { nome: "OUTRO", email: "ana@x.com" } });
    const merged = mergeProfiles(base, incoming);
    expect(merged.identificacao.nome).toBe("Ana"); // base vence
    expect(merged.identificacao.email).toBe("ana@x.com"); // incoming preenche o nulo
  });

  it("concatenates and de-duplicates list fields", () => {
    const base = parseProfile({ ...emptyProfile(), experiencias: [{ empresa: "ACME", cargo: "Dev" }] });
    const incoming = parseProfile({
      ...emptyProfile(),
      experiencias: [
        { empresa: "ACME", cargo: "Dev" },
        { empresa: "Startup", cargo: "Lead" },
      ],
    });
    const merged = mergeProfiles(base, incoming);
    expect(merged.experiencias).toHaveLength(2);
    expect(merged.experiencias.map((e) => e.empresa)).toEqual(["ACME", "Startup"]);
  });
});
