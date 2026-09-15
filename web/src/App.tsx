import { useMemo, useRef, useState } from "react";
import { ingestMarkdown } from "../../src/ingest/markdown.js";
import { pdfTextToDadosMd } from "../../src/ingest/pdfText.js";
import { detectGaps } from "../../src/profile/gaps.js";
import { termosDeBusca } from "../../src/discovery/query.js";
import { tailorResume } from "../../src/tailor/ats.js";
import { applyResumeEdits, type ResumeEdits } from "../../src/tailor/edits.js";
import { renderResumeHtml } from "../../src/render/html.js";
import type { VagaRankeada } from "../../src/discovery/rank.js";
import { extractPdfText } from "./pdf.js";
import exemploMd from "../../examples/exemplo-dados.md?raw";
import exemploVaga from "../../examples/vaga-exemplo.txt?raw";

type Passo = 1 | 2 | 3;
const PASSOS: { n: Passo; titulo: string; ajuda: string }[] = [
  { n: 1, titulo: "Currículo", ajuda: "De onde vêm os seus dados" },
  { n: 2, titulo: "Buscar vaga", ajuda: "O agente pesquisa para você" },
  { n: 3, titulo: "Revisar & aplicar", ajuda: "Ajuste e finalize" },
];

const SITES: { v: string; nome: string }[] = [
  { v: "linkedin", nome: "LinkedIn" },
  { v: "gupy", nome: "Gupy" },
  { v: "vagas", nome: "Vagas.com" },
  { v: "infojobs", nome: "InfoJobs" },
  { v: "indeed", nome: "Indeed" },
  { v: "catho", nome: "Catho" },
];

export function App() {
  const [passo, setPasso] = useState<Passo>(1);
  const [md, setMd] = useState<string>(exemploMd);
  const [fonteDados, setFonteDados] = useState<string>("exemplo");
  const [editandoDados, setEditandoDados] = useState(false);
  const [pdfMsg, setPdfMsg] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Passo 2 — busca de vagas (o agente pesquisa, com base no currículo)
  const [site, setSite] = useState<string>("linkedin");
  const [cargoOverride, setCargoOverride] = useState<string | null>(null);
  const [localBusca, setLocalBusca] = useState<string>("Remoto");
  const [vagas, setVagas] = useState<VagaRankeada[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erroBusca, setErroBusca] = useState<string>("");
  const [modoManual, setModoManual] = useState(false);
  const [expandido, setExpandido] = useState<Set<string>>(new Set());
  const [detalhes, setDetalhes] = useState<Record<string, string>>({});
  const [carregandoDet, setCarregandoDet] = useState<Set<string>>(new Set());
  const [precisaLogin, setPrecisaLogin] = useState(false);
  const [abrindoLogin, setAbrindoLogin] = useState(false);

  // Passo 3
  const [jobText, setJobText] = useState<string>(exemploVaga);
  const [vagaEscolhida, setVagaEscolhida] = useState<string>("");
  const [resumo, setResumo] = useState<string | null>(null);
  const [ocultarExp, setOcultarExp] = useState<Set<number>>(new Set());
  const [ocultarComp, setOcultarComp] = useState<Set<string>>(new Set());
  const [aprovado, setAprovado] = useState(false);

  const { html, score, ajustes, experiencias, tecnicas, gaps, queryCurriculo } = useMemo(() => {
    const profile = ingestMarkdown(md);
    const tailored = tailorResume(profile, jobText);
    const edits: ResumeEdits = {
      resumo: resumo ?? undefined,
      ocultarExperiencias: [...ocultarExp],
      ocultarCompetencias: [...ocultarComp],
    };
    const edited = applyResumeEdits(tailored.profile, edits);
    return {
      html: renderResumeHtml(edited),
      score: tailored.score,
      ajustes: tailored.ajustes,
      experiencias: tailored.profile.experiencias,
      tecnicas: tailored.profile.competencias.tecnicas,
      gaps: detectGaps(profile),
      queryCurriculo: termosDeBusca(profile),
    };
  }, [md, jobText, resumo, ocultarExp, ocultarComp]);

  const cargoEfetivo = cargoOverride ?? queryCurriculo;
  const nomeSite = SITES.find((s) => s.v === site)?.nome ?? site;

  const toggle = <T,>(set: Set<T>, key: T): Set<T> => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  };

  async function onPdf(file: File | undefined) {
    if (!file) return;
    setPdfMsg("Lendo o PDF…");
    try {
      const texto = await extractPdfText(file);
      setMd(pdfTextToDadosMd(texto));
      setFonteDados("pdf");
      setEditandoDados(true);
      setPdfMsg(`Importado de ${file.name}. Revise e complete abaixo.`);
    } catch {
      setPdfMsg("Não consegui ler esse PDF. Tente colar os dados em texto.");
    }
  }

  async function buscarVagas() {
    setBuscando(true);
    setErroBusca("");
    setPrecisaLogin(false);
    setVagas(null);
    try {
      const resp = await fetch("/api/buscar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ site, cargo: cargoEfetivo, localidade: localBusca, profileMd: md }),
      });
      const data = (await resp.json().catch(() => ({}))) as { vagas?: VagaRankeada[]; precisaLogin?: boolean; erro?: string };
      if (!resp.ok) {
        setErroBusca(`A busca em ${nomeSite} falhou: ${data.erro ?? resp.status}. Se persistir, verifique o Chromium do Playwright.`);
        return;
      }
      if (data.precisaLogin) {
        setPrecisaLogin(true);
        return;
      }
      setVagas(data.vagas ?? []);
    } catch {
      setErroBusca(
        "Não consegui falar com o servidor. Abra o app pelo JobFinder.bat (ou rode `npm run serve`) — ou cole a descrição manualmente.",
      );
    } finally {
      setBuscando(false);
    }
  }

  async function abrirLogin() {
    setAbrindoLogin(true);
    try {
      await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ site }),
      });
    } catch {
      /* a janela do navegador abre pelo servidor; erro aqui nao impede o login */
    } finally {
      setAbrindoLogin(false);
    }
  }

  async function verRequisitos(r: VagaRankeada) {
    const link = r.vaga.link;
    setExpandido((s) => toggle(s, link));
    if (detalhes[link] !== undefined) return; // ja carregado
    setCarregandoDet((s) => new Set(s).add(link));
    try {
      const resp = await fetch("/api/detalhar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ site, link }),
      });
      const data = (await resp.json().catch(() => ({}))) as { descricao?: string };
      setDetalhes((d) => ({ ...d, [link]: data.descricao?.trim() || r.vaga.snippet || "Sem descrição disponível." }));
    } catch {
      setDetalhes((d) => ({ ...d, [link]: "Não consegui carregar os requisitos agora." }));
    } finally {
      setCarregandoDet((s) => {
        const n = new Set(s);
        n.delete(link);
        return n;
      });
    }
  }

  async function escolherVaga(r: VagaRankeada) {
    setVagaEscolhida(`${r.vaga.titulo} — ${r.vaga.empresa}`);
    try {
      const resp = await fetch("/api/detalhar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ site, link: r.vaga.link }),
      });
      const data = (await resp.json()) as { descricao: string };
      setJobText(data.descricao || `${r.vaga.titulo}. ${r.vaga.snippet}`);
    } catch {
      setJobText(`${r.vaga.titulo}. ${r.vaga.snippet}`);
    }
    setPasso(3);
  }

  function baixarHtml() {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "curriculo.html";
    a.click();
    URL.revokeObjectURL(url);
  }

  const nivel = score >= 75 ? "alto" : score >= 50 ? "medio" : "baixo";
  const candLabel = (n: number | null | undefined) => (n != null ? `${n} candidatos` : "candidatos: —");

  return (
    <div className="shell">
      <nav className="rail" aria-label="Etapas">
        <div className="brand">
          <span className="brand-mark" aria-hidden>◎</span>
          <span className="brand-name">JobFinder</span>
        </div>
        <ol className="steps">
          {PASSOS.map((p) => (
            <li key={p.n}>
              <button
                className={`step ${passo === p.n ? "atual" : ""} ${passo > p.n ? "feito" : ""}`}
                onClick={() => setPasso(p.n)}
                aria-current={passo === p.n ? "step" : undefined}
              >
                <span className="step-num">{passo > p.n ? "✓" : p.n}</span>
                <span className="step-txt">
                  <strong>{p.titulo}</strong>
                  <small>{p.ajuda}</small>
                </span>
              </button>
            </li>
          ))}
        </ol>
        <div className="rail-score">
          <span className="rail-score-label">Aderência ATS</span>
          <div className={`meter n-${nivel}`}>
            <span style={{ width: `${score}%` }} />
          </div>
          <span className="rail-score-val">{score}%</span>
        </div>
      </nav>

      <main className="work">
        {passo === 1 && (
          <section className="panel">
            <header className="panel-head">
              <h1>Comece pelo seu currículo</h1>
              <p>Envie um PDF, cole seus dados ou use o exemplo. Depois o agente busca as vagas para você.</p>
            </header>

            <div className="fontes">
              <button className="fonte destaque" onClick={() => fileRef.current?.click()}>
                <span className="fonte-ic" aria-hidden>⇪</span>
                <strong>Enviar PDF</strong>
                <small>Importa seu currículo atual</small>
              </button>
              <button
                className={`fonte ${fonteDados === "colar" ? "sel" : ""}`}
                onClick={() => {
                  setFonteDados("colar");
                  setEditandoDados(true);
                }}
              >
                <span className="fonte-ic" aria-hidden>✎</span>
                <strong>Colar dados</strong>
                <small>Escreva no formato guiado</small>
              </button>
              <button
                className={`fonte ${fonteDados === "exemplo" ? "sel" : ""}`}
                onClick={() => {
                  setMd(exemploMd);
                  setFonteDados("exemplo");
                  setEditandoDados(false);
                  setPdfMsg("");
                }}
              >
                <span className="fonte-ic" aria-hidden>◇</span>
                <strong>Usar exemplo</strong>
                <small>Ver como funciona</small>
              </button>
              <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={(e) => onPdf(e.target.files?.[0])} />
            </div>
            {pdfMsg && <p className="aviso">{pdfMsg}</p>}

            {gaps.length > 0 ? (
              <div className="gaps">
                <h2>Para um currículo mais forte, complete:</h2>
                <ul>
                  {gaps.map((g) => (
                    <li key={g.campo}>{g.pergunta}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="tudo-certo">✓ Dados essenciais completos.</p>
            )}

            <button className="link-editar" onClick={() => setEditandoDados((v) => !v)}>
              {editandoDados ? "Ocultar dados" : "Ver / editar dados"}
            </button>
            {editandoDados && (
              <textarea className="dados" value={md} onChange={(e) => setMd(e.target.value)} rows={14} spellCheck={false} />
            )}

            <div className="nav">
              <span />
              <button className="btn primario" onClick={() => setPasso(2)}>
                Buscar vagas
              </button>
            </div>
          </section>
        )}

        {passo === 2 && (
          <section className="panel">
            <header className="panel-head">
              <h1>O agente busca as vagas</h1>
              <p>
                A busca sai do seu currículo — você não precisa digitar o cargo. Escolha o site e busque; ele ignora a
                BairesDev e, no LinkedIn, prioriza vagas com menos de 100 candidatos.
              </p>
            </header>

            <div className="busca-form">
              <label className="campo-inline">
                <span>Site</span>
                <select
                  value={site}
                  onChange={(e) => {
                    setSite(e.target.value);
                    setVagas(null);
                    setPrecisaLogin(false);
                    setErroBusca("");
                  }}
                >
                  {SITES.map((s) => (
                    <option key={s.v} value={s.v}>
                      {s.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="campo-inline cresce">
                <span>Cargo (do seu currículo — ajuste se quiser)</span>
                <input
                  type="text"
                  value={cargoEfetivo}
                  onChange={(e) => setCargoOverride(e.target.value)}
                  placeholder="detectado a partir do currículo"
                />
              </label>
              <label className="campo-inline">
                <span>Local</span>
                <input type="text" value={localBusca} onChange={(e) => setLocalBusca(e.target.value)} placeholder="Remoto, SP…" />
              </label>
              <button className="btn primario" onClick={buscarVagas} disabled={buscando || !cargoEfetivo.trim()}>
                {buscando ? "Buscando…" : "Buscar"}
              </button>
            </div>

            {erroBusca && <p className="aviso erro">{erroBusca}</p>}

            {precisaLogin && (
              <div className="login-box">
                <strong>Faça login no {nomeSite} para o agente buscar</strong>
                <p>Vai abrir uma janela do navegador. Entre na sua conta e depois volte aqui e clique em “Já entrei”.</p>
                <div className="nav-final">
                  <button className="btn" onClick={abrirLogin} disabled={abrindoLogin}>
                    {abrindoLogin ? "Abrindo janela…" : `Abrir login do ${nomeSite}`}
                  </button>
                  <button className="btn primario" onClick={buscarVagas}>
                    Já entrei — buscar
                  </button>
                </div>
              </div>
            )}

            {vagas && vagas.length === 0 && (
              <p className="aviso">
                Nenhuma vaga capturada. Se elas aparecem na janela do {nomeSite} mas não aqui, os seletores do site podem ter
                mudado (ajuste em src/connectors/sites.ts). Tente rolar a página aberta e buscar de novo.
              </p>
            )}

            {vagas && vagas.length > 0 && (
              <ul className="vagas">
                {vagas.map((r) => {
                  const link = r.vaga.link;
                  const aberto = expandido.has(link);
                  const ehUrl = /^https?:\/\//.test(link);
                  return (
                    <li key={link} className="vaga-item">
                      <div className="vaga-linha">
                        <div className={`vaga-score n-${r.score >= 75 ? "alto" : r.score >= 50 ? "medio" : "baixo"}`}>{r.score}%</div>
                        <div className="vaga-info">
                          <strong>{r.vaga.titulo}</strong>
                          <span className="vaga-meta">
                            {r.vaga.empresa} · {r.vaga.local} · {candLabel(r.vaga.candidatos)}
                          </span>
                          <span className="vaga-match">
                            {r.matched.length ? `bate: ${r.matched.join(", ")}` : "sem palavras-chave em comum"}
                          </span>
                          <div className="vaga-acoes">
                            <span className="badge-site">{nomeSite}</span>
                            {ehUrl && (
                              <a className="link-vaga" href={link} target="_blank" rel="noreferrer">
                                abrir no site ↗
                              </a>
                            )}
                            <button className="link-req" onClick={() => verRequisitos(r)}>
                              {aberto ? "Ocultar requisitos" : "Ver requisitos"}
                            </button>
                          </div>
                        </div>
                        <button className="btn primario" onClick={() => escolherVaga(r)}>
                          Adaptar
                        </button>
                      </div>
                      {aberto && (
                        <div className="vaga-req">{carregandoDet.has(link) ? "Carregando requisitos…" : detalhes[link]}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <button className="link-editar" onClick={() => setModoManual((v) => !v)}>
              {modoManual ? "Ocultar" : "Preferir colar a descrição manualmente?"}
            </button>
            {modoManual && (
              <>
                <textarea
                  className="vaga"
                  value={jobText}
                  onChange={(e) => setJobText(e.target.value)}
                  rows={8}
                  placeholder="Cole aqui a descrição da vaga…"
                  spellCheck={false}
                />
                <div className="nav">
                  <button className="btn" onClick={() => setPasso(1)}>
                    Voltar
                  </button>
                  <button className="btn primario" onClick={() => setPasso(3)}>
                    Revisar com esta descrição
                  </button>
                </div>
              </>
            )}
            {!modoManual && (
              <div className="nav">
                <button className="btn" onClick={() => setPasso(1)}>
                  Voltar
                </button>
                <span />
              </div>
            )}
          </section>
        )}

        {passo === 3 && (
          <section className="panel split">
            <div className="controles">
              <header className="panel-head">
                <h1>Revisar &amp; aplicar</h1>
                <p>
                  {vagaEscolhida ? `Adaptado para: ${vagaEscolhida}. ` : ""}
                  O preview à direita é exatamente o que será enviado.
                </p>
              </header>

              <div className="score-card">
                <div className={`meter grande n-${nivel}`}>
                  <span style={{ width: `${score}%` }} />
                </div>
                <div className="score-num">
                  {score}% <small>de aderência à vaga</small>
                </div>
              </div>

              <details className="grupo" open>
                <summary>Ajustes sugeridos</summary>
                <ul className="ajustes">
                  {ajustes.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </details>

              <details className="grupo">
                <summary>Resumo</summary>
                <input
                  className="in-resumo"
                  type="text"
                  placeholder="Deixe vazio para manter o do perfil"
                  value={resumo ?? ""}
                  onChange={(e) => setResumo(e.target.value === "" ? null : e.target.value)}
                />
              </details>

              <details className="grupo" open>
                <summary>Experiências</summary>
                {experiencias.map((e, i) => (
                  <label key={i} className="check">
                    <input type="checkbox" checked={!ocultarExp.has(i)} onChange={() => setOcultarExp((s) => toggle(s, i))} />
                    <span>
                      {e.cargo} — {e.empresa}
                    </span>
                  </label>
                ))}
              </details>

              <details className="grupo">
                <summary>Competências</summary>
                <div className="chips">
                  {tecnicas.map((t) => {
                    const key = t.nome.toLowerCase();
                    return (
                      <button
                        key={key}
                        className={`chip ${ocultarComp.has(key) ? "off" : "on"}`}
                        onClick={() => setOcultarComp((s) => toggle(s, key))}
                      >
                        {t.nome}
                      </button>
                    );
                  })}
                </div>
              </details>

              <div className="nav">
                <button className="btn" onClick={() => setPasso(2)}>
                  Voltar
                </button>
                <div className="nav-final">
                  <button className="btn" onClick={baixarHtml}>
                    Baixar HTML
                  </button>
                  <button className="btn primario" onClick={() => setAprovado(true)}>
                    Aprovar preview
                  </button>
                </div>
              </div>
              {aprovado && (
                <p className="ok">✓ Aprovado. No fluxo completo, o próximo passo é o envio no site — sempre com a sua confirmação.</p>
              )}
            </div>

            <div className="preview">
              <div className="preview-bar">Preview do currículo</div>
              <iframe title="Preview do currículo" srcDoc={html} />
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
