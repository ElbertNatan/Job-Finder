/**
 * Interface comum dos conectores por site (§5 do plano). Cada site (Gupy, LinkedIn, ...)
 * implementa JobConnector com a MESMA interface. O nucleo nao conhece nenhum site
 * especifico — so a interface. Conectores reais usam Playwright/computer-use por baixo.
 */

export interface Criterios {
  cargo: string;
  localidade?: string;
  remoto?: boolean;
  senioridade?: string;
  faixaSalarial?: string;
}

export interface VagaResumo {
  id: string;
  titulo: string;
  empresa: string;
  local: string;
  link: string;
  snippet: string;
  /** Nº de candidatos que se candidataram/clicaram (quando o site expoe — ex.: LinkedIn). null se desconhecido. */
  candidatos?: number | null;
}

export interface CampoFormulario {
  nome: string;
  label: string;
  obrigatorio: boolean;
  tipo: "texto" | "numero" | "arquivo" | "selecao" | "booleano";
  opcoes?: string[];
}

export interface VagaDetalhe extends VagaResumo {
  descricao: string;
  campos: CampoFormulario[];
}

export interface Artefatos {
  curriculoArquivo: string;
  carta: string;
  /** respostas ja conhecidas para perguntas de triagem (por label normalizado ou nome do campo). */
  respostas: Record<string, string>;
  /** dados basicos do candidato para autopreencher campos padrao do formulario. */
  dadosBasicos?: {
    nome?: string | null;
    email?: string | null;
    telefone?: string | null;
    cidade?: string | null;
    linkedin?: string | null;
    pretensaoSalarial?: string | null;
  };
}

/** Resultado de uma tentativa de candidatura. NUNCA "submetida" sem aprovacao humana. */
export interface ApplyResult {
  status: "preparada" | "aguardando_aprovacao" | "submetida" | "falha";
  precisaHumano: boolean;
  mensagem: string;
  camposFaltantes?: CampoFormulario[];
}

export interface JobConnector {
  readonly site: string;
  buscar(criterios: Criterios): Promise<VagaResumo[]>;
  detalhar(vaga: VagaResumo): Promise<VagaDetalhe>;
  /** Preenche a candidatura ate o gate de submissao — nunca clica em "enviar" sozinho. */
  candidatar(vaga: VagaDetalhe, artefatos: Artefatos): Promise<ApplyResult>;
}
