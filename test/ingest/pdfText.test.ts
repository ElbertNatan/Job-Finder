import { describe, it, expect } from "vitest";
import { pdfTextToDadosMd } from "../../src/ingest/pdfText.js";
import { ingestMarkdown } from "../../src/ingest/markdown.js";
import { termosDeBusca } from "../../src/discovery/query.js";

const MULTI = `Maria Silva
Engenheira de Software Senior
maria.silva@example.com | (11) 99999-0000
linkedin.com/in/mariasilva

Experiencia
ACME - Engenheira Senior - 2020 a atual
- Reduzi latencia em 40%`;

// Curriculo real costuma vir como texto corrido (pdf.js junta tudo com espacos).
const CORRIDO =
  "Elbert Natan Fernandes Morais  Desenvolvedor de Software | Full-Stack  (84)99948-1436 | elbertnatan@hotmail.com  " +
  "Resumo: solida experiencia em Grails, Groovy, Java, Spring, MySQL e PostgreSQL, com Flutter e Delphi.";

describe("pdfTextToDadosMd", () => {
  it("detects name/email/phone from a multi-line resume", () => {
    const p = ingestMarkdown(pdfTextToDadosMd(MULTI));
    expect(p.identificacao.nome).toBe("Maria Silva");
    expect(p.identificacao.email).toBe("maria.silva@example.com");
    expect(p.identificacao.telefone).toContain("99999");
    expect(p.identificacao.links.linkedin).toContain("linkedin.com/in/mariasilva");
  });

  it("keeps the full text in the free-form section so nothing is lost", () => {
    const md = pdfTextToDadosMd(MULTI);
    expect(ingestMarkdown(md).extras).toContain("Reduzi latencia em 40%");
  });

  it("extracts the name and role from flowing (single-line) resume text", () => {
    const p = ingestMarkdown(pdfTextToDadosMd(CORRIDO));
    expect(p.identificacao.nome).toBe("Elbert Natan Fernandes Morais");
    expect(p.identificacao.email).toBe("elbertnatan@hotmail.com");
    expect(p.identificacao.telefone).toContain("(84)");
    expect(p.objetivo.cargoAlvo?.toLowerCase()).toContain("desenvolvedor");
  });

  it("pulls known technical skills out of the resume text into the profile", () => {
    const p = ingestMarkdown(pdfTextToDadosMd(CORRIDO));
    const skills = p.competencias.tecnicas.map((t) => t.nome);
    expect(skills).toEqual(expect.arrayContaining(["Grails", "Groovy", "Java", "Spring", "PostgreSQL"]));
    // e por isso a busca ja tem um termo (nao fica vazia)
    expect(termosDeBusca(p)).not.toBe("");
  });

  it("produces valid (empty) data for empty input without throwing", () => {
    const p = ingestMarkdown(pdfTextToDadosMd(""));
    expect(p.identificacao.nome).toBeNull();
    expect(p.identificacao.email).toBeNull();
  });
});
