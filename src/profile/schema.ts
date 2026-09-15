import { z } from "zod";

/**
 * Perfil-Mestre — fonte unica da verdade do candidato (§4 do plano).
 * Quase tudo e opcional/nullable porque o perfil e montado incrementalmente
 * a partir de fontes parciais (PDF, LinkedIn, .md de dados, entrevista guiada).
 * A deteccao do que falta e responsabilidade de src/profile/gaps.ts.
 */

const nivelSchema = z.enum(["basico", "intermediario", "avancado", "fluente", "nativo"]).or(z.string());
const modeloTrabalhoSchema = z.enum(["remoto", "hibrido", "presencial"]).or(z.string()).nullable();

export const linksSchema = z.object({
  linkedin: z.string().nullable().default(null),
  github: z.string().nullable().default(null),
  portfolio: z.string().nullable().default(null),
  outros: z.array(z.string()).default([]),
});

export const identificacaoSchema = z.object({
  nome: z.string().nullable().default(null),
  email: z.string().nullable().default(null),
  telefone: z.string().nullable().default(null),
  cidade: z.string().nullable().default(null),
  uf: z.string().nullable().default(null),
  aceitaMudar: z.boolean().nullable().default(null),
  links: linksSchema.default(() => linksSchema.parse({})),
});

export const objetivoSchema = z.object({
  cargoAlvo: z.string().nullable().default(null),
  senioridade: z.string().nullable().default(null),
  resumo: z.string().nullable().default(null),
});

export const preferenciasSchema = z.object({
  pretensaoSalarial: z.string().nullable().default(null),
  modeloTrabalho: modeloTrabalhoSchema.default(null),
  localidades: z.array(z.string()).default([]),
  tipoContrato: z.array(z.string()).default([]),
  cargosInteresse: z.array(z.string()).default([]),
  empresasEvitar: z.array(z.string()).default([]),
});

export const experienciaSchema = z.object({
  empresa: z.string(),
  cargo: z.string(),
  inicio: z.string().nullable().default(null),
  fim: z.string().nullable().default(null),
  local: z.string().nullable().default(null),
  modelo: z.string().nullable().default(null),
  descricao: z.string().nullable().default(null),
  conquistas: z.array(z.string()).default([]),
  tecnologias: z.array(z.string()).default([]),
});

export const formacaoSchema = z.object({
  curso: z.string(),
  instituicao: z.string().nullable().default(null),
  inicio: z.string().nullable().default(null),
  fim: z.string().nullable().default(null),
  status: z.string().nullable().default(null),
});

export const competenciasSchema = z.object({
  tecnicas: z.array(z.object({ nome: z.string(), nivel: nivelSchema.nullable().default(null) })).default([]),
  ferramentas: z.array(z.string()).default([]),
  softSkills: z.array(z.string()).default([]),
});

export const idiomaSchema = z.object({ idioma: z.string(), nivel: nivelSchema.nullable().default(null) });

export const certificacaoSchema = z.object({
  nome: z.string(),
  instituicao: z.string().nullable().default(null),
  ano: z.string().nullable().default(null),
});

export const projetoSchema = z.object({
  nome: z.string(),
  descricao: z.string().nullable().default(null),
  stack: z.array(z.string()).default([]),
  link: z.string().nullable().default(null),
});

export const dadosCadastroSchema = z.object({
  pcd: z.boolean().nullable().default(null),
  pretensaoSalarial: z.string().nullable().default(null),
  viagens: z.boolean().nullable().default(null),
  autorizacaoTrabalho: z.string().nullable().default(null),
  cnh: z.string().nullable().default(null),
});

export const profileSchema = z.object({
  identificacao: identificacaoSchema.default(() => identificacaoSchema.parse({})),
  objetivo: objetivoSchema.default(() => objetivoSchema.parse({})),
  preferencias: preferenciasSchema.default(() => preferenciasSchema.parse({})),
  experiencias: z.array(experienciaSchema).default([]),
  formacoes: z.array(formacaoSchema).default([]),
  competencias: competenciasSchema.default(() => competenciasSchema.parse({})),
  idiomas: z.array(idiomaSchema).default([]),
  certificacoes: z.array(certificacaoSchema).default([]),
  projetos: z.array(projetoSchema).default([]),
  dadosCadastro: dadosCadastroSchema.default(() => dadosCadastroSchema.parse({})),
  extras: z.string().nullable().default(null),
});

export type Profile = z.infer<typeof profileSchema>;
export type Experiencia = z.infer<typeof experienciaSchema>;

/** Valida e normaliza um objeto arbitrario para um Profile completo (com defaults). */
export function parseProfile(input: unknown): Profile {
  return profileSchema.parse(input);
}

/** Um perfil vazio, valido, para ser preenchido incrementalmente. */
export function emptyProfile(): Profile {
  return profileSchema.parse({});
}
