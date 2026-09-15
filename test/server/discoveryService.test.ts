import { describe, it, expect } from "vitest";
import { DiscoveryService, type ConectorHandle } from "../../src/server/discoveryService.js";
import { parseProfile, emptyProfile } from "../../src/profile/schema.js";
import type { Criterios, VagaResumo } from "../../src/connectors/types.js";

const PROFILE = parseProfile({
  ...emptyProfile(),
  competencias: { tecnicas: [{ nome: "Node.js", nivel: null }], ferramentas: [], softSkills: [] },
});

function handleFake(vagas: VagaResumo[], priorizar: boolean): ConectorHandle {
  return {
    priorizarPoucosCandidatos: priorizar,
    async buscar(_c: Criterios) {
      return vagas;
    },
    async detalhar(v) {
      return { ...v, descricao: `desc de ${v.link}`, campos: [] };
    },
  };
}

describe("DiscoveryService", () => {
  it("searches then ranks, dropping blocked companies and applying the <100 priority", async () => {
    const vagas: VagaResumo[] = [
      { id: "a", titulo: "Dev Node", empresa: "ACME", local: "Remoto", link: "la", snippet: "Node.js", candidatos: 300 },
      { id: "b", titulo: "Dev Node", empresa: "PayTech", local: "Remoto", link: "lb", snippet: "Node.js", candidatos: 20 },
      { id: "x", titulo: "Dev Node", empresa: "BairesDev", local: "Remoto", link: "lx", snippet: "Node.js", candidatos: 5 },
    ];
    const svc = new DiscoveryService(() => handleFake(vagas, true));
    const ranked = await svc.buscar(PROFILE, { site: "linkedin", cargo: "Node" });
    expect(ranked.map((r) => r.vaga.empresa)).toEqual(["PayTech", "ACME"]); // BairesDev fora, poucos candidatos primeiro
  });

  it("fetches the description for a chosen vaga", async () => {
    const svc = new DiscoveryService(() => handleFake([], false));
    const d = await svc.detalhar({ site: "gupy", link: "l123" });
    expect(d.descricao).toBe("desc de l123");
  });
});
