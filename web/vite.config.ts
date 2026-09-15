import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// App de preview/revisao. Importa o core (TS puro) direto de ../src — o mesmo
// tailor/render usado pela CLI e pelos testes roda aqui no navegador.
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true },
  // Em dev (vite), encaminha /api para o servidor local (npm run serve).
  server: { proxy: { "/api": "http://localhost:8787" } },
});
