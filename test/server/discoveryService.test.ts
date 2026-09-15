import { describe, it, expect, vi } from "vitest";
import { DiscoveryService, type ConectorHandle } from "../../src/server/discoveryService.js";
import { parseProfile, emptyProfile } from "../../src/profile/schema.js";
import type { Criterios, VagaResumo } from "../../src/connectors/types.js";

const PROFILE = parseProfile({
  ...emptyProfile(),
  competencias: { tecnicas: [{ nome: "Node.js", nivel: null }], ferramentas: [], softSkills: [] },
});

function handleFake(vagas: VagaResumo[], over: Partial<ConectorHandle> = {}): ConectorHandle {
  return {
    priorizarPoucosCandidatos: false,
    async buscar(_c: Criterios) {
      return vagas;
    },
    async detalhar(v) {
      return { ...v, descricao: `desc de ${v.link}`, campos: [] };
    },
    ...over,
  };
}

describe("DiscoveryService", () => {
  it("searches then ranks, dropping blocked companies and applying the <100 priority", async () => {
    const vagas: VagaResumo[] = [
      { id: "a", titulo: "Dev Node", empresa: "ACME", local: "Remoto", link: "la", snippet: "Node.js", candidatos: 300 },
      { id: "b", titulo: "Dev Node", empresa: "PayTech", local: "Remoto", link: "lb", snippet: "Node.js", candidatos: 20 },
      { id: "x", titulo: "Dev Node", empresa: "BairesDev", local: "Remoto", link: "lx", snippet: "Node.js", candidatos: 5 },
    ];
    const svc = new DiscoveryService(() => handleFake(vagas, { priorizarPoucosCandidatos: true }));
    const r = await svc.buscar(PROFILE, { site: "linkedin", cargo: "Node" });
    expect(r.precisaLogin).toBe(false);
    expect(r.vagas.map((v) => v.vaga.empresa)).toEqual(["PayTech", "ACME"]);
  });

  it("does not search — asks for login — when a login-required site is not logged in", async () => {
    const buscar = vi.fn(async () => [] as VagaResumo[]);
    const svc = new DiscoveryService(() =>
      handleFake([], { requerLogin: true, estaLogado: async () => false, buscar }),
    );
    const r = await svc.buscar(PROFILE, { site: "linkedin", cargo: "Node" });
    expect(r.precisaLogin).toBe(true);
    expect(r.vagas).toEqual([]);
    expect(buscar).not.toHaveBeenCalled(); // nao busca antes do login
  });

  it("searches normally once the login-required site is logged in", async () => {
    const vagas: VagaResumo[] = [{ id: "a", titulo: "Dev", empresa: "ACME", local: "Remoto", link: "la", snippet: "Node.js" }];
    const svc = new DiscoveryService(() => handleFake(vagas, { requerLogin: true, estaLogado: async () => true }));
    const r = await svc.buscar(PROFILE, { site: "linkedin", cargo: "Node" });
    expect(r.precisaLogin).toBe(false);
    expect(r.vagas).toHaveLength(1);
  });

  it("login() opens the browser for the user to sign in", async () => {
    const abrirParaLogin = vi.fn(async () => {});
    const svc = new DiscoveryService(() => handleFake([], { abrirParaLogin }));
    await svc.login("linkedin");
    expect(abrirParaLogin).toHaveBeenCalled();
  });

  it("fetches the description for a chosen vaga", async () => {
    const svc = new DiscoveryService(() => handleFake([]));
    const d = await svc.detalhar({ site: "gupy", link: "l123" });
    expect(d.descricao).toBe("desc de l123");
  });
});
