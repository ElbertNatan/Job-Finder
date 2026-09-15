import * as pdfjs from "pdfjs-dist";
// Worker do pdf.js resolvido pelo Vite (bundle local, sem CDN).
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** Extrai o texto de um PDF (curriculo) no navegador, pagina a pagina. */
export async function extractPdfText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const partes: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const linha = content.items
      .map((it) => ("str" in it ? it.str : ""))
      .join(" ")
      .replace(/\s+\n/g, "\n");
    partes.push(linha);
  }
  return partes.join("\n\n");
}
