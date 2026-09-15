// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { App } from "../../web/src/App.js";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const VAGA = {
  vaga: { id: "1", titulo: "Dev Node", empresa: "PayTech", local: "Remoto", link: "exemplo:e1", snippet: "Node.js", candidatos: 24 },
  score: 80,
  matched: ["Node.js"],
  missing: [],
};

function mockFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/buscar") return { ok: true, json: async () => ({ vagas: [VAGA] }) } as Response;
      if (url === "/api/detalhar") return { ok: true, json: async () => ({ descricao: "Requisitos: Node.js e AWS." }) } as Response;
      return { ok: false, json: async () => ({}) } as Response;
    }),
  );
}

describe("Passo de busca — origem e requisitos", () => {
  it("lists vagas from the chosen site with a source badge", async () => {
    mockFetch();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Buscar vagas" }));
    // auto-busca no modo exemplo -> a vaga aparece
    expect(await screen.findByText("Dev Node")).toBeTruthy();
    // origem (site) visivel como badge no card
    const badge = document.querySelector(".badge-site");
    expect(badge?.textContent).toBe("Exemplo (offline)");
  });

  it("shows the requirements on demand when clicking 'Ver requisitos'", async () => {
    mockFetch();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Buscar vagas" }));
    await screen.findByText("Dev Node");
    fireEvent.click(screen.getByRole("button", { name: "Ver requisitos" }));
    expect(await screen.findByText(/Requisitos: Node.js e AWS/)).toBeTruthy();
  });
});
