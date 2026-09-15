import { describe, it, expect } from "vitest";
import { resolverCampo, preencherFormulario, dadosBasicosDoPerfil } from "../../src/connectors/linkedin/easyApply.js";
import { parseProfile, emptyProfile } from "../../src/profile/schema.js";
import type { CampoFormulario } from "../../src/connectors/types.js";

const campo = (over: Partial<CampoFormulario>): CampoFormulario => ({
  nome: "f",
  label: "Campo",
  obrigatorio: true,
  tipo: "texto",
  ...over,
});

const CTX = {
  curriculoArquivo: "cv.pdf",
  respostas: { "anos de experiencia com node": "8" },
  dadosBasicos: { nome: "Maria", email: "maria@x.com", telefone: "11999", cidade: "SP", linkedin: "in/maria", pretensaoSalarial: "16000" },
};

describe("resolverCampo", () => {
  it("resolves standard fields from dadosBasicos", () => {
    expect(resolverCampo(campo({ label: "E-mail" }), CTX)).toBe("maria@x.com");
    expect(resolverCampo(campo({ label: "Telefone celular" }), CTX)).toBe("11999");
    expect(resolverCampo(campo({ label: "Pretensao salarial" }), CTX)).toBe("16000");
  });

  it("resolves a file/resume field to the generated curriculo", () => {
    expect(resolverCampo(campo({ label: "Curriculo", tipo: "arquivo" }), CTX)).toBe("cv.pdf");
  });

  it("resolves a screening question from provided respostas (by label)", () => {
    expect(resolverCampo(campo({ label: "Anos de experiencia com Node" }), CTX)).toBe("8");
  });

  it("returns null when it cannot resolve", () => {
    expect(resolverCampo(campo({ label: "Qual seu signo?" }), CTX)).toBeNull();
  });
});

describe("preencherFormulario", () => {
  it("fills what it can and lists required unresolved fields as faltantes", () => {
    const campos: CampoFormulario[] = [
      campo({ nome: "email", label: "E-mail" }),
      campo({ nome: "cv", label: "Curriculo", tipo: "arquivo" }),
      campo({ nome: "signo", label: "Qual seu signo?", obrigatorio: true }),
      campo({ nome: "hobby", label: "Hobby favorito", obrigatorio: false }),
    ];
    const r = preencherFormulario(campos, CTX);
    expect(r.respostas["email"]).toBe("maria@x.com");
    expect(r.respostas["cv"]).toBe("cv.pdf");
    expect(r.faltantes.map((f) => f.nome)).toEqual(["signo"]); // obrigatorio e nao resolvido
    expect(r.faltantes.map((f) => f.nome)).not.toContain("hobby"); // opcional nao entra
  });
});

describe("dadosBasicosDoPerfil", () => {
  it("extracts the standard fields from a Profile", () => {
    const p = parseProfile({
      ...emptyProfile(),
      identificacao: { nome: "Ana", email: "ana@x.com", telefone: "119", cidade: "SP", links: { linkedin: "in/ana" } },
      preferencias: { pretensaoSalarial: "12000" },
    });
    const d = dadosBasicosDoPerfil(p);
    expect(d).toMatchObject({ nome: "Ana", email: "ana@x.com", telefone: "119", cidade: "SP", linkedin: "in/ana", pretensaoSalarial: "12000" });
  });
});
