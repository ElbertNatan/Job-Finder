import { describe, it, expect } from "vitest";
import { ConnectorRegistry } from "../../src/connectors/registry.js";
import { StubConnector } from "../../src/connectors/stub.js";

describe("ConnectorRegistry", () => {
  it("registers, gets and lists connectors by site name", () => {
    const reg = new ConnectorRegistry();
    reg.register(new StubConnector("Gupy"));
    reg.register(new StubConnector("LinkedIn"));
    expect(reg.list().sort()).toEqual(["Gupy", "LinkedIn"]);
    expect(reg.get("Gupy").site).toBe("Gupy");
  });

  it("throws for an unknown site", () => {
    expect(() => new ConnectorRegistry().get("Nope")).toThrow();
  });
});

describe("StubConnector", () => {
  it("returns seeded vagas filtered by the search term", async () => {
    const c = new StubConnector("Gupy", [
      { id: "1", titulo: "Dev Backend Node", empresa: "ACME", local: "Remoto", link: "l1", snippet: "Node.js" },
      { id: "2", titulo: "Designer", empresa: "X", local: "SP", link: "l2", snippet: "Figma" },
    ]);
    const vagas = await c.buscar({ cargo: "Backend" });
    expect(vagas.map((v) => v.id)).toEqual(["1"]);
  });

  it("never auto-submits: candidatar stops at the human approval gate", async () => {
    const c = new StubConnector("Gupy");
    const r = await c.candidatar(
      { id: "1", titulo: "Dev", empresa: "ACME", local: "Remoto", link: "l1", snippet: "", descricao: "", campos: [] },
      { curriculoArquivo: "cv.pdf", carta: "ola", respostas: {} },
    );
    expect(r.precisaHumano).toBe(true);
    expect(r.status).toBe("aguardando_aprovacao");
  });
});
