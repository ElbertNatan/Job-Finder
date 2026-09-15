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
| 4. Candidatura | `src/connectors` | ✅ conector genérico + **6 sites** (LinkedIn, Gupy, Vagas.com, InfoJobs, Indeed, Catho) via config; Easy Apply com gate humano |
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

## Início rápido (Windows)

Dê **duplo clique em `JobFinder.bat`**. Na primeira vez ele instala as dependências
(e o navegador do Playwright), prepara e abre o app em **http://localhost:8787**.

No app: (1) traga seu currículo (PDF/colar) → (2) **o agente busca as vagas** nos sites
(o cargo já vem do seu currículo; você só escolhe o site — nada de colar descrição) →
(3) escolha uma vaga e revise o currículo já adaptado, com preview igual ao PDF.

> Os sites exigem login e o Chromium do Playwright (o `JobFinder.bat` instala). Na 1ª
> busca de cada site o navegador abre para você entrar; a sessão fica salva.

## O agente busca as vagas (você não cola descrição)

O passo 2 do app é uma **busca**: você informa site + cargo e o agente pesquisa,
ranqueia pelo seu perfil e mostra a lista; ao escolher uma vaga, ele mesmo pega a
descrição e adapta o currículo. A busca roda no **servidor local** (`npm run serve`,
porta 8787), porque usa Playwright (Node) — o navegador não roda os sites sozinho.

- **Sites** (`linkedin · gupy · vagas · infojobs · indeed · catho`): config-driven
  em `src/connectors/sites.ts` (URL + seletores). Abrem o navegador para você logar na
  1ª vez; a sessão fica em `.browser-session/<site>` (o agente **não guarda senha**).
- Regras sempre aplicadas: **BairesDev ignorada**; no **LinkedIn**, **vagas com < 100
  candidatos primeiro**.
- **Candidatura (Easy Apply):** o agente autopreenche o que consegue a partir do
  perfil/currículo, **lista o que faltar**, e **para na etapa de revisão** — nunca clica
  em "Enviar". Captcha/anti-bot ficam com você.

Desenvolvimento (hot reload): `npm run serve` numa aba e `npm run web:dev` noutra
(o Vite faz proxy de `/api` para o servidor). Ou linha de comando pura:

```bash
npx playwright install chromium              # uma vez, para sites reais
npm run buscar -- linkedin "Engenheiro Backend" "Sao Paulo"
```

> Os seletores dos sites mudam com o tempo; se a busca real vier vazia, ajuste-os em
> `src/connectors/sites.ts` (a lógica testável não muda).

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
