import { describe, it, expect } from "vitest";
import { parseProfile, emptyProfile, type Profile } from "../../src/profile/schema.js";

describe("profile schema", () => {
  it("emptyProfile() produces a value that parseProfile accepts", () => {
    const empty = emptyProfile();
    expect(() => parseProfile(empty)).not.toThrow();
    expect(parseProfile(empty).experiencias).toEqual([]);
  });

  it("accepts a fully populated profile", () => {
    const full: Profile = {
      identificacao: {
        nome: "Maria Silva",
        email: "maria@example.com",
        telefone: "+55 11 90000-0000",
        cidade: "Sao Paulo",
        uf: "SP",
        aceitaMudar: true,
        links: { linkedin: "https://linkedin.com/in/maria", github: null, portfolio: null, outros: [] },
      },
      objetivo: { cargoAlvo: "Engenheira de Software", senioridade: "senior", resumo: "10 anos de backend" },
      preferencias: {
        pretensaoSalarial: "15000",
        modeloTrabalho: "remoto",
        localidades: ["Sao Paulo", "Remoto"],
        tipoContrato: ["CLT", "PJ"],
        cargosInteresse: ["Backend", "Tech Lead"],
        empresasEvitar: [],
      },
      experiencias: [
        {
          empresa: "ACME",
          cargo: "Dev Senior",
          inicio: "2020-01",
          fim: "atual",
          local: "Sao Paulo",
          modelo: "remoto",
          descricao: "APIs em Node",
          conquistas: ["Reduzi latencia em 40%"],
          tecnologias: ["Node", "TypeScript"],
        },
      ],
      formacoes: [{ curso: "CC", instituicao: "USP", inicio: "2012", fim: "2016", status: "concluido" }],
      competencias: {
        tecnicas: [{ nome: "TypeScript", nivel: "avancado" }],
        ferramentas: ["Git"],
        softSkills: ["Comunicacao"],
      },
      idiomas: [{ idioma: "Ingles", nivel: "avancado" }],
      certificacoes: [{ nome: "AWS SAA", instituicao: "AWS", ano: "2022" }],
      projetos: [{ nome: "cli-x", descricao: "ferramenta", stack: ["Go"], link: "https://github.com/x" }],
      dadosCadastro: { pcd: false, pretensaoSalarial: "15000", viagens: true, autorizacaoTrabalho: null, cnh: null },
      extras: "Palestrante em meetups",
    };
    const parsed = parseProfile(full);
    expect(parsed.identificacao.nome).toBe("Maria Silva");
    expect(parsed.experiencias[0]?.conquistas).toContain("Reduzi latencia em 40%");
  });

  it("rejects a profile with a wrong field type", () => {
    const bad = { ...emptyProfile(), experiencias: "nope" };
    expect(() => parseProfile(bad)).toThrow();
  });
});
