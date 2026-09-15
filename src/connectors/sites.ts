import type { Criterios } from "./types.js";

/**
 * Configuracao de um site de vagas. Adicionar um site novo = adicionar uma entrada
 * aqui (URL de busca + seletores). A logica (mapeamento, filtros, gate) e a mesma
 * do BrowserConnector; o driver generico (PlaywrightSiteDriver) le esta config.
 *
 * ATENCAO: os seletores CSS abaixo sao best-effort e mudam quando os sites mudam de
 * layout. Sao a unica parte NAO testavel automaticamente (dependem do DOM ao vivo).
 * Ajuste-os conforme necessario — a URL e a logica continuam validas.
 */
export interface SiteSeletores {
  card: string;
  titulo: string;
  empresa: string;
  local: string;
  link: string;
  candidatos?: string;
  descricao: string;
}

export interface SiteConfig {
  site: string;
  searchUrl: (c: Criterios) => string;
  seletores: SiteSeletores;
  /** LinkedIn: priorizar vagas com < 100 candidatos. */
  priorizarPoucosCandidatos?: boolean;
  /** Precisa de login (contexto persistente) para funcionar. */
  requerLogin?: boolean;
  /** Pagina inicial (logada) — usada para detectar se o usuario ja esta logado. */
  homeUrl?: string;
  /** Pagina de login, aberta quando pedimos ao usuario para entrar. */
  loginUrl?: string;
}

const enc = encodeURIComponent;
const slug = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "-");

export const SITES: Record<string, SiteConfig> = {
  linkedin: {
    site: "LinkedIn",
    priorizarPoucosCandidatos: true,
    requerLogin: true,
    homeUrl: "https://www.linkedin.com/feed/",
    loginUrl: "https://www.linkedin.com/login",
    searchUrl: (c) =>
      `https://www.linkedin.com/jobs/search/?keywords=${enc(c.cargo)}` +
      (c.localidade ? `&location=${enc(c.localidade)}` : "") +
      (c.remoto ? "&f_WT=2" : "") +
      "&sortBy=DD",
    seletores: {
      card: "div.job-card-container, li.scaffold-layout__list-item",
      titulo: "a.job-card-container__link, .job-card-list__title",
      empresa: ".artdeco-entity-lockup__subtitle, .job-card-container__primary-description",
      local: ".job-card-container__metadata-item",
      link: "a.job-card-container__link, a[href*='/jobs/view/']",
      candidatos: ".job-card-container__applicant-count, .tvm__text",
      descricao: ".jobs-description__content, #job-details",
    },
  },
  gupy: {
    site: "Gupy",
    searchUrl: (c) => `https://portal.gupy.io/job-search/term=${enc(c.cargo)}`,
    seletores: {
      card: "[data-testid='job-list__listitem'], li.sc-f6a4d1a2",
      titulo: "h3, a[href*='/job/']",
      empresa: "[data-testid='job-list__company-name'], .sc-company",
      local: "[data-testid='job-list__location'], .sc-location",
      link: "a[href*='/job/']",
      descricao: "[data-testid='job-description'], .job-description",
    },
  },
  vagas: {
    site: "Vagas.com",
    searchUrl: (c) => `https://www.vagas.com.br/vagas-de-${slug(c.cargo)}`,
    seletores: {
      card: "li.vaga",
      titulo: "a.link-detalhes-vaga, h2.cargo",
      empresa: ".emprVaga",
      local: ".vaga-local",
      link: "a.link-detalhes-vaga",
      descricao: ".job-description, #corpo_da_vaga",
    },
  },
  infojobs: {
    site: "InfoJobs",
    searchUrl: (c) =>
      `https://www.infojobs.com.br/empregos.aspx?palabra=${enc(c.cargo)}` +
      (c.localidade ? `&provincia=${enc(c.localidade)}` : ""),
    seletores: {
      card: ".js_vacancyLoad, .card-vaga",
      titulo: "h2 a, a.vacancy-title",
      empresa: ".vacancy-company, .text-body",
      local: ".vacancy-location, .location",
      link: "h2 a, a.vacancy-title",
      descricao: "#VacancyHeader, .vacancy-description",
    },
  },
  indeed: {
    site: "Indeed",
    searchUrl: (c) => `https://br.indeed.com/jobs?q=${enc(c.cargo)}${c.localidade ? `&l=${enc(c.localidade)}` : ""}`,
    seletores: {
      card: "div.job_seen_beacon, td.resultContent",
      titulo: "h2.jobTitle span, a.jcs-JobTitle",
      empresa: "span.companyName, [data-testid='company-name']",
      local: "div.companyLocation, [data-testid='text-location']",
      link: "a.jcs-JobTitle, h2.jobTitle a",
      descricao: "#jobDescriptionText",
    },
  },
  catho: {
    site: "Catho",
    searchUrl: (c) => `https://www.catho.com.br/vagas/${slug(c.cargo)}/`,
    seletores: {
      card: "article.search-result-custom_jobItem, li.job-item",
      titulo: "h2 a, a.job-title",
      empresa: ".company-name, .sc-company",
      local: ".job-location, .location",
      link: "h2 a, a.job-title",
      descricao: ".job-description, #description",
    },
  },
};

export function siteConfig(key: string): SiteConfig {
  const c = SITES[key.toLowerCase()];
  if (!c) throw new Error(`Site desconhecido: ${key}. Disponiveis: ${Object.keys(SITES).join(", ")}`);
  return c;
}
