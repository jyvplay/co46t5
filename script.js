import fs from 'fs';
import path from 'path';

const pkgPath = path.resolve('node_modules/veritas-q35-unified/src/components/V15CalibrationDialog.tsx');
const localPath = path.resolve('src/components/V15CalibrationDialog.tsx');

let code = fs.readFileSync(pkgPath, 'utf-8');
const before = code.length;
function must(label, from, to) {
  if (!code.includes(from)) { console.error(`[script.js] PATCH FAILED — anchor not found: ${label}`); process.exitCode = 1; return; }
  code = code.replace(from, to);
}

// ── Import path normalization (workspace override routing) ─────────────────
code = code.replace(/from "\.\.\/lib\//g, 'from "@/lib/');
code = code.replace(/from "@\/lib\//g, 'from "@/lib/');

// ══════════════════════════════════════════════════════════════════════════
// PATCH 1 — Tab type + "Web Grounding Guide" tab button (1:1 screenshot parity)
// ══════════════════════════════════════════════════════════════════════════
must('tab-type',
  'type Tab = "live" | "batch";',
  'type Tab = "live" | "batch" | "guide";'
);
must('tab-button-guide',
  '<button onClick={() => setTab("batch")} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${tab === "batch" ? "bg-zinc-900 text-white" : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"}`}>Batch Bank</button>',
  '<button onClick={() => setTab("batch")} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${tab === "batch" ? "bg-zinc-900 text-white" : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"}`}>Batch Bank</button>\n            <button onClick={() => setTab("guide")} className={`rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1 ${tab === "guide" ? "bg-sky-600 text-white" : "border border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100"}`}>🔗 Web Grounding Guide</button>'
);

// ══════════════════════════════════════════════════════════════════════════
// PATCH 1.5 + PATCH 2 — Best-of-N state + SearXNG advanced state + Test Connection
// (merged into ONE replace on the pristine anchor — chaining two separate
// replaces on the same evolving line is fragile once the first replace has
// already mutated the text away from its pristine form.)
// ══════════════════════════════════════════════════════════════════════════
must('bestofn-and-searxng-state',
  '  const [webSearxng, setWebSearxng] = useState(false);',
  `  const [webSearxng, setWebSearxng] = useState(true);
  const [bestOfNModels, setBestOfNModels] = useState(2);
  const [bestOfNHypotheses, setBestOfNHypotheses] = useState(5);
  const [bestOfNPackHypotheses, setBestOfNPackHypotheses] = useState(false);
  const [searxngUrl, setSearxngUrl] = useState(() => { try { return localStorage.getItem("veritas.v15.searxngUrl") || "http://localhost:8080"; } catch { return "http://localhost:8080"; } });
  const [searxngApiKey, setSearxngApiKey] = useState(() => { try { return localStorage.getItem("veritas.v15.searxngApiKey") || ""; } catch { return ""; } });
  const [searxngCategories, setSearxngCategories] = useState(() => { try { return localStorage.getItem("veritas.v15.searxngCategories") || "general"; } catch { return "general"; } });
  const [searxngLanguage, setSearxngLanguage] = useState(() => { try { return localStorage.getItem("veritas.v15.searxngLanguage") || "en"; } catch { return "en"; } });
  const [searxngSafe, setSearxngSafe] = useState(() => { try { return localStorage.getItem("veritas.v15.searxngSafe") || "0"; } catch { return "0"; } });
  const [searxngTesting, setSearxngTesting] = useState(false);
  const [searxngTestResult, setSearxngTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  async function testSearxngConnection() {
    setSearxngTesting(true); setSearxngTestResult(null);
    try {
      const base = searxngUrl.replace(/\\/+$/, "");
      const params = new URLSearchParams({ q: "test", format: "json", categories: searxngCategories, language: searxngLanguage, safesearch: searxngSafe });
      const headers: Record<string, string> = { Accept: "application/json" };
      if (searxngApiKey) headers["Authorization"] = \`Bearer \${searxngApiKey}\`;
      const res = await fetch(\`\${base}/search?\${params.toString()}\`, { headers });
      if (!res.ok) { setSearxngTestResult({ ok: false, message: \`HTTP \${res.status} — ensure format=json is enabled in SearXNG settings.yml.\` }); return; }
      const json = await res.json();
      const count = Array.isArray(json.results) ? json.results.length : 0;
      setSearxngTestResult({ ok: true, message: \`Connected — \${count} result(s) returned for test query.\` });
    } catch (e: any) {
      setSearxngTestResult({ ok: false, message: e?.message || "Connection failed (network/CORS)." });
    } finally { setSearxngTesting(false); }
  }`
);

// ══════════════════════════════════════════════════════════════════════════
// PATCH 3 — Live Batch Log state (persistent scrollable terminal log)
// ══════════════════════════════════════════════════════════════════════════
must('batchlog-state',
  '  const [status, setStatus] = useState<string>("");',
  `  const [status, setStatus] = useState<string>("");
  const [batchLog, setBatchLog] = useState<string[]>([]);
  function pushBatchLog(line: string) {
    const ts = new Date().toLocaleTimeString();
    setBatchLog(prev => [...prev.slice(-500), \`\${ts} \${line}\`]);
  }`
);

must('batchlog-wire-baseline-start',
  'setStatus(`R${r + 1} · Q${i + 1}/${acc.length} [${acc[i].q.domain}] · baseline…`);',
  'setStatus(`R${r + 1} · Q${i + 1}/${acc.length} [${acc[i].q.domain}] · baseline…`);\n        pushBatchLog(`▶ R${r + 1} Q${i + 1} [${acc[i].q.domain}] — ${acc[i].q.text.slice(0, 80)}`);'
);
must('batchlog-wire-baseline-progress',
  'onProgress: (s) => setStatus(`R${r + 1} · Q${i + 1} baseline · ${s}`),',
  'onProgress: (s) => { setStatus(`R${r + 1} · Q${i + 1} baseline · ${s}`); pushBatchLog(`[baseline] ${s}`); },'
);
must('batchlog-wire-v15-start',
  'setStatus(`R${r + 1} · Q${i + 1} · V15 (depth ${effectiveDepth}, ${clusterSize}-cluster, ${sloop ? sloopPages + "pg" : "no"}-sloop)…`);',
  'setStatus(`R${r + 1} · Q${i + 1} · V15 (depth ${effectiveDepth}, ${clusterSize}-cluster, ${sloop ? sloopPages + "pg" : "no"}-sloop)…`);\n        pushBatchLog(`[V15] starting depth ${effectiveDepth}, cluster×${clusterSize}${sloop ? `, SLOOP ${sloopPages}pg` : ""}`);'
);
must('batchlog-wire-v15-progress',
  'onProgress: (s) => { setStatus(`R${r + 1} · Q${i + 1} V15 · ${s}`); setLiveStage(s); },',
  'onProgress: (s) => { setStatus(`R${r + 1} · Q${i + 1} V15 · ${s}`); setLiveStage(s); pushBatchLog(`[V15] ${s}`); },'
);
must('batchlog-wire-divergence',
  'setStatus(`R${r + 1} · Q${i + 1} · analyzing guard↔judge divergence (Δ ${delta.toFixed(1)})…`);',
  'setStatus(`R${r + 1} · Q${i + 1} · analyzing guard↔judge divergence (Δ ${delta.toFixed(1)})…`);\n            pushBatchLog(`[divergence] guard/judge gap Δ${delta.toFixed(1)} — analyzing root cause`);'
);
must('batchlog-wire-comparative',
  'setStatus(`R${r + 1} · Q${i + 1} · independent comparative judge…`);',
  'setStatus(`R${r + 1} · Q${i + 1} · independent comparative judge…`);\n          pushBatchLog(`[judge] independent comparative judge (fresh context)…`);'
);
must('batchlog-wire-round-pass',
  'setStatus(`✓ Round ${r + 1} passed. Mean V15: ${mean.toFixed(2)}/10.`);',
  'setStatus(`✓ Round ${r + 1} passed. Mean V15: ${mean.toFixed(2)}/10.`);\n        pushBatchLog(`✓ Round ${r + 1} complete — mean V15 ${mean.toFixed(2)}/10`);'
);
must('batchlog-wire-round-complete',
  'setStatus(`■ Set complete (auto-stop). Mean V15: ${mean.toFixed(2)}/10.${continuousMode ? "" : " Enable Continuous Mode to auto-retry with fresh questions."}`);',
  'setStatus(`■ Set complete (auto-stop). Mean V15: ${mean.toFixed(2)}/10.${continuousMode ? "" : " Enable Continuous Mode to auto-retry with fresh questions."}`);\n        pushBatchLog(`■ Set complete — mean V15 ${mean.toFixed(2)}/10`);'
);

// ══════════════════════════════════════════════════════════════════════════
// PATCH 4 — DraftStatsPanel + adversarial preview injection (Live + Batch)
// ══════════════════════════════════════════════════════════════════════════
must('draftstats-live',
  '{p.row.comparative && (',
  '{p.row.v15 && (p.row.v15 as any).passHistory && (p.row.v15 as any).passHistory.length > 0 && <DraftStatsPanel out={p.row.v15} />}\n          {p.row.comparative && ('
);
code = code.replaceAll
  ? code.replaceAll('{out.comparative && (', '{out.v15 && (out.v15 as any).passHistory && (out.v15 as any).passHistory.length > 0 && <DraftStatsPanel out={out.v15} />}\n                      {out.comparative && (')
  : code.replace(/\{out\.comparative && \(/g, '{out.v15 && (out.v15 as any).passHistory && (out.v15 as any).passHistory.length > 0 && <DraftStatsPanel out={out.v15} />}\n                      {out.comparative && (');

// ══════════════════════════════════════════════════════════════════════════
// PATCH 4.1 — Citation Audit Panel rendering
// ══════════════════════════════════════════════════════════════════════════
// Insert CitationAuditPanel before DraftStatsPanel in Live tab
code = code.replace(
  '{p.row.v15 && (p.row.v15 as any).passHistory && (p.row.v15 as any).passHistory.length > 0 && <DraftStatsPanel out={p.row.v15} />}',
  '{p.row.v15 && (p.row.v15 as any).citationAudit && <CitationAuditPanel audit={(p.row.v15 as any).citationAudit} />}\n          {p.row.v15 && (p.row.v15 as any).passHistory && (p.row.v15 as any).passHistory.length > 0 && <DraftStatsPanel out={p.row.v15} />}'
);

// Insert CitationAuditPanel before DraftStatsPanel in Batch tab
code = code.replaceAll
  ? code.replaceAll('{out.v15 && (out.v15 as any).passHistory && (out.v15 as any).passHistory.length > 0 && <DraftStatsPanel out={out.v15} />}', '{out.v15 && (out.v15 as any).citationAudit && <CitationAuditPanel audit={(out.v15 as any).citationAudit} />}\n                      {out.v15 && (out.v15 as any).passHistory && (out.v15 as any).passHistory.length > 0 && <DraftStatsPanel out={out.v15} />}')
  : code.replace(/\{out\.v15 && \(out\.v15 as any\)\.passHistory && \(out\.v15 as any\)\.passHistory\.length > 0 && <DraftStatsPanel out=\{out\.v15\} \/>\}/g, '{out.v15 && (out.v15 as any).citationAudit && <CitationAuditPanel audit={(out.v15 as any).citationAudit} />}\n                      {out.v15 && (out.v15 as any).passHistory && (out.v15 as any).passHistory.length > 0 && <DraftStatsPanel out={out.v15} />}');

// ══════════════════════════════════════════════════════════════════════════
// PATCH 4.5 — Wire Best-of-N controls into the profile object
// ══════════════════════════════════════════════════════════════════════════
must('bestofn-profile',
  '    webBackends: { ogScraper: webOg, prismafetch: webPrisma, jina: webJina, searxng: webSearxng },\n    useOriginalDefensePack: useDefensePack,\n  }), [fourStage, nDeep, nDeepPasses, cluster, clusterSize, sloop, sloopPages, templateId, styleOverride, williamsPersona, adversarial, webSearch, webOg, webPrisma, webJina, useDefensePack]);',
  '    webBackends: { ogScraper: webOg, prismafetch: webPrisma, jina: webJina, searxng: webSearxng },\n    useOriginalDefensePack: useDefensePack,\n    bestOfNModels,\n    bestOfNHypotheses,\n    bestOfNPackHypotheses,\n  }), [fourStage, nDeep, nDeepPasses, cluster, clusterSize, sloop, sloopPages, templateId, styleOverride, williamsPersona, adversarial, webSearch, webOg, webPrisma, webJina, useDefensePack, bestOfNModels, bestOfNHypotheses, bestOfNPackHypotheses]);'
);

// ══════════════════════════════════════════════════════════════════════════
// PATCH 5 — Default run settings wired in (single question + advanced pipeline active)
// ══════════════════════════════════════════════════════════════════════════
must('default-batchsize', 'const DEFAULT_BATCH_SIZE = 5;', 'const DEFAULT_BATCH_SIZE = 1;');
must('default-advancedmode', 'const [advancedMode, setAdvancedMode] = useState(false);', 'const [advancedMode, setAdvancedMode] = useState(true);');
must('default-adversarial', 'const [adversarial, setAdversarial] = useState(false);', 'const [adversarial, setAdversarial] = useState(true);');
must('default-defensepack', 'const [useDefensePack, setUseDefensePack] = useState(false);', 'const [useDefensePack, setUseDefensePack] = useState(true);');

// ══════════════════════════════════════════════════════════════════════════
// PATCH 6 — SearXNG Configuration panel + Best-of-N controls (rendered inside ProfileBar)
// ══════════════════════════════════════════════════════════════════════════
must('profilebar-call-searxng-props',
  '          webSearxng={webSearxng} setWebSearxng={setWebSearxng}\n        />',
  `          webSearxng={webSearxng} setWebSearxng={setWebSearxng}
          searxngUrl={searxngUrl} setSearxngUrl={setSearxngUrl}
          searxngApiKey={searxngApiKey} setSearxngApiKey={setSearxngApiKey}
          searxngCategories={searxngCategories} setSearxngCategories={setSearxngCategories}
          searxngLanguage={searxngLanguage} setSearxngLanguage={setSearxngLanguage}
          searxngSafe={searxngSafe} setSearxngSafe={setSearxngSafe}
          searxngTesting={searxngTesting} searxngTestResult={searxngTestResult}
          testSearxngConnection={testSearxngConnection}
          bestOfNModels={bestOfNModels} setBestOfNModels={setBestOfNModels}
          bestOfNHypotheses={bestOfNHypotheses} setBestOfNHypotheses={setBestOfNHypotheses}
          bestOfNPackHypotheses={bestOfNPackHypotheses} setBestOfNPackHypotheses={setBestOfNPackHypotheses}
        />`
);
must('profilebar-interface-searxng-props',
  '  webSearxng: boolean; setWebSearxng: (v: boolean) => void;\n}) {',
  `  webSearxng: boolean; setWebSearxng: (v: boolean) => void;
  searxngUrl: string; setSearxngUrl: (v: string) => void;
  searxngApiKey: string; setSearxngApiKey: (v: string) => void;
  searxngCategories: string; setSearxngCategories: (v: string) => void;
  searxngLanguage: string; setSearxngLanguage: (v: string) => void;
  searxngSafe: string; setSearxngSafe: (v: string) => void;
  searxngTesting: boolean; searxngTestResult: { ok: boolean; message: string } | null;
  testSearxngConnection: () => void;
  bestOfNModels: number; setBestOfNModels: (v: number) => void;
  bestOfNHypotheses: number; setBestOfNHypotheses: (v: number) => void;
  bestOfNPackHypotheses: boolean; setBestOfNPackHypotheses: (v: boolean) => void;
}) {`
);
must('profilebar-render-searxng-panel',
  '            <label className="flex items-center gap-1"><input type="checkbox" checked={p.webSearxng} onChange={e => p.setWebSearxng(e.target.checked)} className="accent-sky-600" /><span className="text-sky-800">SearXNG</span></label>\n          </span>\n        )}\n      </div>',
  `            <label className="flex items-center gap-1"><input type="checkbox" checked={p.webSearxng} onChange={e => p.setWebSearxng(e.target.checked)} className="accent-sky-600" /><span className="text-sky-800">SearXNG</span></label>
          </span>
        )}
      </div>
      {p.webSearch && p.webSearxng && (
        <div className="mt-2 rounded-xl border border-violet-200 bg-violet-50/40 p-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-violet-800">SearXNG Configuration</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6 text-[10px]">
            <label className="flex flex-col gap-0.5">
              <span className="font-bold text-zinc-600">Base URL</span>
              <input type="text" value={p.searxngUrl} onChange={e => { p.setSearxngUrl(e.target.value); try { localStorage.setItem("veritas.v15.searxngUrl", e.target.value); } catch {} }} className="rounded border border-zinc-300 px-1.5 py-1 font-mono" placeholder="http://localhost:8080" />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="font-bold text-zinc-600">API Key</span>
              <input type="password" value={p.searxngApiKey} onChange={e => { p.setSearxngApiKey(e.target.value); try { localStorage.setItem("veritas.v15.searxngApiKey", e.target.value); } catch {} }} className="rounded border border-zinc-300 px-1.5 py-1 font-mono" placeholder="optional" />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="font-bold text-zinc-600">Categories</span>
              <select value={p.searxngCategories} onChange={e => { p.setSearxngCategories(e.target.value); try { localStorage.setItem("veritas.v15.searxngCategories", e.target.value); } catch {} }} className="rounded border border-zinc-300 px-1.5 py-1 font-mono">
                <option value="general">general</option>
                <option value="science">science</option>
                <option value="it">it</option>
                <option value="news">news</option>
                <option value="academic">academic</option>
                <option value="files">files</option>
              </select>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="font-bold text-zinc-600">Language</span>
              <select value={p.searxngLanguage} onChange={e => { p.setSearxngLanguage(e.target.value); try { localStorage.setItem("veritas.v15.searxngLanguage", e.target.value); } catch {} }} className="rounded border border-zinc-300 px-1.5 py-1 font-mono">
                <option value="en">en</option>
                <option value="es">es</option>
                <option value="fr">fr</option>
                <option value="de">de</option>
                <option value="all">all</option>
              </select>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="font-bold text-zinc-600">Safe</span>
              <select value={p.searxngSafe} onChange={e => { p.setSearxngSafe(e.target.value); try { localStorage.setItem("veritas.v15.searxngSafe", e.target.value); } catch {} }} className="rounded border border-zinc-300 px-1.5 py-1 font-mono">
                <option value="0">Off</option>
                <option value="1">Moderate</option>
                <option value="2">Strict</option>
              </select>
            </label>
            <div className="flex items-end">
              <button onClick={p.testSearxngConnection} disabled={p.searxngTesting} type="button" className="w-full rounded-lg bg-violet-600 px-2 py-1.5 text-[10px] font-bold text-white hover:bg-violet-700 disabled:opacity-50">
                {p.searxngTesting ? "Testing…" : "🔌 Test Connection"}
              </button>
            </div>
          </div>
          {p.searxngTestResult && (
            <div className={\`mt-2 rounded px-2 py-1 text-[10px] font-mono \${p.searxngTestResult.ok ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}\`}>
              {p.searxngTestResult.ok ? "✓" : "✗"} {p.searxngTestResult.message}
            </div>
          )}
          <div className="mt-1.5 text-[9px] text-violet-700">Tip: enable format=json in your SearXNG settings.yml under search: formats: [json]. All settings auto-saved to localStorage.</div>
        </div>
      )}
      {p.cluster && (
        <div className="mt-2 rounded-xl border border-indigo-200 bg-indigo-50/40 p-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-indigo-800">Best-of-N Outline-First Drafting (dense skeletons, expand winner only)</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-[10px]">
            <label className="flex flex-col gap-0.5">
              <span className="font-bold text-zinc-600">Models (distinct LLMs)</span>
              <input type="number" min={1} max={5} value={p.bestOfNModels} onChange={e => p.setBestOfNModels(Math.max(1, Math.min(5, Number(e.target.value) || 1)))} className="rounded border border-zinc-300 px-2 py-1 font-mono" />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="font-bold text-zinc-600">Hypotheses (outlines)</span>
              <input type="number" min={2} max={8} value={p.bestOfNHypotheses} onChange={e => p.setBestOfNHypotheses(Math.max(2, Math.min(8, Number(e.target.value) || 2)))} className="rounded border border-zinc-300 px-2 py-1 font-mono" />
            </label>
            <label className="col-span-2 flex items-end gap-1.5">
              <input type="checkbox" checked={p.bestOfNPackHypotheses} onChange={e => p.setBestOfNPackHypotheses(e.target.checked)} className="accent-indigo-600" />
              <span className="font-bold text-indigo-800">Pack multiple outlines per model call (RPM-saving mode)</span>
            </label>
          </div>
          <div className="mt-1.5 text-[9px] text-indigo-700">Each hypothesis is a DENSE outline (~250 words), not a full draft — only the highest-scoring outline is expanded into the full answer. This saves (N-1)/N of the draft-stage tokens versus generating N full drafts.</div>
        </div>
      )}`
);

// ══════════════════════════════════════════════════════════════════════════
// PATCH 7 — Web Grounding Guide tab body (SearXNG vs PrismaFetch comparison)
// ══════════════════════════════════════════════════════════════════════════
must('guide-tab-body',
  `              rateUsage={rateUsage}
            />
          )}
        </div>`,
  `              rateUsage={rateUsage}
            />
          )}
          {!showDivergenceLog && tab === "guide" && <GroundingGuidePanel />}
        </div>`
);

// ══════════════════════════════════════════════════════════════════════════
// PATCH 8 — Advanced pipeline diagram header rename (screenshot 1:1: "ADVANCED PIPELINE — N NODES")
// ══════════════════════════════════════════════════════════════════════════
must('pipeline-header-rename',
  'Advanced pipeline diagram — {nodes.length} live nodes (N-Deep {effectiveDepth} → {effectiveDepth} scans + {effectiveDepth} gate runs){running && <span className="ml-2 text-emerald-600">● live</span>}',
  'ADVANCED PIPELINE — {nodes.length} NODES{running && <span className="ml-2 text-emerald-600">● live</span>}'
);

// ══════════════════════════════════════════════════════════════════════════
// PATCH 9 — LIVE BATCH LOG terminal panel (left column, Batch Bank tab)
// ══════════════════════════════════════════════════════════════════════════
must('batchtab-props-loglist',
  '  rateUsage: ReturnType<typeof snapshotAllUsage>;\n}) {\n  const selectedRow = p.selected !== null ? p.rows[p.selected] : null;',
  '  rateUsage: ReturnType<typeof snapshotAllUsage>;\n  batchLog?: string[];\n}) {\n  const selectedRow = p.selected !== null ? p.rows[p.selected] : null;'
);
must('batchtab-call-loglist',
  '              rateUsage={rateUsage}\n            />\n          )}\n          {!showDivergenceLog && tab === "guide" && <GroundingGuidePanel />}',
  '              rateUsage={rateUsage}\n              batchLog={batchLog}\n            />\n          )}\n          {!showDivergenceLog && tab === "guide" && <GroundingGuidePanel />}'
);
must('batchtab-render-loglist',
  '        {/* Row list */}\n        {p.rows.length === 0 ? (',
  `        {/* Live Batch Log (terminal-style, scrollable, persistent) */}
        {p.batchLog && p.batchLog.length > 0 && (
          <div className="border-b border-zinc-200 bg-zinc-950 p-2">
            <div className="mb-1 flex items-center justify-between px-1 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
              <span>▸ LIVE BATCH LOG</span>
              <span className="text-zinc-500">{p.batchLog.length} LINES</span>
            </div>
            <div className="max-h-56 overflow-y-auto rounded bg-zinc-950 p-1.5 font-mono text-[10px] leading-relaxed text-emerald-200">
              {p.batchLog.map((l, i) => <div key={i} className="whitespace-pre-wrap break-all">{l}</div>)}
            </div>
          </div>
        )}

        {/* Row list */}
        {p.rows.length === 0 ? (`
);

// ══════════════════════════════════════════════════════════════════════════
// PATCH 10 — DraftStatsPanel rendering in LiveCompareTab & BatchBankTab
// ══════════════════════════════════════════════════════════════════════════
// Render CitationAuditPanel if citationAudit exists
code = code.replaceAll(
  '{out.bestOfNCandidates && out.bestOfNCandidates.length > 0 && (',
  `{out.citationAudit && <CitationAuditPanel audit={out.citationAudit} />}\n      {out.bestOfNCandidates && out.bestOfNCandidates.length > 0 && (`
);

// ══════════════════════════════════════════════════════════════════════════
// APPEND — new sub-components: DraftStatsPanel + GroundingGuidePanel
// ══════════════════════════════════════════════════════════════════════════
code += `

// ── Draft Stats Panel (deterministic, no LLM call — from V15 Engine) ────────
function DraftStatsPanel({ out }: { out: any }) {
  const passes = out.passHistory || [];
  if (passes.length === 0) return null;
  const bestIdx = out.bestPassIndex ?? -1;
  const isMonotonic = passes.every((p: any, i: number) => i === 0 || p.guardScore >= passes[i-1].guardScore);

  return (
    <div className="space-y-3 mb-4">
      <div className="rounded-xl border border-sky-200 bg-sky-50/30 overflow-hidden text-[10px]">
        <div className="flex items-center justify-between px-3 py-2 border-b border-sky-100 bg-sky-50">
          <div className="font-bold text-sky-900 flex items-center gap-1.5">
            <span className="text-sm">📊</span> Draft Stats (deterministic, no LLM call)
          </div>
          <div className="text-sky-700">{passes.length} pass(es) - best: pass {bestIdx + 1}</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-sky-800 font-bold border-b border-sky-100 bg-sky-50/50">
              <tr>
                <th className="px-3 py-1.5">Pass</th>
                <th className="px-2 py-1.5">Guard</th>
                <th className="px-2 py-1.5">Model</th>
                <th className="px-2 py-1.5">Chars</th>
                <th className="px-2 py-1.5">Words</th>
                <th className="px-2 py-1.5">Sent.</th>
                <th className="px-2 py-1.5">Avg/sent</th>
                <th className="px-2 py-1.5">Cites</th>
                <th className="px-2 py-1.5">Code</th>
                <th className="px-2 py-1.5">H#</th>
                <th className="px-2 py-1.5">Tbl rows</th>
                <th className="px-2 py-1.5">Crit</th>
                <th className="px-2 py-1.5">Major</th>
                <th className="px-2 py-1.5">Warn</th>
                <th className="px-2 py-1.5">Canon gates</th>
                <th className="px-2 py-1.5">Testbed gates</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-50 font-mono text-zinc-700">
              {passes.map((p: any, i: number) => {
                const isBest = i === bestIdx;
                return (
                  <tr key={i} className={isBest ? "bg-emerald-50/60" : "hover:bg-white/50"}>
                    <td className="px-3 py-1.5 font-bold flex items-center gap-1">{i + 1} {isBest && <span className="text-emerald-600">★</span>}</td>
                    <td className={"px-2 py-1.5 font-bold " + (p.guardScore >= 9 ? "text-emerald-700" : "text-amber-700")}>{p.guardScore.toFixed(2)}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{p.modelUsed.replace("gemini-", "").slice(0, 12)}</td>
                    <td className="px-2 py-1.5">{p.charCount}</td>
                    <td className="px-2 py-1.5 font-bold">{p.wordCount}</td>
                    <td className="px-2 py-1.5">{p.sentenceCount}</td>
                    <td className="px-2 py-1.5">{p.avgSentenceLen.toFixed(1)}</td>
                    <td className="px-2 py-1.5">{p.citationCount}</td>
                    <td className="px-2 py-1.5">{p.codeBlockCount}</td>
                    <td className="px-2 py-1.5">{p.headingCount}</td>
                    <td className="px-2 py-1.5">{p.tableRowCount}</td>
                    <td className={"px-2 py-1.5 font-bold " + (p.criticalCount > 0 ? "text-rose-600" : "text-zinc-400")}>{p.criticalCount}</td>
                    <td className={"px-2 py-1.5 font-bold " + (p.majorCount > 0 ? "text-amber-600" : "text-zinc-400")}>{p.majorCount}</td>
                    <td className={"px-2 py-1.5 " + (p.warningCount > 0 ? "text-zinc-700" : "text-zinc-400")}>{p.warningCount}</td>
                    <td className="px-2 py-1.5">{p.canonicalGateHits?.length || 0}</td>
                    <td className="px-2 py-1.5">{p.testbedGateHits?.length || 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 border-t border-sky-100 text-sky-800 flex items-center gap-1.5">
          {isMonotonic ? (
            <><span className="text-emerald-600">✅</span> Score was monotonically non-decreasing across all passes.</>
          ) : (
            <><span className="text-amber-600">⚠️</span> {passes.filter((p: any, i: number) => i > 0 && p.guardScore < passes[i-1].guardScore).length} pass(es) scored lower than the previous pass — engine kept pass {bestIdx + 1} as final.</>
          )}
        </div>
      </div>

      {out.bestOfNCandidates && out.bestOfNCandidates.length > 0 && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-3 text-[10px] mt-3">
          <div className="font-bold text-indigo-900 mb-2 flex items-center gap-1.5 justify-between">
            <span><span className="text-sm">🎯</span> Best-of-N Outline-First Candidates</span>
            <span className="text-indigo-700 font-normal">outline-first: only the winning skeleton was expanded to full length</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono">
              <thead className="border-b border-indigo-100 text-indigo-800">
                <tr><th className="px-2 py-1">#</th><th className="px-2 py-1">Model</th><th className="px-2 py-1">Stage</th><th className="px-2 py-1">Chars</th><th className="px-2 py-1">Score</th><th className="px-2 py-1">Status</th><th className="px-2 py-1">Snippet</th></tr>
              </thead>
              <tbody>
                {out.bestOfNCandidates.map((c: any, i: number) => (
                  <tr key={i} className={c.chosen ? "bg-emerald-50/60 align-top" : "align-top"}>
                    <td className="px-2 py-1">{c.index + 1}</td>
                    <td className="px-2 py-1">{c.model}</td>
                    <td className="px-2 py-1">
                      <span className={"rounded px-1.5 py-0.5 text-[9px] font-bold " + (c.stage === "expanded" ? "bg-emerald-200 text-emerald-900" : "bg-zinc-200 text-zinc-700")}>
                        {c.stage === "expanded" ? "EXPANDED" : c.stage === "outline" ? "OUTLINE ONLY" : "—"}
                      </span>
                    </td>
                    <td className="px-2 py-1">{c.charCount}</td>
                    <td className="px-2 py-1 font-bold">{typeof c.guardScore === "number" ? c.guardScore.toFixed(2) : "—"}</td>
                    <td className="px-2 py-1">{c.chosen ? "★ CHOSEN" : "discarded (outline)"}</td>
                    <td className="px-2 py-1 max-w-xs whitespace-pre-wrap text-zinc-600 text-[9px]">{c.snippet ? c.snippet + (c.snippet.length >= 160 ? "…" : "") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {out.coveReport && out.coveReport.questions && out.coveReport.questions.length > 0 && (
        <div className="rounded-xl border border-teal-200 bg-teal-50/30 p-3 text-[10px] mt-3">
          <div className="font-bold text-teal-900 mb-2 flex items-center gap-1.5 justify-between">
            <span><span className="text-sm">🔗</span> Chain-of-Verification (CoVe)</span>
            <span className={"px-2 py-0.5 rounded text-white font-bold " + (out.coveReport.inconsistencies === 0 ? "bg-emerald-500" : "bg-amber-500")}>{out.coveReport.inconsistencies}/{out.coveReport.questions.length} mismatch(es)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-teal-100 text-teal-800 font-bold">
                <tr><th className="px-2 py-1">Question</th><th className="px-2 py-1">Draft implied</th><th className="px-2 py-1">Verified</th><th className="px-2 py-1">OK</th></tr>
              </thead>
              <tbody className="divide-y divide-teal-50 font-mono text-zinc-700">
                {out.coveReport.questions.map((q: any, i: number) => (
                  <tr key={i} className={q.consistent ? "" : "bg-amber-50/50"}>
                    <td className="px-2 py-1 align-top">{q.question}</td>
                    <td className="px-2 py-1 align-top">{q.expectedAnswer}</td>
                    <td className="px-2 py-1 align-top">{q.verifiedAnswer}</td>
                    <td className="px-2 py-1 align-top font-bold">{q.consistent ? "✓" : "✗"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {out.polishApplied && (
        <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50/30 p-3 text-[10px] mt-3">
          <div className="font-bold text-fuchsia-900 flex items-center gap-1.5"><span className="text-sm">✨</span> Polish pass applied</div>
          <div className="mt-1 text-fuchsia-800">The final pass repaired structural issues (e.g. References section, scaffolding leaks, punctuation, or unclosed blocks) without changing the substantive content.</div>
        </div>
      )}

      {out.judgeExcluded && out.judgeExcluded.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-3 text-[10px]">
          <div className="font-bold text-amber-900 mb-1.5 flex items-center gap-1.5">
            <span className="text-sm">⚠️</span> Judges excluded this run (never fabricated as a fallback score)
          </div>
          <ul className="list-disc pl-4 space-y-1 font-mono text-amber-800">
            {out.judgeExcluded.map((e: any, i: number) => (
              <li key={i}><b>{e.model}</b>: {e.reason}</li>
            ))}
          </ul>
        </div>
      )}

      {out.adversarialPreview && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/30 p-3 text-[10px] font-mono mt-3">
          <div className="font-bold text-rose-900 mb-1.5 flex items-center gap-1.5 justify-between">
            <span><span className="text-sm">⚔️</span> Adversarial Engine Preview</span>
            <span className={"px-2 py-0.5 rounded text-white font-bold " + (out.adversarialPreview.verdict === "pass" ? "bg-emerald-500" : "bg-rose-500")}>{out.adversarialPreview.verdict.toUpperCase()}</span>
          </div>
          <div className="text-rose-800 mb-2 whitespace-pre-wrap max-h-48 overflow-y-auto bg-rose-100/50 p-2 rounded">
            {out.adversarialPreview.rawCritique || "(No raw critique text returned)"}
          </div>
          {out.adversarialPreview.defectCount > 0 && (
            <div className="text-rose-900 font-bold">
              Detected Categories: {out.adversarialPreview.categories.join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Citation Audit Panel ──────────────────────────────────────────────────
function CitationAuditPanel({ audit }: { audit: any }) {
  if (!audit || audit.totalCitations === 0) return null;
  const isOk = audit.missingCount === 0 && audit.untrustedCount === 0;

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-3 text-[10px] mt-3">
      <div className="font-bold text-indigo-900 mb-2 flex items-center gap-1.5 justify-between">
        <span><span className="text-sm">📚</span> Citation Provenance Audit</span>
        <span className={"px-2 py-0.5 rounded text-white font-bold " + (isOk ? "bg-emerald-500" : "bg-amber-500")}>
          {audit.trustedCount}/{audit.totalCitations} TRUSTED
        </span>
      </div>
      
      <div className="flex gap-4 mb-2 text-indigo-800">
        <div><b>Total [S#] tags:</b> {audit.totalCitations}</div>
        <div className={audit.untrustedCount > 0 ? "text-amber-700 font-bold" : ""}><b>Untrusted:</b> {audit.untrustedCount}</div>
        <div className={audit.missingCount > 0 ? "text-rose-700 font-bold" : ""}><b>Missing Source:</b> {audit.missingCount}</div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono bg-white rounded border border-indigo-100">
          <thead className="bg-indigo-50/50 text-indigo-900 border-b border-indigo-100">
            <tr>
              <th className="px-2 py-1.5">Tag</th>
              <th className="px-2 py-1.5">Status</th>
              <th className="px-2 py-1.5">Overlap/Entail</th>
              <th className="px-2 py-1.5">Claim Context (from draft)</th>
              <th className="px-2 py-1.5">Source Snippet (verbatim)</th>
              <th className="px-2 py-1.5">URL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-indigo-50">
            {audit.auditResults.map((r: any, i: number) => (
              <tr key={i} className={!r.found ? "bg-rose-50" : !r.trusted ? "bg-amber-50" : ""}>
                <td className="px-2 py-1.5 font-bold whitespace-nowrap">{r.tag}</td>
                <td className="px-2 py-1.5">
                  <span className={"px-1.5 py-0.5 rounded " + (r.trusted ? "bg-emerald-100 text-emerald-800" : !r.found ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800")}>
                    {r.trusted ? "TRUSTED" : !r.found ? "MISSING" : "UNTRUSTED"}
                  </span>
                </td>
                <td className="px-2 py-1.5">{r.found ? r.entailmentScore !== undefined ? \`LLM:\${r.entailmentScore.toFixed(2)}\` : \`Word:\${r.snippetOverlap}\` : "—"}</td>
                <td className="px-2 py-1.5 text-zinc-800 max-w-[250px] truncate" title={r.claimContext}>
                  {r.claimContext.slice(0, 100)}...
                </td>
                <td className="px-2 py-1.5 text-zinc-600 max-w-[250px] truncate" title={r.entry?.snippet}>
                  {r.entry ? r.entry.snippet.slice(0, 100) + "..." : "—"}
                </td>
                <td className="px-2 py-1.5">
                  {r.entry?.url ? (
                    <a href={r.entry.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                      {new URL(r.entry.url).hostname.replace('www.','')}
                    </a>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Web Grounding Guide (SearXNG vs PrismaFetch comparison & setup) ─────────
function GroundingGuidePanel() {
  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="rounded-2xl border border-sky-200 bg-sky-50/40 p-4">
        <div className="text-sm font-bold text-sky-900 mb-1">🔗 Web Grounding Guide — SearXNG vs PrismaFetch</div>
        <div className="text-[11px] text-sky-800">Both backends are additive and can be combined freely. This guide compares their capabilities so you can choose the right combination for your calibration run.</div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200">
        <table className="w-full text-left text-[11px]">
          <thead className="bg-zinc-100 font-bold text-zinc-700">
            <tr>
              <th className="px-3 py-2">Capability</th>
              <th className="px-3 py-2">SearXNG</th>
              <th className="px-3 py-2">PrismaFetch</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            <tr><td className="px-3 py-2 font-bold">Type</td><td className="px-3 py-2">Self-hosted metasearch aggregator</td><td className="px-3 py-2">Local read/search proxy service</td></tr>
            <tr><td className="px-3 py-2 font-bold">Setup</td><td className="px-3 py-2">Docker one-liner, format=json required</td><td className="px-3 py-2">Local server on 127.0.0.1:8080</td></tr>
            <tr><td className="px-3 py-2 font-bold">API key</td><td className="px-3 py-2">Optional (Bearer token)</td><td className="px-3 py-2">None required</td></tr>
            <tr><td className="px-3 py-2 font-bold">Categories</td><td className="px-3 py-2">general / science / it / news / academic / files</td><td className="px-3 py-2">Single unified index</td></tr>
            <tr><td className="px-3 py-2 font-bold">Language/Safe filters</td><td className="px-3 py-2">Yes — language + safesearch params</td><td className="px-3 py-2">No</td></tr>
            <tr><td className="px-3 py-2 font-bold">Read/Extract full page</td><td className="px-3 py-2">No (search results only)</td><td className="px-3 py-2">Yes — /api/read with OCR modes</td></tr>
            <tr><td className="px-3 py-2 font-bold">Best for</td><td className="px-3 py-2">Broad, category-filtered discovery</td><td className="px-3 py-2">Deep single-page extraction</td></tr>
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-violet-200 bg-violet-50/30 p-4">
        <div className="text-[11px] font-bold text-violet-900 mb-2">🔧 SearXNG Setup</div>
        <ol className="list-decimal pl-5 space-y-1 text-[11px] text-violet-900">
          <li>Run: <code className="rounded bg-violet-100 px-1 font-mono">docker run -d -p 8080:8080 searxng/searxng</code></li>
          <li>Edit <code className="rounded bg-violet-100 px-1 font-mono">settings.yml</code>: under <code className="rounded bg-violet-100 px-1 font-mono">search: formats:</code> add <code className="rounded bg-violet-100 px-1 font-mono">- json</code></li>
          <li>Restart the container, then set the Base URL in the profile bar above (default <code className="rounded bg-violet-100 px-1 font-mono">http://localhost:8080</code>).</li>
          <li>Click <b>Test Connection</b> to verify — a successful test returns a result count for a sample query.</li>
        </ol>
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4">
        <div className="text-[11px] font-bold text-emerald-900 mb-2">🔧 PrismaFetch Setup</div>
        <ol className="list-decimal pl-5 space-y-1 text-[11px] text-emerald-900">
          <li>Run the PrismaFetch local service (default <code className="rounded bg-emerald-100 px-1 font-mono">http://127.0.0.1:8080</code>).</li>
          <li>Enable it under Chat → Control Plane → PrismaFetch, then confirm the healthz check passes.</li>
          <li>Toggle PrismaFetch in this dialog's Web grounding row to route calibration searches through it first.</li>
        </ol>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-[11px] text-zinc-600">
        <b>Recommendation:</b> enable both. The pipeline tries PrismaFetch → OG scraper → SearXNG → Jina in that order, falling back automatically whenever a backend is unreachable, so mixing backends only increases coverage — never risk.
      </div>
    </div>
  );
}
`;

fs.writeFileSync(localPath, code);
console.log(`[script.js] Patched V15CalibrationDialog.tsx (${before} -> ${code.length} bytes). All anchors matched: ${process.exitCode !== 1}`);
