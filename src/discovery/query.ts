import type { Profile } from "../profile/schema.js";

/**
 * Deriva o termo de busca a partir do CURRICULO — o agente pesquisa com base no
 * perfil, sem o usuario precisar digitar o cargo. Ordem de preferencia:
 * cargo-alvo -> cargos de interesse -> cargo da experiencia mais recente -> top skill.
 */
export function termosDeBusca(p: Profile): string {
  return (
    p.objetivo.cargoAlvo?.trim() ||
    p.preferencias.cargosInteresse[0]?.trim() ||
    p.experiencias[0]?.cargo?.trim() ||
    p.competencias.tecnicas[0]?.nome?.trim() ||
    ""
  );
}
