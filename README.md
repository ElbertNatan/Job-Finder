# JobFinder Agent

Agente semi-automático de **adequação de currículo (ATS)** e **candidatura a vagas**.
Mantém um perfil-mestre do candidato, adapta o currículo para cada vaga otimizando
para ATS, descobre/ranqueia vagas e prepara a candidatura — **sempre parando para
aprovação humana antes de enviar** e **nunca inventando dados**.

> **Planejamento:** o design completo está em [`jobfinder-agente-plano.md`](./jobfinder-agente-plano.md).
> O modelo de dados que o candidato preenche está em [`perfil-candidato-modelo.md`](./perfil-candidato-modelo.md).

## Status

Este repositório contém o **núcleo verificável** do agente, com 40 testes automatizados:

| Estágio do plano | Módulo | Situação |
|---|---|---|
| 1. Perfil-Mestre | `src/profile`, `src/ingest` | ✅ schema + ingestão do `.md` de dados + merge de fontes + detecção de lacunas |
| 2. Descoberta | `src/discovery`, `src/connectors` | ✅ ranqueamento por aderência + interface plugável de conectores + stub |
| 3. Adequação/ATS | `src/tailor`, `src/render` | ✅ gap-analysis + score ATS + edições + currículo HTML (preview=PDF) |
| 3.1 Preview & revisão | `web/` (React+Vite) | ✅ UI que roda o core no navegador: preview ao vivo + propor mudanças em loop |
| 4. Candidatura | `src/connectors` | ✅ contrato com gate humano; **conector LinkedIn** (lógica testada + driver Playwright); Gupy pendente |
| 5. Rastreador | `src/tracker` | ✅ persistência JSON de candidaturas |

**Regras fixas de descoberta:** BairesDev é sempre ignorada (qualquer site); no LinkedIn,
vagas com &lt; 100 candidatos vêm primeiro. Ver `src/discovery/filtros.ts` e `rankVagas`.

**Pendente (próximas fases):** conectores reais via Playwright/computer-use (exigem contas/credenciais),
adapters de LLM (normalização de `.md` livre e reescrita de bullets), ingestão de PDF/DOCX,
e a UI React de preview/revisão.

## Requisitos

- Node.js ≥ 20

## Instalação

```bash
npm install
# opcional, para gerar PDF (alem do preview HTML):
npx playwright install chromium
```

## Uso (CLI do núcleo)

```bash
# 1) Ingerir o .md de dados brutos -> perfil.json + lista de lacunas a preencher
npx tsx src/cli/index.ts perfil --md examples/exemplo-dados.md --out saida

# 2) Adaptar o curriculo para uma vaga -> curriculo.html + relatorio ATS
npx tsx src/cli/index.ts adaptar --perfil saida/perfil.json --vaga examples/vaga-exemplo.txt --out saida
# (adicione --pdf para gerar tambem o PDF, se o Playwright estiver instalado)

# 3) Ranquear vagas por aderencia ao perfil
npx tsx src/cli/index.ts rankear --perfil saida/perfil.json --vagas examples/vagas-exemplo.json

# 4) Listar candidaturas registradas
npx tsx src/cli/index.ts tracker
```

O `curriculo.html` gerado é o **preview**: abra no navegador — é idêntico ao PDF.

## UI de Preview & Revisão

```bash
npm run web:dev     # abre o app em http://localhost:5173
npm run web:build   # build de producao em web/dist
```

A tela mostra, lado a lado, os dados (`.md`) + a vaga e o **preview do currículo ao vivo**.
No painel você **propõe mudanças** (sobrescrever resumo, ocultar experiências/competências) e
o preview + score ATS **atualizam na hora**. "Aprovar preview" marca o aceite (no fluxo completo,
o passo seguinte é o gate de submissão no site). Todo o núcleo (adequação/render) roda no navegador —
sem servidor.

## Conector do LinkedIn (busca real)

A **lógica** do conector (mapeamento, parse de nº de candidatos, bloqueio de empresas,
gate humano) é 100% testada. O **acesso ao site** usa Playwright e precisa de uma
sessão logada:

```bash
npx playwright install chromium          # uma vez
npm run linkedin -- "Engenheiro Backend" "Sao Paulo"
```

Na primeira execução, a janela do Chromium abre para você **fazer login no LinkedIn**;
a sessão fica salva em `.linkedin-session/` e é reaproveitada. O agente **não guarda senha**.
A busca já aplica suas regras: **vagas com < 100 candidatos primeiro** e **BairesDev ignorada**.
A candidatura para no **gate humano** — nunca clica em "Enviar" sozinho.

> Os seletores do LinkedIn mudam com o tempo; se a busca vier vazia, ajuste-os em
> `src/connectors/linkedin/playwrightDriver.ts` (a lógica testável não muda).

## Testes

```bash
npm test          # roda a suite (Vitest)
npm run typecheck # checagem de tipos
```

## Estrutura

```
src/
  profile/     schema canonico do perfil-mestre + merge + deteccao de lacunas
  ingest/      ingestao do .md de dados brutos -> perfil
  tailor/      gap-analysis vaga<->perfil, score ATS, reordenacao
  render/      curriculo em HTML ATS-friendly + adapter de PDF (Playwright)
  discovery/   ranqueamento de vagas por aderencia
  connectors/  interface plugavel por site + registry + stub
  tracker/     rastreador de candidaturas (JSON)
  cli/         CLI que amarra o pipeline
web/           app React+Vite de preview & revisão (roda o core no navegador)
test/          espelha src/ (TDD), incl. render da UI (jsdom)
examples/      dados e vaga de exemplo para experimentar
```

## Princípios (do plano)

- **Perfil-mestre é a fonte da verdade**; todo currículo é derivado dele.
- **Human-in-the-loop** na submissão e nos dados faltantes; sem burlar captcha/ToS.
- **Nunca inventar dado** — a adequação só reorganiza/destaca o que é verdadeiro.
- **Conectores plugáveis** por site, isolados e testáveis.
