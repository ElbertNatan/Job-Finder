import { describe, it, expect } from "vitest";
import { filtrarBloqueadas, EMPRESAS_BLOQUEADAS } from "../../src/discovery/filtros.js";
import { rankVagas } from "../../src/discovery/rank.js";
import { parseProfile, emptyProfile } from "../../src/profile/schema.js";
import type { VagaResumo } from "../../src/connectors/types.js";

const vaga = (over: Partial<VagaResumo>): VagaResumo => ({
  id: "x",
  titulo: "Dev",
  empresa: "ACME",
  local: "Remoto",
  link: "l",
  snippet: "Node.js",
  ...over,
});

describe("filtrarBloqueadas", () => {
  it("removes BairesDev vagas regardless of casing or suffix", () => {
    const vagas = [
      vaga({ id: "1", empresa: "ACME" }),
      vaga({ id: "2", empresa: "BairesDev" }),
      vaga({ id: "3", empresa: "bairesdev LLC" }),
    ];
    expect(filtrarBloqueadas(vagas).map((v) => v.id)).toEqual(["1"]);
  });

  it("keeps BairesDev in the default blocklist", () => {
    expect(EMPRESAS_BLOQUEADAS).toContain("bairesdev");
  });
});

const PROFILE = parseProfile({
  ...emptyProfile(),
  competencias: { tecnicas: [{ nome: "Node.js", nivel: null }], ferramentas: [], softSkills: [] },
});

describe("rankVagas", () => {
  it("always drops blocked companies (e.g. BairesDev)", () => {
    const vagas = [vaga({ id: "ok", empresa: "ACME" }), vaga({ id: "no", empresa: "BairesDev" })];
    expect(rankVagas(PROFILE, vagas).map((r) => r.vaga.id)).toEqual(["ok"]);
  });

  it("with priorizarPoucosCandidatos, puts vagas under the limit first, then by score", () => {
    const vagas = [
      vaga({ id: "muitos", snippet: "Node.js e TypeScript", candidatos: 500 }), // score alto, mas lotada
      vaga({ id: "poucos", snippet: "Node.js", candidatos: 30 }), // score menor, mas < 100
    ];
    const ranked = rankVagas(PROFILE, vagas, { priorizarPoucosCandidatos: true, limiteCandidatos: 100 });
    expect(ranked[0]!.vaga.id).toBe("poucos");
    expect(ranked[1]!.vaga.id).toBe("muitos");
  });

  it("without the option, sorts purely by score", () => {
    const vagas = [
      vaga({ id: "muitos", snippet: "Node.js", candidatos: 500 }),
      vaga({ id: "poucos", snippet: "sem match aqui", candidatos: 30 }),
    ];
    const ranked = rankVagas(PROFILE, vagas);
    expect(ranked[0]!.vaga.id).toBe("muitos");
  });
});
