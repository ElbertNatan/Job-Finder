import { describe, it, expect } from "vitest";
import { ingestMarkdown } from "../../src/ingest/markdown.js";

const SAMPLE = `# Perfil do Candidato

## 1. Identificacao
- **Nome completo:** Maria Silva
- **E-mail:** maria@example.com
- **Telefone / WhatsApp:**
- **Cidade / UF:** Sao Paulo / SP
- **Aceita mudar de cidade?** sim
- **LinkedIn:** https://linkedin.com/in/maria
- **GitHub / portfolio / site:** https://github.com/maria

## 2. Objetivo profissional
- **Cargo(s) que busca:** Engenheira de Software
- **Senioridade:** senior
- **Resumo em 2-3 linhas:** 10 anos de backend

## 3. Preferencias de vaga
- **Faixa salarial pretendida:** 15000
- **Modelo de trabalho:** remoto
- **Localidades que aceita:** Sao Paulo, Remoto
- **Tipo de contrato:** CLT, PJ
- **Empresas / setores a evitar:**

## 4. Experiencias profissionais
### Experiencia 1
- **Empresa:** ACME
- **Cargo:** Dev Senior
- **Periodo:** 2020-01 - atual
- **O que voce fazia:** APIs em Node
- **Conquistas / resultados (com numeros):** Reduzi latencia em 40%; Liderei 3 devs
- **Tecnologias / ferramentas usadas:** Node, TypeScript

### Experiencia 2
- **Empresa:** Startup X
- **Cargo:** Dev Pleno
- **Periodo:** 2017 - 2020
- **O que voce fazia:** Frontend
- **Tecnologias / ferramentas usadas:** React

## 5. Formacao
### Formacao 1
- **Curso:** Ciencia da Computacao
- **Instituicao:** USP
- **Periodo:** 2012 - 2016
- **Status:** concluido

## 6. Competencias
- **Tecnicas (com nivel, se souber):** TypeScript, SQL
- **Ferramentas / plataformas:** Git, Docker
- **Soft skills:** Comunicacao, Lideranca

## 7. Idiomas
- **Idioma - nivel:** Ingles - avancado
- **Idioma - nivel:** Espanhol - basico

## 8. Certificacoes e cursos livres
- **Certificacao / curso - instituicao - ano:** AWS SAA - AWS - 2022

## 9. Projetos
### Projeto 1
- **Nome:** cli-x
- **Descricao:** ferramenta de linha de comando
- **Stack:** Go
- **Link:** https://github.com/maria/cli-x

## 10. Dados para formularios de candidatura
- **PCD?** nao
- **Pretensao salarial (para formulario):** 15000
- **Disponibilidade para viagens?** sim

## 11. Qualquer outra coisa
Palestrante em meetups e mantenedora open-source.
`;

describe("ingestMarkdown", () => {
  it("extracts identification fields, splitting Cidade / UF", () => {
    const p = ingestMarkdown(SAMPLE);
    expect(p.identificacao.nome).toBe("Maria Silva");
    expect(p.identificacao.email).toBe("maria@example.com");
    expect(p.identificacao.cidade).toBe("Sao Paulo");
    expect(p.identificacao.uf).toBe("SP");
    expect(p.identificacao.aceitaMudar).toBe(true);
    expect(p.identificacao.links.linkedin).toBe("https://linkedin.com/in/maria");
    expect(p.identificacao.links.github).toBe("https://github.com/maria");
  });

  it("leaves empty-valued fields as null (does not invent data)", () => {
    const p = ingestMarkdown(SAMPLE);
    expect(p.identificacao.telefone).toBeNull();
    expect(p.preferencias.empresasEvitar).toEqual([]);
  });

  it("extracts objetivo", () => {
    const p = ingestMarkdown(SAMPLE);
    expect(p.objetivo.cargoAlvo).toBe("Engenheira de Software");
    expect(p.objetivo.senioridade).toBe("senior");
    expect(p.objetivo.resumo).toBe("10 anos de backend");
  });

  it("extracts preferencias with list splitting", () => {
    const p = ingestMarkdown(SAMPLE);
    expect(p.preferencias.pretensaoSalarial).toBe("15000");
    expect(p.preferencias.modeloTrabalho).toBe("remoto");
    expect(p.preferencias.localidades).toEqual(["Sao Paulo", "Remoto"]);
    expect(p.preferencias.tipoContrato).toEqual(["CLT", "PJ"]);
  });

  it("extracts multiple experiences with achievements/technologies", () => {
    const p = ingestMarkdown(SAMPLE);
    expect(p.experiencias).toHaveLength(2);
    const e = p.experiencias[0]!;
    expect(e.empresa).toBe("ACME");
    expect(e.cargo).toBe("Dev Senior");
    expect(e.descricao).toBe("APIs em Node");
    expect(e.conquistas).toEqual(["Reduzi latencia em 40%", "Liderei 3 devs"]);
    expect(e.tecnologias).toEqual(["Node", "TypeScript"]);
    expect(p.experiencias[1]!.empresa).toBe("Startup X");
  });

  it("extracts formacao", () => {
    const p = ingestMarkdown(SAMPLE);
    expect(p.formacoes[0]).toMatchObject({ curso: "Ciencia da Computacao", instituicao: "USP", status: "concluido" });
  });

  it("extracts competencias with names", () => {
    const p = ingestMarkdown(SAMPLE);
    expect(p.competencias.tecnicas.map((t) => t.nome)).toEqual(["TypeScript", "SQL"]);
    expect(p.competencias.ferramentas).toEqual(["Git", "Docker"]);
    expect(p.competencias.softSkills).toEqual(["Comunicacao", "Lideranca"]);
  });

  it("extracts multiple languages as {idioma, nivel}", () => {
    const p = ingestMarkdown(SAMPLE);
    expect(p.idiomas).toEqual([
      { idioma: "Ingles", nivel: "avancado" },
      { idioma: "Espanhol", nivel: "basico" },
    ]);
  });

  it("extracts certificacoes and projetos", () => {
    const p = ingestMarkdown(SAMPLE);
    expect(p.certificacoes[0]).toMatchObject({ nome: "AWS SAA", instituicao: "AWS", ano: "2022" });
    expect(p.projetos[0]).toMatchObject({ nome: "cli-x", link: "https://github.com/maria/cli-x" });
    expect(p.projetos[0]!.stack).toEqual(["Go"]);
  });

  it("extracts dadosCadastro booleans and extras free text", () => {
    const p = ingestMarkdown(SAMPLE);
    expect(p.dadosCadastro.pcd).toBe(false);
    expect(p.dadosCadastro.viagens).toBe(true);
    expect(p.extras).toContain("Palestrante em meetups");
  });

  it("returns a schema-valid profile even for empty input", () => {
    const p = ingestMarkdown("");
    expect(p.experiencias).toEqual([]);
    expect(p.identificacao.nome).toBeNull();
  });
});
