// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { App } from "../../web/src/App.js";

afterEach(cleanup);

describe("App (preview & revisão)", () => {
  it("mounts and renders the ATS score and the preview iframe", () => {
    render(<App />);
    // score em % aparece (o exemplo casa com a vaga de exemplo)
    expect(screen.getByText(/%$/)).toBeTruthy();
    const iframe = document.querySelector("iframe");
    expect(iframe).toBeTruthy();
    // o preview (srcDoc) contem o nome do candidato de exemplo
    expect(iframe!.getAttribute("srcdoc")).toContain("Maria Silva");
  });

  it("approving the preview shows the confirmation message", () => {
    render(<App />);
    fireEvent.click(screen.getByText("Aprovar preview"));
    expect(screen.getByText(/Preview aprovado/)).toBeTruthy();
  });

  it("hiding a technical skill removes it from the competencias section of the resume", () => {
    const count = (hay: string, needle: string) => hay.split(needle).length - 1;
    render(<App />);
    const before = document.querySelector("iframe")!.getAttribute("srcdoc")!;
    const antes = count(before, "Node.js");
    expect(antes).toBeGreaterThan(0);
    // clica no chip da competencia para oculta-la
    fireEvent.click(screen.getByRole("button", { name: "Node.js" }));
    const after = document.querySelector("iframe")!.getAttribute("srcdoc")!;
    // some da linha de competencias -> ao menos uma ocorrencia a menos
    expect(count(after, "Node.js")).toBeLessThan(antes);
  });
});
