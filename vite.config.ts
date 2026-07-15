import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function workspaceOverrides() {
  const localSrc = path.resolve(__dirname, "src");
  const localLib = path.resolve(localSrc, "lib");
  const localComponents = path.resolve(localSrc, "components");
  const pkgSrc = path.resolve(__dirname, "node_modules/veritas-co46t5/src");
  const pkgLib = path.resolve(pkgSrc, "lib");
  const overrides: Record<string, string> = {
    "v15-pipeline": path.resolve(localLib, "v15-pipeline.ts"),
    "model-rotator": path.resolve(localLib, "model-rotator.ts"),
    "v15-rate-limiter": path.resolve(localLib, "v15-rate-limiter.ts"),
    "v15-state": path.resolve(localLib, "v15-state.ts"),
    "v15-gate-testbed": path.resolve(localLib, "v15-gate-testbed.ts"),
    "v15-grounding": path.resolve(localLib, "v15-grounding.ts"),
    "browser-search-scraper": path.resolve(localLib, "browser-search-scraper.ts"),
    "academic-sources": path.resolve(localLib, "academic-sources.ts"),
    "scraper-hardener": path.resolve(localLib, "scraper-hardener.ts"),
    "williams-style": path.resolve(localLib, "williams-style.ts"),
    "omega-templates": path.resolve(localLib, "omega-templates.ts"),
    "adversarial-engine": path.resolve(localLib, "adversarial-engine.ts"),
    "n-deep": path.resolve(localLib, "n-deep.ts"),
    "sloop-runner": path.resolve(localLib, "sloop-runner.ts"),
    "continuation-detector": path.resolve(localLib, "continuation-detector.ts"),
    "V15Overlay": path.resolve(localComponents, "V15Overlay.tsx"),
    "V15CalibrationDialog": path.resolve(localComponents, "V15CalibrationDialog.tsx"),
  };

  const existing = (base: string) => {
    for (const ext of ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx"]) {
      const p = base + ext;
      if (fs.existsSync(p)) return p;
    }
    return null;
  };

  return {
    name: "workspace-overrides",
    enforce: "pre" as const,
    resolveId(source: string, importer?: string) {
      const fromPackage = !!importer && importer.includes("veritas-co46t5");
      if (fromPackage) {
        for (const [needle, target] of Object.entries(overrides)) {
          if (source.includes(needle) && fs.existsSync(target)) return target;
        }
        if (source.startsWith("@/")) return existing(path.resolve(pkgSrc, source.slice(2)));
      }

      const fromLocalOverride = !!importer && importer.startsWith(localLib);
      if (fromLocalOverride && (source.startsWith("./") || source.startsWith("../"))) {
        const localCandidate = existing(path.resolve(path.dirname(importer), source));
        if (localCandidate) return null;
        const relImporter = path.relative(localLib, importer);
        const pkgImporter = path.resolve(pkgLib, relImporter);
        return existing(path.resolve(path.dirname(pkgImporter), source));
      }

      return null;
    },
  };
}

// Import the native scraper plugin for dev-server metasearch endpoints
import { nativeScraperPlugin } from "./src/lib/overrides/vite-native-scraper";

// https://vite.dev/config/
export default defineConfig({
  plugins: [workspaceOverrides(), nativeScraperPlugin(), react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: [
      { find: /^@\/lib\/(.*)$/, replacement: path.resolve(__dirname, "node_modules/veritas-co46t5/src/lib/$1") },
      { find: "@", replacement: path.resolve(__dirname, "src") },
    ],
  },
});
