import { describe, it, expect } from "vitest";
import { SITES, siteConfig } from "../../src/connectors/sites.js";

const ESPERADOS = ["linkedin", "gupy", "vagas", "infojobs", "indeed", "catho"];

describe("SITES registry", () => {
  it("has the main Brazilian sites", () => {
    for (const k of ESPERADOS) expect(SITES[k], `faltou site: ${k}`).toBeTruthy();
  });

  it("only LinkedIn prioritizes vagas with few applicants", () => {
    expect(SITES.linkedin!.priorizarPoucosCandidatos).toBe(true);
    for (const k of ESPERADOS.filter((s) => s !== "linkedin")) {
      expect(SITES[k]!.priorizarPoucosCandidatos ?? false).toBe(false);
    }
  });

  it("builds a search URL for each site that targets its domain and carries the term", () => {
    const dominios: Record<string, string> = {
      linkedin: "linkedin.com",
      gupy: "gupy.io",
      vagas: "vagas.com.br",
      infojobs: "infojobs.com.br",
      indeed: "indeed.com",
      catho: "catho.com.br",
    };
    for (const k of ESPERADOS) {
      const url = SITES[k]!.searchUrl({ cargo: "Node", localidade: "Remoto" });
      expect(url.startsWith("https://"), `${k} url`).toBe(true);
      expect(url).toContain(dominios[k]!);
      expect(url.toLowerCase()).toContain("node");
    }
  });

  it("encodes multi-word terms in query-based sites (indeed)", () => {
    const url = SITES.indeed!.searchUrl({ cargo: "Dev Node", localidade: "Sao Paulo" });
    expect(url.toLowerCase()).toContain("dev");
    expect(url.toLowerCase()).toContain("node");
    expect(url).toContain("indeed.com");
  });

  it("siteConfig throws for an unknown site", () => {
    expect(() => siteConfig("orkut")).toThrow();
  });
});
