import { describe, it, expect } from "vitest";
import { BrowserConnector, type SiteDriver, type RawCard } from "../../src/connectors/browserConnector.js";
import type { CampoFormulario, VagaDetalhe, Artefatos } from "../../src/connectors/types.js";

const vaga: VagaDetalhe = { id: "1", titulo: "Dev", empresa: "ACME", local: "Remoto", link: "l1", snippet: "", descricao: "", campos: [] };

const artefatos = (respostas: Record<string, string> = {}): Artefatos => ({
  curriculoArquivo: "cv.pdf",
  carta: "ola",
  respostas,
  dadosBasicos: { nome: "Maria", email: "maria@x.com", telefone: "119" },
});

class EasyApplyDriver implements SiteDriver {
  preenchidoCom: Record<string, string> | null = null;
  constructor(private campos: CampoFormulario[]) {}
  async buscarCards(): Promise<RawCard[]> {
    return [];
  }
  async detalhe() {
    return { descricao: "" };
  }
  async extrairCampos() {
    return this.campos;
  }
  async preencherAteRevisao(_link: string, respostas: Record<string, string>) {
    this.preenchidoCom = respostas;
  }
}

const campo = (o: Partial<CampoFormulario>): CampoFormulario => ({ nome: "f", label: "Campo", obrigatorio: true, tipo: "texto", ...o });

describe("BrowserConnector easy-apply", () => {
  it("returns camposFaltantes and does NOT fill when a required field is unresolved", async () => {
    const driver = new EasyApplyDriver([campo({ nome: "signo", label: "Qual seu signo?" })]);
    const conn = new BrowserConnector("Gupy", driver);
    const r = await conn.candidatar(vaga, artefatos());
    expect(r.precisaHumano).toBe(true);
    expect(r.camposFaltantes?.map((f) => f.nome)).toEqual(["signo"]);
    expect(driver.preenchidoCom).toBeNull(); // nao preencheu nada
  });

  it("fills up to the review step but never submits when all fields resolve", async () => {
    const driver = new EasyApplyDriver([
      campo({ nome: "email", label: "E-mail" }),
      campo({ nome: "cv", label: "Curriculo", tipo: "arquivo" }),
      campo({ nome: "exp", label: "Anos com Node" }),
    ]);
    const conn = new BrowserConnector("Gupy", driver);
    const r = await conn.candidatar(vaga, artefatos({ "anos com node": "8" }));
    expect(r.status).toBe("aguardando_aprovacao");
    expect(r.precisaHumano).toBe(true);
    expect(driver.preenchidoCom).toMatchObject({ email: "maria@x.com", cv: "cv.pdf", exp: "8" });
  });

  it("without extrairCampos, just prepares to the human gate", async () => {
    const driver: SiteDriver = { buscarCards: async () => [], detalhe: async () => ({ descricao: "" }) };
    const r = await new BrowserConnector("Vagas.com", driver).candidatar(vaga, artefatos());
    expect(r.status).toBe("aguardando_aprovacao");
    expect(r.camposFaltantes).toBeUndefined();
  });
});
