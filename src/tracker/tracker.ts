import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

/** Estados do ciclo de uma candidatura (§8 do plano). */
export const STATUS = ["preparada", "aguardando_aprovacao", "enviada", "respondida", "entrevista", "recusada"] as const;
export type Status = (typeof STATUS)[number];

export interface Candidatura {
  id: string;
  site: string;
  vaga: string;
  empresa: string;
  link: string;
  data: string; // ISO
  curriculoArquivo: string;
  status: Status;
  notas: string;
}

export type NovaCandidatura = Omit<Candidatura, "id" | "data" | "status" | "notas"> & {
  status?: Status;
  notas?: string;
};

/** Rastreador persistido em um arquivo JSON (§8). Um registro por candidatura. */
export class FileTracker {
  constructor(private readonly file: string) {}

  list(): Candidatura[] {
    if (!existsSync(this.file)) return [];
    const raw = readFileSync(this.file, "utf-8").trim();
    if (!raw) return [];
    return JSON.parse(raw) as Candidatura[];
  }

  add(nova: NovaCandidatura): Candidatura {
    const c: Candidatura = {
      id: randomUUID(),
      data: new Date().toISOString(),
      status: nova.status ?? "preparada",
      notas: nova.notas ?? "",
      site: nova.site,
      vaga: nova.vaga,
      empresa: nova.empresa,
      link: nova.link,
      curriculoArquivo: nova.curriculoArquivo,
    };
    const all = this.list();
    all.push(c);
    this.persist(all);
    return c;
  }

  setStatus(id: string, status: Status): Candidatura {
    const all = this.list();
    const c = all.find((x) => x.id === id);
    if (!c) throw new Error(`Candidatura nao encontrada: ${id}`);
    c.status = status;
    this.persist(all);
    return c;
  }

  private persist(all: Candidatura[]): void {
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(all, null, 2), "utf-8");
  }
}
