# JobFinder Agent — Plano / Spec de Projeto

> **Status:** design aprovado para escrita (brainstorming). Próximo passo: virar plano de implementação.
> **Data:** 2026-09-15
> **Autor:** Elbert (infra@intersistemas.com.br) + Claude
> **Escopo desta versão:** MVP para **um candidato**, mercado **Brasil**, execução por **browser automation**, envio **semi-automático com aprovação humana**.

---

## 1. Objetivo

Construir um agente que automatiza o serviço de **adequação de currículo e candidatura a vagas**:

1. Mantém um **perfil-mestre** do candidato com *todos* os dados possíveis.
2. **Descobre vagas** adequadas navegando pelos principais sites brasileiros.
3. **Adapta o currículo** para cada vaga, otimizado para leitura por **ATS** (Applicant Tracking Systems).
4. **Preenche e cadastra** a candidatura no site, **parando para aprovação humana** antes de submeter.
5. **Registra** cada candidatura para acompanhamento.

O agente **não precisa ser 100% autônomo**: pode (e deve) interromper e perguntar ao usuário dados básicos que faltem para o cadastro. A regra é: **nunca inventar dado do candidato e nunca burlar proteção de site** (captcha, ToS, rate-limit) — nesses pontos, cai no humano.

### Não-objetivos (fora do MVP)

- Multiusuário / SaaS multi-tenant (o design deixa a porta aberta, mas o MVP é single-user).
- Fila 100% autônoma que aplica em massa sem revisão.
- Painel web sofisticado (MVP usa arquivos + um tracker simples).
- Burlar captcha, criar contas falsas, ou automatizar login de forma que viole ToS.

---

## 2. Princípios de design

- **Perfil-mestre como fonte única da verdade.** Todo currículo gerado é *derivado* do perfil; nunca se edita "o currículo" solto.
- **Human-in-the-loop nos pontos sensíveis.** Submissão de candidatura, captcha, dado ausente e qualquer ação irreversível param e pedem confirmação.
- **Conectores plugáveis por site.** Cada site (Gupy, LinkedIn, ...) é um módulo isolado com a mesma interface. Somar um site novo não mexe no núcleo.
- **Conformidade em primeiro lugar.** O agente respeita ToS e limites; degrada para "modo assistido" (prepara e o humano finaliza) quando um site proíbe automação.
- **Rastreabilidade.** Toda candidatura guarda qual versão do currículo foi enviada, para qual vaga, quando e com que status.
- **Nunca fabricar.** Se falta um dado (ex.: pretensão salarial), o agente pergunta — não preenche por conta.

---

## 3. Arquitetura — pipeline de 5 estágios

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PERFIL-MESTRE (fonte da verdade)               │
│  fontes: currículo PDF/DOCX  •  LinkedIn  •  .md de dados brutos      │
│          •  entrevista guiada (pergunta só o que falta)              │
└───────────────┬─────────────────────────────────────────────────────┘
                │
   ┌────────────▼───────────┐   ┌───────────────────┐   ┌───────────────────┐
   │ 1. DESCOBERTA DE VAGAS │──▶│ 2. ADEQUAÇÃO/ATS  │──▶│ 3. CANDIDATURA    │
   │ conectores por site    │   │ gap analysis +    │   │ preenche form +   │
   │ ranqueia aderência     │   │ currículo + carta │   │ [GATE: aprovação] │
   │                        │   │ + PREVIEW⇄revisão │   │                   │
   └────────────────────────┘   └───────────────────┘   └─────────┬─────────┘
                                                                   │
                                                        ┌──────────▼──────────┐
                                                        │ 4. RASTREADOR       │
                                                        │ log + status        │
                                                        └─────────────────────┘
```

Transversais: **armazenamento local**, **camada de conectores**, **guarda de conformidade**, **geração de documentos (PDF)**.

---

## 4. Estágio 1 — Perfil-Mestre

O coração do sistema. Um registro estruturado (JSON canônico) com todos os dados do candidato, do qual todo currículo é derivado.

### Fontes de entrada (todas opcionais, combináveis)

1. **Currículo existente** — PDF/DOCX. O agente faz *parse* e extrai o que conseguir.
2. **LinkedIn** — perfil exportado ou lido via navegador.
3. **Arquivo `.md` de dados brutos do candidato** *(fonte de primeira classe)* — um markdown "despejo de dados" que o candidato preenche livremente com tudo o que lembrar: experiências, números, projetos, cursos, links, preferências. O agente **ingere esse md, extrai e normaliza** para o perfil-mestre, e o usa para **complementar/enriquecer** o currículo que vai adaptar. Ver modelo em `perfil-candidato-modelo.md`.
4. **Entrevista guiada** — depois de ingerir as fontes acima, o agente identifica lacunas e **pergunta ao usuário apenas o que faltar** (uma pergunta de cada vez, priorizando o que mais pesa em ATS: conquistas quantificadas, palavras-chave técnicas, datas).

### Fluxo de montagem do perfil

```
ingerir fontes (PDF + LinkedIn + .md)  →  normalizar para JSON canônico
   →  detectar lacunas e inconsistências  →  entrevista guiada (só o que falta)
   →  perfil-mestre validado
```

### Esquema do perfil-mestre (canônico)

Campos previstos (o agente preenche o que tiver, marca o resto como pendente):

- **Identificação:** nome, e-mail, telefone, cidade/UF, disponibilidade de mudança, links (LinkedIn, GitHub, portfólio).
- **Objetivo/headline:** cargo-alvo, senioridade, resumo profissional.
- **Experiências:** empresa, cargo, período, local/modelo (remoto/híbrido/presencial), responsabilidades e **conquistas quantificadas** (métrica + resultado).
- **Formação:** curso, instituição, período, status.
- **Competências:** técnicas (com nível), ferramentas, idiomas (com nível).
- **Certificações / cursos.**
- **Projetos** (pessoais/open-source): descrição, stack, link.
- **Preferências de vaga:** faixa salarial pretendida, modelo de trabalho, localidades aceitas, tipos de contrato, cargos de interesse, empresas a evitar.
- **Dados de cadastro:** PCD, disponibilidade de início, pretensão salarial, autorização de trabalho — usados para responder formulários (pergunta se faltar).

O esquema completo (JSON) vira artefato do plano de implementação; este documento fixa os campos.

---

## 5. Estágio 2 — Descoberta de vagas

### Conectores por site (interface comum)

Cada conector implementa a mesma interface lógica:

- `buscar(criterios)` → lista de vagas (título, empresa, local, link, snippet da descrição).
- `detalhar(vaga)` → descrição completa + campos do formulário de candidatura.
- `candidatar(vaga, artefatos)` → preenche até o **gate de submissão** (não submete sozinho).

**Sites — ordem de implementação:**

- **MVP (fase 1):** Gupy, LinkedIn.
- **Roadmap (fase 2):** Catho, Vagas.com, Indeed BR, InfoJobs. (Arquitetura pronta para somar 99jobs, Solides, Trampos, ATS diretos.)

### Critérios de busca

Vêm das *preferências de vaga* do perfil: cargo/keywords, senioridade, cidade/remoto, faixa salarial, tipo de contrato.

### Ranqueamento de aderência

Para cada vaga encontrada, o agente calcula um **score de aderência vaga↔perfil** (match de keywords, senioridade, requisitos obrigatórios vs. desejáveis, localidade/modelo) e apresenta a lista **ordenada**, com uma justificativa curta por vaga ("bate em X e Y; falta Z"). O humano escolhe em quais avançar.

---

## 6. Estágio 3 — Adequação / ATS

Para cada vaga escolhida:

1. **Extrair** a descrição da vaga (requisitos, responsabilidades, keywords).
2. **Gap analysis** contra o perfil-mestre: o que o candidato tem, o que falta, o que dá para reforçar/reescrever.
3. **Gerar currículo adaptado**, otimizado para ATS:
   - keywords da vaga refletidas onde forem verdadeiras (sem inventar);
   - formato **limpo e parseável** (sem tabelas/colunas/imagens que quebram parser de ATS; fontes padrão; seções nomeadas de forma canônica);
   - ordem de seções e destaques ajustados ao cargo;
   - conquistas quantificadas priorizadas.
4. **Gerar carta de apresentação** e **rascunho de respostas** para perguntas comuns de formulário.
5. **Score ATS estimado** + relatório do que foi ajustado e **por quê** (transparência).

**Regra de ouro:** a adaptação **reorganiza e enfatiza** dados verdadeiros do perfil; nunca cria experiência/habilidade que o candidato não tem.

**Saídas:** `curriculo-<vaga>.pdf` (e fonte editável), `carta-<vaga>.md`, `respostas-<vaga>.md`, `relatorio-ats-<vaga>.md`.

### 6.1. Preview e ciclo de revisão (por candidatura)

Antes de qualquer envio, o agente **mostra o preview** dos artefatos exatamente como serão enviados — o **currículo renderizado** (PDF/visualização fiel), a carta e as respostas do formulário — acompanhados do **relatório de ajustes** e do **score ATS**. O usuário então pode:

- **Aprovar** — segue para o gate de submissão (Estágio 4); ou
- **Propor mudanças** — em linguagem livre ("tira o emprego X", "enfatiza liderança", "encurta o resumo", "troca a foto"). O agente aplica a mudança **no artefato derivado** (e, quando for um dado real, propõe também gravar no perfil-mestre), **regenera** currículo/carta/respostas e **mostra o preview de novo**.

O loop **preview → propor mudanças → regenerar → preview** repete até o usuário aprovar. Só então a candidatura avança. Nada é enviado sem um preview aprovado.


---

## 7. Estágio 4 — Candidatura (semi-automática)

1. O conector abre o site no **navegador real** e faz login (o usuário loga; o agente não guarda senha).
2. **Pré-condição:** o currículo/carta/respostas daquela vaga já passaram pelo **preview aprovado** do item 6.1. Se não passaram, o agente volta para o preview antes de tocar no site.
3. Preenche o formulário/cadastro com dados do perfil e os artefatos aprovados.
4. **Dado faltante → pergunta ao usuário** (pretensão salarial, disponibilidade, perguntas específicas da vaga, upload de documento).
5. **GATE de submissão:** o agente mostra o resumo final do que vai enviar (vaga, currículo aprovado, respostas) e **espera "ok" explícito** antes de clicar em enviar. Se o usuário ainda quiser mudar algo aqui, volta ao ciclo de revisão (6.1).
6. **Captcha / verificação anti-bot → passa para o humano** resolver; o agente não tenta burlar.
7. Após submeter (com aprovação), registra no rastreador.

---

## 8. Estágio 5 — Rastreador

Um log estruturado (arquivo `candidaturas.json` + visão em `candidaturas.md`) com, por candidatura:

- site, vaga, empresa, link;
- data/hora;
- **versão do currículo enviada** (referência ao arquivo);
- status (preparada / aguardando aprovação / enviada / respondida / entrevista / recusada);
- notas e próximos passos.

---

## 9. Componentes transversais

- **Armazenamento local** — uma pasta por candidato: `perfil.json`, fontes originais, currículos gerados, cartas, tracker. Sem banco no MVP.
- **Camada de conectores** — registro de conectores plugáveis; cada um isolado e testável.
- **Guarda de conformidade** — centraliza as regras: respeitar ToS, limitar frequência de requisições, cair no humano em captcha/login/submissão. Se um site proíbe automação, degrada para "modo assistido" (prepara tudo e o humano finaliza).
- **Geração de documentos** — perfil/artefatos → PDF ATS-friendly.

---

## 10. Stack — decisão

**Stack TypeScript de ponta a ponta.** A decisão gira em torno de um fato que resolve dois requisitos de uma vez (preview fiel + PDF ATS): **o currículo é um template HTML/CSS**; o mesmo HTML que renderiza o preview é o que vira PDF (impressão via Chromium). Preview = PDF, garantido. Uma só linguagem em todo o sistema (agente, UI, conectores, geração de PDF) reduz atrito e reaproveita código.

| Camada | Escolha | Por quê |
|---|---|---|
| **Núcleo do agente (back)** | **Node + TypeScript sobre o Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) | Isto *é* um agente: o SDK entrega o loop de tool-use, subagentes, MCP e **pausa para humano** (os gates dos §6.1 e §7) prontos. |
| **Frontend (preview/revisão/tracker)** | **React + Vite + TypeScript**, **Tailwind + shadcn/ui** | UI do preview do currículo, painel de propor mudanças em linguagem livre, gates de aprovação e o tracker do §8. |
| **Currículo → preview e PDF** | **Template HTML/CSS renderizado em React → `page.pdf()` do Playwright/Chromium** | Preview e PDF saem da mesma fonte. Texto selecionável, coluna única, fontes padrão, sem tabelas/imagens que quebram parser = **ATS-friendly** por construção. |
| **Automação de sites** | **Playwright (TS)** nos conectores por site; **computer-use / claude-in-chrome** como fallback | Playwright é determinístico e first-class em TS; computer-use cobre sites anti-bot/instáveis onde o seletor quebra. |
| **Ingestão de documentos** | `pdf-parse`/pdf.js (PDF), `mammoth` (DOCX), parser Markdown (o `.md` de dados brutos); **LLM normaliza para o JSON canônico** | Cobre PDF/DOCX/LinkedIn/`.md` sem sair do TS. |
| **Armazenamento** | Arquivos por candidato (`perfil.json`, `candidaturas.json`, PDFs/MD); **SQLite (better-sqlite3)** se o tracker crescer | Sem servidor de banco no MVP. |
| **Roteamento de modelo** | **Opus** para adequação/gap-analysis/decisões de match; **Haiku** para parse/classificação/ranqueamento | Filosofia "modelo por tarefa": barato no mecânico, caro só onde precisa de raciocínio. |
| **Empacotamento** | **localhost** no MVP; **Tauri** para virar app desktop distribuível (futuro) | Precisa de navegador logado + arquivos locais; Tauri é leve (vs. Electron) para empacotar depois. |

### Trade-offs registrados

- **Linguagem — TypeScript vs. Python.** Python tem parsing de currículo mais forte (pdfplumber/`unstructured`) e PDF via WeasyPrint. Mas o frontend é React de qualquer forma → Python significaria **duas linguagens**, e o preview-fiel exigiria garantir que o HTML do WeasyPrint == HTML do preview. O ganho de parsing não paga o custo. **Escolhido TS**; Python fica como plano B se o parsing de currículos reais se mostrar insuficiente.
- **Execução — browser real logado vs. APIs oficiais de ATS.** Browser real cobre qualquer site (inclusive sem API), mas é frágil a mudança de layout e sujeito a captcha → **escolhido para o MVP** por cobertura, com computer-use de fallback. APIs oficiais (Greenhouse/Lever/Workday) são robustas mas cobrem poucos sites BR → **evolução:** usar API quando existir, navegador como fallback.

---

## 11. Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Violar ToS de sites (LinkedIn etc.) | Human-in-the-loop no login e na submissão; sem burla de captcha; modo assistido onde automação é proibida. |
| ATS rejeitar por formato | Template comprovadamente parseável; validação de formato; score ATS antes de enviar. |
| Alucinar dados do candidato | Regra rígida "só reorganiza dado verdadeiro"; entrevista guiada preenche lacunas; humano revisa. |
| Layout do site mudar e quebrar o conector | Conectores isolados e testáveis; falha vira "modo assistido" sem derrubar o resto. |
| Dados sensíveis (CPF, senha) | Nunca armazenar senha; navegador logado pelo usuário; dados locais na pasta do candidato. |

---

## 12. Faseamento

- **Fase 0 — Perfil-mestre:** ingestão (PDF + LinkedIn + `.md` de dados) + entrevista guiada + esquema JSON.
- **Fase 1 — Adequação ATS:** gap analysis + geração de currículo/carta/respostas + score ATS. (Já entrega valor sozinha, mesmo sem envio automático.)
- **Fase 2 — Descoberta + conectores (Gupy, LinkedIn):** busca, ranqueamento, candidatura semi-auto com gate.
- **Fase 3 — Rastreador** e mais conectores (Catho, Vagas.com, Indeed BR, InfoJobs).
- **Fase 4 (futuro):** multiusuário, API de ATS onde houver, painel web.

---

## 13. Critérios de sucesso do MVP

- O agente monta um perfil-mestre completo a partir de um PDF + um `.md` de dados, perguntando só o que faltar.
- Para uma vaga colada/encontrada, gera um currículo ATS-friendly com score e relatório de ajustes.
- Mostra o **preview do currículo** por candidatura e aceita **propostas de mudança em loop** até o usuário aprovar, antes de qualquer envio.
- Preenche a candidatura em Gupy e LinkedIn até o gate de submissão, pedindo dados faltantes.
- Registra a candidatura no tracker.
- Nunca submete sem aprovação e nunca inventa dado.

---

## 14. Artefatos deste plano

- `jobfinder-agente-plano.md` — este documento.
- `perfil-candidato-modelo.md` — modelo do `.md` de dados brutos que o candidato preenche (fonte do Estágio 1).
```
