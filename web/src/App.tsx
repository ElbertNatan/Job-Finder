import { useMemo, useRef, useState } from "react";
import { ingestMarkdown } from "../../src/ingest/markdown.js";
import { pdfTextToDadosMd } from "../../src/ingest/pdfText.js";
import { detectGaps } from "../../src/profile/gaps.js";
import { tailorResume } from "../../src/tailor/ats.js";
import { applyResumeEdits, type ResumeEdits } from "../../src/tailor/edits.js";
import { renderResumeHtml } from "../../src/render/html.js";
import { extractPdfText } from "./pdf.js";
import exemploMd from "../../examples/exemplo-dados.md?raw";
import exemploVaga from "../../examples/vaga-exemplo.txt?raw";

type Passo = 1 | 2 | 3;
const PASSOS: { n: Passo; titulo: string; ajuda: string }[] = [
  { n: 1, titulo: "Currículo", ajuda: "De onde vêm os seus dados" },
  { n: 2, titulo: "Vaga", ajuda: "Para qual vaga adaptar" },
  { n: 3, titulo: "Revisar & aplicar", ajuda: "Ajuste e finalize" },
];

export function App() {
  const [passo, setPasso] = useState<Passo>(1);
  const [md, setMd] = useState<string>(exemploMd);
  const [fonteDados, setFonteDados] = useState<string>("exemplo");
  const [editandoDados, setEditandoDados] = useState(false);
  const [pdfMsg, setPdfMsg] = useState<string>("");
  const [jobText, setJobText] = useState<string>(exemploVaga);
  const [resumo, setResumo] = useState<string | null>(null);
  const [ocultarExp, setOcultarExp] = useState<Set<number>>(new Set());
  const [ocultarComp, setOcultarComp] = useState<Set<string>>(new Set());
  const [aprovado, setAprovado] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { html, score, ajustes, experiencias, tecnicas, gaps } = useMemo(() => {
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
    };
  }, [md, jobText, resumo, ocultarExp, ocultarComp]);

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
              <p>Envie um PDF, cole seus dados ou use o exemplo. Depois é só apontar a vaga.</p>
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
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                hidden
                onChange={(e) => onPdf(e.target.files?.[0])}
              />
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
                Continuar para a vaga
              </button>
            </div>
          </section>
        )}

        {passo === 2 && (
          <section className="panel">
            <header className="panel-head">
              <h1>Cole a descrição da vaga</h1>
              <p>Copie o texto do anúncio. Vamos comparar com o seu perfil e destacar o que casa.</p>
            </header>
            <textarea
              className="vaga"
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
              rows={16}
              placeholder="Cole aqui os requisitos e responsabilidades da vaga…"
              spellCheck={false}
            />
            <div className="nav">
              <button className="btn" onClick={() => setPasso(1)}>
                Voltar
              </button>
              <button className="btn primario" onClick={() => setPasso(3)}>
                Revisar currículo adaptado
              </button>
            </div>
          </section>
        )}

        {passo === 3 && (
          <section className="panel split">
            <div className="controles">
              <header className="panel-head">
                <h1>Revisar &amp; aplicar</h1>
                <p>Ajuste o que aparece. O preview à direita é exatamente o que será enviado.</p>
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
