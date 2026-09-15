// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { App } from "../../web/src/App.js";

afterEach(cleanup);

function irParaRevisar() {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: /Revisar & aplicar/ }));
}

describe("App (fluxo em passos)", () => {
  it("starts on step 1 asking to start with the resume", () => {
    render(<App />);
    expect(screen.getByText("Comece pelo seu currículo")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Enviar PDF/ })).toBeTruthy();
  });

  it("on the review step, shows the ATS adherence and the preview with the candidate name", () => {
    irParaRevisar();
    expect(document.body.textContent).toContain("de aderência");
    const iframe = document.querySelector("iframe");
    expect(iframe!.getAttribute("srcdoc")).toContain("Maria Silva");
  });

  it("approving the preview shows the confirmation message", () => {
    irParaRevisar();
    fireEvent.click(screen.getByRole("button", { name: "Aprovar preview" }));
    expect(screen.getByText(/Aprovado/)).toBeTruthy();
  });

  it("hiding a technical skill removes it from the competencias section of the resume", () => {
    const count = (hay: string, needle: string) => hay.split(needle).length - 1;
    irParaRevisar();
    const before = document.querySelector("iframe")!.getAttribute("srcdoc")!;
    const antes = count(before, "Node.js");
    expect(antes).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Node.js", hidden: true }));
    const after = document.querySelector("iframe")!.getAttribute("srcdoc")!;
    expect(count(after, "Node.js")).toBeLessThan(antes);
  });
});
