import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileTracker } from "../../src/tracker/tracker.js";

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "jf-tracker-"));
  file = join(dir, "candidaturas.json");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("FileTracker", () => {
  it("starts empty when the file does not exist", () => {
    expect(new FileTracker(file).list()).toEqual([]);
  });

  it("adds a candidatura with a generated id, default status and persists it", () => {
    const t = new FileTracker(file);
    const c = t.add({ site: "Gupy", vaga: "Dev Backend", empresa: "ACME", link: "https://gupy/x", curriculoArquivo: "cv-acme.pdf" });
    expect(c.id).toBeTruthy();
    expect(c.status).toBe("preparada");
    // recarrega de um novo tracker apontando pro mesmo arquivo -> persistiu
    expect(new FileTracker(file).list().map((x) => x.vaga)).toEqual(["Dev Backend"]);
  });

  it("updates the status of an existing candidatura", () => {
    const t = new FileTracker(file);
    const c = t.add({ site: "LinkedIn", vaga: "SRE", empresa: "X", link: "l", curriculoArquivo: "cv.pdf" });
    t.setStatus(c.id, "enviada");
    expect(new FileTracker(file).list()[0]!.status).toBe("enviada");
  });

  it("throws when updating a non-existent id", () => {
    expect(() => new FileTracker(file).setStatus("nope", "enviada")).toThrow();
  });
});
