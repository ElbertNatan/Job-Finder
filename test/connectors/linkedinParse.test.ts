import { describe, it, expect } from "vitest";
import { parseCandidatos } from "../../src/connectors/linkedin/parseCandidatos.js";

describe("parseCandidatos", () => {
  it("parses a plain applicant count (en/pt)", () => {
    expect(parseCandidatos("27 applicants")).toBe(27);
    expect(parseCandidatos("48 candidaturas")).toBe(48);
    expect(parseCandidatos("120 candidatos")).toBe(120);
  });

  it("treats 'over 100' / 'mais de 100' as 100 (i.e. not under the limit)", () => {
    expect(parseCandidatos("Over 100 applicants")).toBe(100);
    expect(parseCandidatos("Mais de 100 candidatos")).toBe(100);
  });

  it("treats 'early applicant' phrasing with no number as few (0)", () => {
    expect(parseCandidatos("Seja um dos primeiros a se candidatar")).toBe(0);
    expect(parseCandidatos("Be an early applicant")).toBe(0);
  });

  it("extracts the number even in 'among the first N' phrasing", () => {
    expect(parseCandidatos("Be among the first 25 applicants")).toBe(25);
  });

  it("returns null when there is no signal", () => {
    expect(parseCandidatos("")).toBeNull();
    expect(parseCandidatos("Analista de Sistemas")).toBeNull();
  });
});
