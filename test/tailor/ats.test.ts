import { describe, it, expect } from "vitest";
import { parseProfile, emptyProfile } from "../../src/profile/schema.js";
import { extractKeywords, analyzeGap, tailorResume } from "../../src/tailor/ats.js";

describe("extractKeywords", () => {
  it("finds vocabulary terms present in a job description (accent/case insensitive)", () => {
    const text = "Buscamos pessoa com Node.js, TypeScript e experiencia em AWS.";
    const found = extractKeywords(text, ["Node.js", "TypeScript", "AWS", "Python"]);
    expect(found).toEqual(["Node.js", "TypeScript", "AWS"]);
  });

  it("does not match a term that only appears as part of another word", () => {
    const found = extractKeywords("Trabalhamos com javascripting avancado", ["Java"]);
    expect(found).toEqual([]);
  });
});

const PROFILE = parseProfile({
  ...emptyProfile(),
  competencias: { tecnicas: [{ nome: "Node.js", nivel: "avancado" }, { nome: "TypeScript", nivel: "avancado" }], ferramentas: ["Docker"], softSkills: [] },
  experiencias: [{ empresa: "ACME", cargo: "Dev", tecnologias: ["Node.js", "PostgreSQL"] }],
});

describe("analyzeGap", () => {
  it("computes matched, missing and an ATS score from the job keywords", () => {
    const jd = "Vaga: Node.js, TypeScript e AWS sao obrigatorios. Desejavel Docker.";
    const r = analyzeGap(PROFILE, jd);
    expect(r.matched).toEqual(expect.arrayContaining(["Node.js", "TypeScript", "Docker"]));
    expect(r.missing).toContain("AWS");
    expect(r.missing).not.toContain("Node.js");
    // 4 keywords no JD (Node.js, TypeScript, AWS, Docker), 3 batem => 75
    expect(r.score).toBe(75);
  });

  it("gives score 0 (not NaN) when the job lists no known keywords", () => {
    const r = analyzeGap(PROFILE, "Vaga sem tecnologias reconheciveis aqui.");
    expect(r.score).toBe(0);
  });
});

describe("tailorResume", () => {
  it("floats matched skills to the front without inventing missing ones", () => {
    const jd = "Precisa de TypeScript e AWS.";
    const t = tailorResume(PROFILE, jd);
    // TypeScript (match) vem antes de Node.js na lista reordenada
    const nomes = t.profile.competencias.tecnicas.map((s) => s.nome);
    expect(nomes.indexOf("TypeScript")).toBeLessThan(nomes.indexOf("Node.js"));
    // nunca adiciona AWS (que o candidato nao tem) as competencias
    expect(nomes).not.toContain("AWS");
  });

  it("reports missing keywords as adjustment recommendations", () => {
    const t = tailorResume(PROFILE, "Precisa de AWS.");
    expect(t.ajustes.join(" ")).toContain("AWS");
    expect(t.score).toBeTypeOf("number");
  });
});
