import { searchWithGroundingFallback } from "./jina";
import { browserScraperSearch } from "./browser-search-scraper";
import { getPrismaFetchSettings, prismaFetchSearch, resolvePrismaFetchAvailability } from "./connectors/prismafetch";

export interface GroundingBackends { ogScraper?: boolean; prismafetch?: boolean; jina?: boolean; searxng?: boolean; nativeScraper?: boolean }
export interface GroundingResult { ok: boolean; provider: string; count: number; evidenceBlock: string; sources: { title: string; url: string; content: string }[]; error?: string }

const K_KEYS = "veritas.keys.v3";
function keys() { try { const raw = localStorage.getItem(K_KEYS); const p = raw ? JSON.parse(raw) : {}; return { jina: p?.jina, prismafetchUrl: getPrismaFetchSettings().prismafetchUrl }; } catch { return { prismafetchUrl: getPrismaFetchSettings().prismafetchUrl }; } }
function normalize(provider: string, results: any[], depth: number): GroundingResult {
  const sources = (results ?? []).slice(0, depth * 2).map(r => ({ title: String(r.title ?? "Untitled").slice(0, 200), url: String(r.url ?? r.permalink ?? ""), content: String(r.content ?? r.description ?? "").slice(0, 900) })).filter(s => s.url);
  if (!sources.length) return { ok: false, provider, count: 0, evidenceBlock: "", sources: [], error: "no sources returned" };
  return { ok: true, provider, count: sources.length, sources, evidenceBlock: `LIVE RETRIEVED EVIDENCE (${provider}, ${sources.length} sources; cite only these [S#]):\n` + sources.map((s, i) => `[S${i + 1}] ${s.title}\nURL: ${s.url}\n${s.content}`).join("\n---\n") };
}

async function searxngOnce(base: string, question: string, category: string, depth: number, onDebug?: (m: string) => void) {
  const params = new URLSearchParams({
    q: question,
    format: "json",
    categories: category,
    pageno: "1",
    language: localStorage.getItem("veritas.v15.searxngLanguage") || "en",
    safesearch: localStorage.getItem("veritas.v15.searxngSafe") || "0",
  });
  const engines = localStorage.getItem("veritas.v15.searxngEngines");
  if (engines) params.set("engines", engines);
  const tr = localStorage.getItem("veritas.v15.searxngTimeRange");
  if (tr) params.set("time_range", tr);
  const res = await fetch(`${base}/search?${params}`, { headers: { Accept: "application/json" } });
  if (!res.ok) { onDebug?.(`SearXNG (${category}) returned ${res.status}`); return []; }
  const json = await res.json();
  return (json.results ?? []).slice(0, depth * 2);
}

async function searxng(question: string, depth: number, onDebug?: (m: string) => void) {
  const base = (localStorage.getItem("veritas.v15.searxngUrl") || "http://localhost:8080").replace(/\/+$/, "");
  const category = localStorage.getItem("veritas.v15.searxngCategories") || "general";
  let hits = await searxngOnce(base, question, category, depth, onDebug);
  // Category fallback: if a specialized category returns nothing, retry general.
  if (hits.length === 0 && category !== "general") {
    onDebug?.(`SearXNG ${category} empty — retrying general`);
    hits = await searxngOnce(base, question, "general", depth, onDebug);
  }
  return hits.slice(0, depth);
}

// ── Native scraper integration (calls our local Vite plugin if running) ──
async function nativeSearch(question: string, depth: number, onDebug?: (m: string) => void): Promise<any[]> {
  // Try the local native scraper endpoint — available when the Vite plugin is active
  const port = typeof window !== "undefined" ? window.location.port : "5173";
  const base = `http://localhost:${port}`;
  try {
    const res = await fetch(`${base}/api/native-search?q=${encodeURIComponent(question)}&count=${depth}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) { onDebug?.(`Native scraper returned ${res.status}`); return []; }
    const data = await res.json();
    onDebug?.(`Native scraper: ${data.results?.length ?? 0} results via RRF+MMR (${data.enginesQueried?.join(",")})`);
    return (data.results ?? []).map((r: any) => ({
      title: r.title || "Native result",
      url: r.url,
      content: r.snippet || "",
      description: r.snippet || "",
    }));
  } catch (e: any) {
    onDebug?.(`Native scraper unavailable: ${e?.message ?? "error"}`);
    return [];
  }
}

// ── Query truncation for search engines ──────────────────────────────────
// Template-directed queries can be 200+ chars which search engines can't match.
// Truncate to the most important keywords (max 80 chars).
function truncateQuery(q: string, maxLen = 80): string {
  if (q.length <= maxLen) return q;
  // Keep the first maxLen chars but cut at a word boundary
  const cut = q.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return lastSpace > 40 ? cut.slice(0, lastSpace) : cut;
}

export async function groundQuestion(opts: { question: string; backends?: GroundingBackends; depth?: number; onDebug?: (m: string) => void }): Promise<GroundingResult> {
  const b = opts.backends ?? { ogScraper: true };
  const depth = opts.depth ?? 6;
  const k = keys();
  // Truncate long template-directed queries for search engine compatibility
  const searchQuery = truncateQuery(opts.question);
  if (searchQuery !== opts.question) {
    opts.onDebug?.(`Query truncated for search engines: "${opts.question.slice(0, 60)}…" → "${searchQuery}"`);
  }
  if (!(b.ogScraper || b.prismafetch || b.jina || b.searxng || b.nativeScraper)) return { ok: false, provider: "disabled", count: 0, evidenceBlock: "", sources: [], error: "all web backends disabled" };
  
  // Priority 1: Native scraper (local Vite plugin with RRF+MMR, SSRF-protected)
  if (b.nativeScraper || b.ogScraper) {
    try {
      const nativeResults = await nativeSearch(searchQuery, depth, opts.onDebug);
      if (nativeResults.length > 0) {
        const out = normalize("native-scraper(RRF+MMR)", nativeResults, depth);
        if (out.ok) return out;
      }
    } catch (e: any) { opts.onDebug?.(`Native scraper failed: ${e?.message ?? "error"}`); }
  }
  
  // Priority 2: PrismaFetch (local proxy service)
  if (b.prismafetch) try { const av = await resolvePrismaFetchAvailability(k.prismafetchUrl); if (av.ok) { const r = await prismaFetchSearch(searchQuery, { baseUrl: av.baseUrl, count: depth }); const out = normalize(`prismafetch-local:${r.backend}`, r.results, depth); if (out.ok) return out; } } catch (e: any) { opts.onDebug?.(`PrismaFetch failed (${e?.message ?? "error"})`); }
  
  // Priority 3: OG scraper (proxy-based HTML + CORS-safe JSON APIs)
  if (b.ogScraper) try { const out = normalize("browser-scraper", await browserScraperSearch(searchQuery, { count: depth, onDebug: opts.onDebug }), depth); if (out.ok) return out; } catch (e: any) { opts.onDebug?.(`OG scraper failed (${e?.message ?? "error"})`); }
  
  // Priority 4: SearXNG (self-hosted metasearch)
  if (b.searxng) try { const out = normalize("searxng", await searxng(searchQuery, depth, opts.onDebug), depth); if (out.ok) return out; } catch (e: any) { opts.onDebug?.(`SearXNG failed (${e?.message ?? "error"})`); }
  
  // Priority 5: Jina (cloud, needs API key)
  if (b.jina) try { const run = await searchWithGroundingFallback(searchQuery, k.jina ?? "", depth, { forceJina: true, allowJinaFallback: true, prismaEnabled: false, onDebug: opts.onDebug }); const out = normalize("jina", run.results, depth); if (out.ok) return out; } catch (e: any) { opts.onDebug?.(`Jina failed (${e?.message ?? "error"})`); }
  
  return { ok: false, provider: "selected-backends", count: 0, evidenceBlock: "", sources: [], error: "selected backends exhausted" };
}