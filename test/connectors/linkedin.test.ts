import { describe, it, expect } from "vitest";
import { LinkedInConnector, type LinkedInDriver, type RawCard } from "../../src/connectors/linkedin/connector.js";
import { rankVagas } from "../../src/discovery/rank.js";
import { parseProfile, emptyProfile } from "../../src/profile/schema.js";
import type { VagaDetalhe } from "../../src/connectors/types.js";

const CARDS: RawCard[] = [
  { titulo: "Dev Node", empresa: "PayTech", local: "Remoto", link: "l1", candidatosTexto: "30 candidatos" },
  { titulo: "Dev Node", empresa: "BigCo", local: "Remoto", link: "l2", candidatosTexto: "Over 100 applicants" },
  { titulo: "Dev Node", empresa: "BairesDev", local: "Remoto", link: "l3", candidatosTexto: "10 candidatos" },
];

class FakeDriver implements LinkedInDriver {
  submeteu = false;
  async buscarCards(): Promise<RawCard[]> {
    return CARDS;
  }
  async detalhe(): Promise<{ descricao: string }> {
    return { descricao: "Node.js e TypeScript" };
  }
}

const conn = () => new LinkedInConnector(new FakeDriver());

describe("LinkedInConnector", () => {
  it("maps cards to vagas parsing the applicant count", async () => {
    const vagas = await conn().buscar({ cargo: "Node" });
    const paytech = vagas.find((v) => v.empresa === "PayTech")!;
    expect(paytech.candidatos).toBe(30);
    expect(vagas.find((v) => v.empresa === "BigCo")!.candidatos).toBe(100);
  });

  it("drops blocked companies (BairesDev) at the source", async () => {
    const vagas = await conn().buscar({ cargo: "Node" });
    expect(vagas.map((v) => v.empresa)).not.toContain("BairesDev");
  });

  it("never auto-submits: candidatar stops at the human gate", async () => {
    const vaga: VagaDetalhe = { id: "l1", titulo: "Dev", empresa: "PayTech", local: "Remoto", link: "l1", snippet: "", descricao: "", campos: [] };
    const r = await conn().candidatar(vaga, { curriculoArquivo: "cv.pdf", carta: "", respostas: {} });
    expect(r.precisaHumano).toBe(true);
    expect(r.status).toBe("aguardando_aprovacao");
  });

  it("feeds the <100 applicants priority: PayTech (30) ranks above BigCo (100)", async () => {
    const profile = parseProfile({ ...emptyProfile(), competencias: { tecnicas: [{ nome: "Node.js", nivel: null }], ferramentas: [], softSkills: [] } });
    const vagas = await conn().buscar({ cargo: "Node" });
    const ranked = rankVagas(profile, vagas, { priorizarPoucosCandidatos: true, limiteCandidatos: 100 });
    expect(ranked[0]!.vaga.empresa).toBe("PayTech");
  });
});
