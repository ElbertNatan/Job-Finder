import { describe, it, expect } from "vitest";
import { pdfTextToDadosMd } from "../../src/ingest/pdfText.js";
import { ingestMarkdown } from "../../src/ingest/markdown.js";

const TEXTO = `Maria Silva
Engenheira de Software Senior
maria.silva@example.com | (11) 99999-0000
linkedin.com/in/mariasilva

Experiencia
ACME - Engenheira Senior - 2020 a atual
- Reduzi latencia em 40%`;

describe("pdfTextToDadosMd", () => {
  it("detects name, email, phone and linkedin from raw PDF text", () => {
    const md = pdfTextToDadosMd(TEXTO);
    const p = ingestMarkdown(md);
    expect(p.identificacao.nome).toBe("Maria Silva");
    expect(p.identificacao.email).toBe("maria.silva@example.com");
    expect(p.identificacao.telefone).toContain("99999");
    expect(p.identificacao.links.linkedin).toContain("linkedin.com/in/mariasilva");
  });

  it("keeps the full text in the free-form section so nothing is lost", () => {
    const md = pdfTextToDadosMd(TEXTO);
    expect(md).toContain("Reduzi latencia em 40%");
    expect(ingestMarkdown(md).extras).toContain("Reduzi latencia em 40%");
  });

  it("produces valid (empty) data for empty input without throwing", () => {
    const md = pdfTextToDadosMd("");
    const p = ingestMarkdown(md);
    expect(p.identificacao.nome).toBeNull();
    expect(p.identificacao.email).toBeNull();
  });
});
