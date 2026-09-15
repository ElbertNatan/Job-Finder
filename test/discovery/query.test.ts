import { describe, it, expect } from "vitest";
import { parseProfile, emptyProfile } from "../../src/profile/schema.js";
import { termosDeBusca } from "../../src/discovery/query.js";

describe("termosDeBusca", () => {
  it("prefers the target role (objetivo.cargoAlvo)", () => {
    const p = parseProfile({ ...emptyProfile(), objetivo: { cargoAlvo: "Engenheira de Software" } });
    expect(termosDeBusca(p)).toBe("Engenheira de Software");
  });

  it("falls back to cargos de interesse", () => {
    const p = parseProfile({ ...emptyProfile(), preferencias: { cargosInteresse: ["Backend", "Tech Lead"] } });
    expect(termosDeBusca(p)).toBe("Backend");
  });

  it("falls back to the most recent experience role", () => {
    const p = parseProfile({ ...emptyProfile(), experiencias: [{ empresa: "ACME", cargo: "Dev Senior" }] });
    expect(termosDeBusca(p)).toBe("Dev Senior");
  });

  it("falls back to the top technical skill", () => {
    const p = parseProfile({ ...emptyProfile(), competencias: { tecnicas: [{ nome: "Node.js", nivel: null }], ferramentas: [], softSkills: [] } });
    expect(termosDeBusca(p)).toBe("Node.js");
  });

  it("returns empty string when there is nothing to go on", () => {
    expect(termosDeBusca(emptyProfile())).toBe("");
  });
});
