import { useMemo, useState } from "react";
import { ingestMarkdown } from "../../src/ingest/markdown.js";
import { tailorResume } from "../../src/tailor/ats.js";
import { applyResumeEdits, type ResumeEdits } from "../../src/tailor/edits.js";
import { renderResumeHtml } from "../../src/render/html.js";
import exemploMd from "../../examples/exemplo-dados.md?raw";
import exemploVaga from "../../examples/vaga-exemplo.txt?raw";

export function App() {
  const [md, setMd] = useState<string>(exemploMd);
  const [jobText, setJobText] = useState<string>(exemploVaga);
  const [resumo, setResumo] = useState<string | null>(null);
  const [ocultarExp, setOcultarExp] = useState<Set<number>>(new Set());
  const [ocultarComp, setOcultarComp] = useState<Set<string>>(new Set());
  const [aprovado, setAprovado] = useState(false);

  // Pipeline (o mesmo core da CLI/testes, rodando no navegador):
  // .md -> perfil -> adequacao ATS -> edicoes do usuario -> HTML (preview = PDF)
  const { html, score, ajustes, experiencias, tecnicas } = useMemo(() => {
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
    };
  }, [md, jobText, resumo, ocultarExp, ocultarComp]);

  const toggle = <T,>(set: Set<T>, key: T): Set<T> => {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  };

  const baixarHtml = () => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "curriculo.html";
    a.click();
    URL.revokeObjectURL(url);
  };

  const scoreCor = score >= 75 ? "#137333" : score >= 50 ? "#b06000" : "#c5221f";

  return (
    <div className="app">
      <aside className="painel">
        <h1>JobFinder</h1>
        <p className="sub">Preview &amp; revisão do currículo por vaga</p>

        <label className="campo">
          <span>Dados do candidato (.md)</span>
          <textarea value={md} onChange={(e) => setMd(e.target.value)} rows={8} spellCheck={false} />
        </label>

        <label className="campo">
          <span>Descrição da vaga</span>
          <textarea value={jobText} onChange={(e) => setJobText(e.target.value)} rows={6} spellCheck={false} />
        </label>

        <div className="bloco">
          <h2>Propor mudanças</h2>

          <label className="campo">
            <span>Sobrescrever resumo (opcional)</span>
            <input
              type="text"
              placeholder="deixe vazio para manter o do perfil"
              value={resumo ?? ""}
              onChange={(e) => setResumo(e.target.value === "" ? null : e.target.value)}
            />
          </label>

          <div className="campo">
            <span>Experiências (desmarque para ocultar)</span>
            {experiencias.map((e, i) => (
              <label key={i} className="check">
                <input type="checkbox" checked={!ocultarExp.has(i)} onChange={() => setOcultarExp((s) => toggle(s, i))} />
                {e.cargo} — {e.empresa}
              </label>
            ))}
          </div>

          <div className="campo">
            <span>Competências técnicas (desmarque para ocultar)</span>
            <div className="chips">
              {tecnicas.map((t) => {
                const key = t.nome.toLowerCase();
                const ativo = !ocultarComp.has(key);
                return (
                  <button
                    key={key}
                    type="button"
                    className={ativo ? "chip on" : "chip off"}
                    onClick={() => setOcultarComp((s) => toggle(s, key))}
                  >
                    {t.nome}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bloco">
          <h2>Relatório ATS</h2>
          <div className="score" style={{ color: scoreCor }}>
            {score}%
          </div>
          <ul className="ajustes">
            {ajustes.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>

        <div className="acoes">
          <button type="button" className="btn primario" onClick={() => setAprovado(true)}>
            Aprovar preview
          </button>
          <button type="button" className="btn" onClick={baixarHtml}>
            Baixar HTML
          </button>
        </div>
        {aprovado && (
          <p className="ok">
            ✓ Preview aprovado. No fluxo completo, o próximo passo é o gate de submissão no site (com sua confirmação).
          </p>
        )}
      </aside>

      <main className="preview">
        <iframe title="Preview do currículo" srcDoc={html} />
      </main>
    </div>
  );
}
