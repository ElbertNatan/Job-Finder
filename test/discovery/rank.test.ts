import { describe, it, expect } from "vitest";
import { parseProfile, emptyProfile } from "../../src/profile/schema.js";
import { rankVagas } from "../../src/discovery/rank.js";
import type { VagaResumo } from "../../src/connectors/types.js";

const PROFILE = parseProfile({
  ...emptyProfile(),
  competencias: { tecnicas: [{ nome: "Node.js", nivel: "avancado" }, { nome: "TypeScript", nivel: "avancado" }], ferramentas: [], softSkills: [] },
});

const VAGAS: VagaResumo[] = [
  { id: "py", titulo: "Dev Python", empresa: "A", local: "Remoto", link: "l1", snippet: "Buscamos Python e Django" },
  { id: "node", titulo: "Dev Node", empresa: "B", local: "Remoto", link: "l2", snippet: "Node.js e TypeScript obrigatorios" },
];

describe("rankVagas", () => {
  it("orders vagas by adherence score, best first", () => {
    const ranked = rankVagas(PROFILE, VAGAS);
    expect(ranked[0]!.vaga.id).toBe("node");
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score);
  });

  it("carries the matched keywords for each vaga", () => {
    const ranked = rankVagas(PROFILE, VAGAS);
    const node = ranked.find((r) => r.vaga.id === "node")!;
    expect(node.matched).toEqual(expect.arrayContaining(["Node.js", "TypeScript"]));
  });
});
