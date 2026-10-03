// MapLibre GL runs its geojson/tile processing in a Web Worker and, by default,
// looks for the worker file next to its own bundle — a path that doesn't exist
// once Next.js has bundled it, so marker data silently never renders. Copy the
// worker (plus the shared chunk it imports) into /public so FloodMap can point
// the library at a stable URL with setWorkerUrl(). Runs on install/dev/build.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "maplibre-gl", "dist");
const to = join(root, "public", "maplibre");

if (!existsSync(from)) {
  console.warn("[copy-maplibre-worker] maplibre-gl is not installed yet; skipping.");
  process.exit(0);
}
mkdirSync(to, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(from, file), join(to, file));
}
