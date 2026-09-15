/**
 * Converte o TEXTO cru extraido de um PDF de curriculo num markdown no formato de
 * `perfil-candidato-modelo.md`, detectando por heuristica os campos obvios (nome,
 * e-mail, telefone, LinkedIn) e preservando TODO o texto na secao livre — assim
 * nada se perde e o usuario revisa/organiza depois. Nao inventa dado.
 *
 * A extracao do texto do PDF (pdf.js) fica em web/src/pdf.ts (roda no navegador);
 * esta transformacao e pura e testavel.
 */

function primeiraLinhaNome(linhas: string[]): string {
  for (const l of linhas) {
    const t = l.trim();
    if (!t) continue;
    // nome plausivel: 2 a 4 palavras, so letras/acentos/espaco, sem digitos nem @
    if (/^[A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ.]+){1,3}$/.test(t) && t.length <= 60 && !/curriculo|curriculum|vitae|resume/i.test(t)) {
      return t;
    }
  }
  return "";
}

export function pdfTextToDadosMd(texto: string): string {
  const linhas = texto.split(/\r?\n/);
  const nome = primeiraLinhaNome(linhas);
  const email = texto.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? "";
  const linkedin = texto.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s|,)]+/i)?.[0] ?? "";
  const telefone = texto.match(/\+?\d[\d\s().-]{7,}\d/)?.[0]?.trim() ?? "";

  const extras = texto.trim();

  return `# Perfil do Candidato

## 1. Identificacao
- **Nome completo:** ${nome}
- **E-mail:** ${email}
- **Telefone / WhatsApp:** ${telefone}
- **LinkedIn:** ${linkedin}

## 11. Qualquer outra coisa
${extras}
`;
}
