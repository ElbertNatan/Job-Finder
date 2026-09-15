// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { App } from "../../web/src/App.js";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const VAGA = {
  vaga: { id: "1", titulo: "Dev Node", empresa: "PayTech", local: "Remoto", link: "https://linkedin.com/jobs/view/1", snippet: "Node.js", candidatos: 24 },
  score: 80,
  matched: ["Node.js"],
  missing: [],
};

function mockFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/buscar") return { ok: true, json: async () => ({ vagas: [VAGA], precisaLogin: false }) } as Response;
      if (url === "/api/detalhar") return { ok: true, json: async () => ({ descricao: "Requisitos: Node.js e AWS." }) } as Response;
      return { ok: false, json: async () => ({}) } as Response;
    }),
  );
}

function irBuscar() {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Buscar vagas" })); // passo 1 -> 2
  fireEvent.click(screen.getByRole("button", { name: "Buscar" })); // dispara a busca
}

describe("Passo de busca — origem e requisitos", () => {
  it("lists vagas from the chosen site with a source badge", async () => {
    mockFetch();
    irBuscar();
    expect(await screen.findByText("Dev Node")).toBeTruthy();
    const badge = document.querySelector(".badge-site");
    expect(badge?.textContent).toBe("LinkedIn");
  });

  it("shows the requirements on demand when clicking 'Ver requisitos'", async () => {
    mockFetch();
    irBuscar();
    await screen.findByText("Dev Node");
    fireEvent.click(screen.getByRole("button", { name: "Ver requisitos" }));
    expect(await screen.findByText(/Requisitos: Node.js e AWS/)).toBeTruthy();
  });
});
