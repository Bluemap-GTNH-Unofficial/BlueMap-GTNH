// Builds the local demo of the site: a static BlueMap webapp with small test scenes in `public/demo/` and a
// screenshot gallery in `public/generated/`. Both are generated, git-ignored and never committed (they contain
// Minecraft and mod textures).
//
// Rendering mirrors `e2e/src/e2e/bluemap.py`: the BlueMap CLI of the fork with the `legacy` and `gtnh-render` addon
// jars and the exported resource pack, loader `gtnh:anvil_1_7`, scene worlds from `<workspace>/worlds/`. Differences:
// one map per scene (the overworld), no webserver, gzip file storage with the webapp's `client-decompression`, and a
// service worker (demo-sw.js) so that any plain static file server (GitHub Pages included) can host the map.
//
//   pnpm demo                         render + gallery
//   pnpm demo --skip-render           gallery only, from the existing public/demo
//   pnpm demo --build                 build the CLI and addon jars with Gradle first
//   pnpm demo --scenes gt-multiblocks gallery/maps of a subset of the scenes
//
// Environment: BMGTNH_WORKSPACE (default: the parent of site/), BMGTNH_JAVA (default: mise java@temurin-25).

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WS = path.resolve(process.env.BMGTNH_WORKSPACE ?? path.join(SITE, ".."));
const DEMO = path.join(SITE, "public", "demo");
const GALLERY = path.join(SITE, "public", "generated");
const WORK = path.join(WS, "out", "site-demo");
const JAVA_TOOL = "java@temurin-25.0.5+8.0.LTS";
const PACK = path.join(WS, "out", "exporter", "bluemap-gtnh-resources-2.9.0-RC-2.zip");

interface View {
  file: string;
  title: string;
  caption: string;
  // webapp location hash without '#': map:x:y:z:distance:rotation:angle:tilt:ortho:mode
  hash: string;
}

interface Scene {
  scene: string; // folder under <workspace>/worlds
  map: string; // BlueMap map id
  name: string; // shown in the webapp's map list
  startPos: [number, number];
  views: View[];
}

// Camera positions follow the e2e scene views (e2e/scenes/<scene>.yaml).
const SCENES: Scene[] = [
  {
    scene: "gt-multiblocks",
    map: "gt_multiblocks",
    name: "GregTech multiblocks",
    startPos: [24, 10],
    views: [
      {
        file: "gt-ebf.jpg",
        title: "Electric Blast Furnace",
        caption: "A formed EBF from the south-east: heating coils, casings, hatches and the controller front overlay.",
        hash: "gt_multiblocks:6:25:8:0:-0.9:1:0:0:free",
      },
      {
        file: "gt-distillation-tower.jpg",
        title: "Distillation Tower",
        caption: "The distillation tower controller and its output hatches, seen from the front.",
        hash: "gt_multiblocks:192.5:25:-12:0:3.14159:1.35:0:0:free",
      },
      {
        file: "gt-assembly-line.jpg",
        title: "Assembly Line",
        caption: "The assembly line with its input buses and casings.",
        hash: "gt_multiblocks:240.5:24:-14:0:3.14159:1.35:0:0:free",
      },
      {
        file: "gt-mega-ebf.jpg",
        title: "Mega Blast Furnace",
        caption: "The Mega Blast Furnace, one of the largest structures in the scene, behind its glass walls.",
        hash: "gt_multiblocks:576.5:28:-18:0:3.14159:1.35:0:0:free",
      },
      {
        file: "gt-large-turbine.jpg",
        title: "Large Turbine",
        caption: "A large turbine from the front. Its rotor comes from a special (TESR) renderer and is not drawn.",
        hash: "gt_multiblocks:384.5:22:-6:0:3.14159:1.35:0:0:free",
      },
    ],
  },
  {
    scene: "gtnh-zoo",
    map: "gtnh_zoo",
    name: "GTNH block zoo",
    startPos: [129, 128],
    views: [
      {
        file: "zoo-first-rows.jpg",
        title: "Block zoo",
        caption: "The first rows of the zoo: 16,642 blocks of every mod in the pack on a 2-block grid, by block id.",
        hash: "gtnh_zoo:16:5:16:40:0.6:1:0:0:perspective",
      },
      {
        file: "zoo-middle.jpg",
        title: "Modded blocks up close",
        caption: "The middle of the zoo: blocks from many mods, drawn from the exported resource pack.",
        hash: "gtnh_zoo:129:5:128:40:0.6:1:0:0:perspective",
      },
      {
        file: "zoo-far-corner.jpg",
        title: "Last rows",
        caption: "The last rows of the zoo, with the highest block ids. Magenta cubes are states the exporter could not capture.",
        hash: "gtnh_zoo:236:5:236:40:0.6:1:0:0:perspective",
      },
    ],
  },
];

const { values: args } = parseArgs({
  options: {
    "skip-render": { type: "boolean", default: false },
    build: { type: "boolean", default: false },
    scenes: { type: "string", multiple: true },
    threads: { type: "string" },
  },
});

function fail(message: string): never {
  console.error(`demo: ${message}`);
  process.exit(1);
}

function log(message: string): void {
  console.log(`demo: ${message}`);
}

function selectedScenes(): Scene[] {
  const wanted = (args.scenes ?? []).flatMap((s) => s.split(","));
  if (wanted.length === 0) return SCENES;
  const unknown = wanted.filter((w) => !SCENES.some((s) => s.scene === w));
  if (unknown.length > 0) fail(`unknown scene(s) ${unknown.join(", ")}; known: ${SCENES.map((s) => s.scene).join(", ")}`);
  return SCENES.filter((s) => wanted.includes(s.scene));
}

function java(): string {
  if (process.env.BMGTNH_JAVA) return process.env.BMGTNH_JAVA;
  const where = spawnSync("mise", ["where", JAVA_TOOL], { encoding: "utf8" });
  if (where.status !== 0) fail(`mise where ${JAVA_TOOL} failed (install it or set BMGTNH_JAVA):\n${where.stderr}`);
  const home = where.stdout.trim();
  // mise's temurin on macOS is a bundle; both layouts are handled
  for (const candidate of [path.join(home, "bin", "java"), path.join(home, "Contents", "Home", "bin", "java")]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  fail(`no java binary under ${home}`);
}

function newest(dir: string, test: (name: string) => boolean): string | undefined {
  if (!fs.existsSync(dir)) return undefined;
  return fs
    .readdirSync(dir)
    .filter(test)
    .map((name) => path.join(dir, name))
    .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs)
    .at(-1);
}

function buildJars(repo: string): void {
  const tasks = [":cli:shadowJar", ":legacy:addonJar", ":gtnh-render:addonJar"];
  log(`gradle ${tasks.join(" ")} in ${repo}`);
  const result = spawnSync("mise", ["exec", "--", "./gradlew", "--console=plain", ...tasks], {
    cwd: repo,
    stdio: "inherit",
  });
  if (result.status !== 0) fail(`gradle failed with exit code ${result.status}`);
}

function locateJars(repo: string): { cli: string; addons: string[] } {
  const cli = newest(path.join(repo, "implementations", "cli", "build", "libs"), (n) => /^cli-.*-shadow\.jar$/.test(n));
  if (!cli) fail("no CLI shadow jar in BlueMap/implementations/cli/build/libs; run `pnpm demo --build`");
  const unzip = spawnSync("unzip", ["-l", cli], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (!unzip.stdout.includes("de/bluecolored/bluemap/webapp.zip")) {
    fail(`${cli} was built without the webapp (-x :common:buildWebapp); rebuild it with \`pnpm demo --build\``);
  }
  const addons = ["legacy", "gtnh-render"].map((project) => {
    const jar = newest(path.join(repo, project, "build", "libs"), (n) => n.endsWith("-addon.jar"));
    if (!jar) fail(`no ${project} addon jar; run \`pnpm demo --build\``);
    return jar;
  });
  return { cli, addons };
}

function writeConfig(scenes: Scene[], jars: { addons: string[] }, threads: number): string {
  const config = path.join(WORK, "config");
  const data = path.join(WORK, "data");
  fs.rmSync(config, { recursive: true, force: true });
  for (const sub of ["maps", "storages", "packs"]) fs.mkdirSync(path.join(config, sub), { recursive: true });
  const write = (file: string, lines: Record<string, unknown>): void =>
    fs.writeFileSync(
      path.join(config, file),
      Object.entries(lines)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}\n`) // JSON is valid HOCON
        .join(""),
    );

  write("core.conf", {
    "accept-download": true, // downloads Mojang's client jar for vanilla textures (Minecraft EULA)
    data,
    "render-thread-count": threads,
    "scan-for-mod-resources": false,
    metrics: false,
    log: { file: path.join(data, "logs", "debug.log"), append: false },
  });
  write("webapp.conf", {
    enabled: true,
    webroot: DEMO,
    "update-settings-file": true,
    "use-cookies": false,
    // map data stays gzip files on disk and the webapp inflates it itself: no webserver configuration needed
    "client-decompression": true,
  });
  write("webserver.conf", { enabled: false });
  write("storages/file.conf", { "storage-type": "file", root: path.join(DEMO, "maps"), compression: "gzip" });
  scenes.forEach((scene, sorting) => {
    write(`maps/${scene.map}.conf`, {
      world: path.join(WS, "worlds", scene.scene),
      loader: "gtnh:anvil_1_7",
      dimension: "minecraft:overworld",
      name: scene.name,
      sorting,
      storage: "file",
      "start-pos": { x: scene.startPos[0], z: scene.startPos[1] },
      "sky-color": "#7dabff",
      "ambient-light": 0.1,
      "remove-caves-below-y": 55,
      "cave-detection-ocean-floor": -5,
    });
  });
  for (const jar of [...jars.addons, PACK]) fs.copyFileSync(jar, path.join(config, "packs", path.basename(jar)));
  return config;
}

// Minecraft client jars BlueMap downloaded for e2e renders are reused instead of downloaded again.
function seedDownloads(): void {
  const data = path.join(WORK, "data");
  fs.mkdirSync(data, { recursive: true });
  const sources = [path.join(WS, "out", "e2e", ".cache")];
  for (const source of sources) {
    if (!fs.existsSync(source)) continue;
    for (const name of fs.readdirSync(source).filter((n) => /^minecraft-client-.*\.jar$/.test(n))) {
      const target = path.join(data, name);
      if (fs.existsSync(target)) continue;
      try {
        fs.linkSync(path.join(source, name), target);
      } catch {
        fs.copyFileSync(path.join(source, name), target);
      }
    }
  }
}

function render(cli: string, config: string): void {
  const logFile = path.join(WORK, "bluemap.log");
  log(`rendering (log ${path.relative(WS, logFile)})`);
  const started = performance.now();
  const out = fs.openSync(logFile, "w");
  const result = spawnSync(java(), ["-jar", cli, "-c", config, "-v", "1.7.10", "-r", "-f", "-g"], {
    cwd: WORK,
    stdio: ["ignore", out, out],
  });
  fs.closeSync(out);
  const text = fs.readFileSync(logFile, "utf8");
  if (result.status !== 0) fail(`BlueMap CLI exited with ${result.status}; see ${logFile}`);
  if (!text.includes("Your maps are now all up-to-date!")) fail(`render did not finish; see ${logFile}`);
  const errors = text.split("\n").filter((l) => l.includes(" ERROR]"));
  if (errors.length > 0) fail(`${errors.length} ERROR line(s) in ${logFile}:\n${errors.slice(0, 10).join("\n")}`);
  log(`rendered in ${((performance.now() - started) / 1000).toFixed(1)} s`);
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const DEMO_SW = `// Generated by site/scripts/build-demo.ts (build BUILD_ID).
// Makes the static demo behave like BlueMap's own webserver, so the map loads without failed requests on any static host:
// - 204 for tiles outside the rendered area (static hosts answer 404; the rendered tiles are listed in tile-index.json);
// - 204 for the live-update stream live/sse, so the webapp polls the static live/*.json files instead;
// - gzip bodies for *.gz files even on hosts that send them with "Content-Encoding: gzip" (the browser then inflates
//   them, but the webapp inflates map data itself: settings.json has clientDecompression).
let index = null;
const tiles = () =>
  (index ??= fetch(new URL("tile-index.json", self.registration.scope), { cache: "no-cache" })
    .then((response) => response.json())
    .then((list) => new Set(list))
    .catch((error) => { index = null; throw error; }));
const noContent = () => new Response(null, { status: 204, statusText: "No Content" });
const gzipped = (response) => {
  if (!response.ok || !response.headers.has("content-encoding") || !response.body) return response;
  const headers = new Headers(response.headers);
  headers.delete("content-encoding");
  headers.delete("content-length");
  const body = response.body.pipeThrough(new CompressionStream("gzip"));
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
};
self.addEventListener("install", (event) => { event.waitUntil(tiles()); self.skipWaiting(); });
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const relative = decodeURIComponent(url.pathname.slice(scope.pathname.length));
  if (/^maps\\/[^/]+\\/live\\/sse$/.test(relative)) {
    event.respondWith(noContent());
  } else if (/^maps\\/[^/]+\\/tiles\\//.test(relative)) {
    event.respondWith(
      tiles().then(
        (set) => (set.has(relative) ? fetch(event.request).then(gzipped) : noContent()),
        () => fetch(event.request).then(gzipped),
      ),
    );
  } else if (relative.endsWith(".gz")) {
    event.respondWith(fetch(event.request).then(gzipped));
  }
});
`;

// Waits (at most 3 s) for the demo worker to control the page, then starts the webapp.
const BOOTSTRAP = (app: string): string => `<script type="module">
      const start = () => import(${JSON.stringify(app)});
      const controlled = async () => {
        if (!("serviceWorker" in navigator)) return;
        await navigator.serviceWorker.register("./demo-sw.js");
        await navigator.serviceWorker.ready;
        if (navigator.serviceWorker.controller) return;
        await new Promise((resolve) => {
          navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true });
          setTimeout(resolve, 3000);
        });
      };
      controlled().catch((error) => console.warn("demo service worker unavailable", error)).then(start);
    </script>`;

function finishWebroot(scenes: Scene[]): void {
  // not needed (or not usable) on a static host
  fs.rmSync(path.join(DEMO, "sql.php"), { force: true });
  for (const file of walk(path.join(DEMO, "assets")).filter((f) => f.endsWith(".map"))) fs.rmSync(file);
  for (const scene of scenes) {
    const mapDir = path.join(DEMO, "maps", scene.map);
    fs.rmSync(path.join(mapDir, "rstate"), { recursive: true, force: true }); // incremental render state
    const live = path.join(mapDir, "live");
    fs.mkdirSync(live, { recursive: true });
    if (!fs.existsSync(path.join(live, "markers.json"))) fs.writeFileSync(path.join(live, "markers.json"), "{}");
    if (!fs.existsSync(path.join(live, "players.json"))) fs.writeFileSync(path.join(live, "players.json"), '{"players":[]}');
  }
  // maps of earlier runs with other scene selections
  const keep = new Set(scenes.map((s) => s.map));
  for (const entry of fs.readdirSync(path.join(DEMO, "maps"))) {
    if (!keep.has(entry)) fs.rmSync(path.join(DEMO, "maps", entry), { recursive: true, force: true });
  }

  const tiles = walk(path.join(DEMO, "maps"))
    .map((f) => path.relative(DEMO, f).split(path.sep).join("/"))
    .filter((f) => /^maps\/[^/]+\/tiles\//.test(f))
    .sort();
  fs.writeFileSync(path.join(DEMO, "tile-index.json"), JSON.stringify(tiles));
  fs.writeFileSync(path.join(DEMO, "demo-sw.js"), DEMO_SW.replace("BUILD_ID", new Date().toISOString()));

  const indexFile = path.join(DEMO, "index.html");
  let html = fs.readFileSync(indexFile, "utf8");
  const appScript = /<script type="module" crossorigin src="([^"]+)"><\/script>/;
  const match = appScript.exec(html);
  if (!match) fail(`no module script in ${indexFile}; the webapp's index.html changed`);
  html = html.replace(appScript, BOOTSTRAP(match[1]));
  html = html.replace("<title>BlueMap</title>", "<title>BlueMap GTNH demo (unofficial)</title>");
  fs.writeFileSync(indexFile, html);
  log(`${tiles.length} tiles indexed`);
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".webmanifest": "application/manifest+json",
  ".gz": "application/gzip",
};

// A plain static file server, like the hosts the demo is meant for: no compression headers, 404 for missing files.
function serve(root: string): Promise<{ url: string; close: () => void }> {
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    let file = path.join(root, pathname);
    if (!file.startsWith(root)) {
      response.writeHead(403).end();
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file)) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream" });
    fs.createReadStream(file).pipe(response);
  });
  const { promise, resolve } = Promise.withResolvers<{ url: string; close: () => void }>();
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    resolve({ url: `http://127.0.0.1:${port}/`, close: () => server.close() });
  });
  return promise;
}

// Same idea as e2e's TILES_SETTLED_JS: every tile manager has nothing in flight around the camera.
const SETTLED = `(mapId) => {
  const map = window.bluemap?.mapViewer?.map;
  if (!map || !map.isLoaded || map.data.id !== mapId) return false;
  return [map.hiresTileManager, ...map.lowresTileManager].every((m) => !m.unloaded && m.currentlyLoading === 0);
}`;

async function gallery(scenes: Scene[]): Promise<void> {
  fs.rmSync(GALLERY, { recursive: true, force: true });
  fs.mkdirSync(GALLERY, { recursive: true });
  const server = await serve(DEMO);
  // software WebGL like e2e, so the shots do not depend on the host GPU
  const browser = await chromium.launch({
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const entries: (View & { map: string; width: number; height: number })[] = [];
  const problems: string[] = [];
  try {
    for (const scene of scenes) {
      for (const view of scene.views) {
        const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
        const page = await context.newPage();
        page.on("response", (response) => {
          if (response.status() >= 400) problems.push(`${view.file}: HTTP ${response.status()} ${response.url()}`);
        });
        page.on("pageerror", (error) => problems.push(`${view.file}: ${error.message}`));
        await page.goto(`${server.url}index.html#${view.hash}`);
        await page.waitForFunction(`(${SETTLED})(${JSON.stringify(scene.map)})`, undefined, {
          timeout: 180_000,
          polling: 250,
        });
        // let the height controls and the last tiles settle, then a few more frames
        await page.waitForTimeout(2500);
        await page.waitForFunction(`(${SETTLED})(${JSON.stringify(scene.map)})`, undefined, { timeout: 60_000 });
        // the webapp's WebGL canvas keeps its drawing buffer, so it can be copied (downscaled) into a JPEG
        const shot = await page.evaluate(() => {
          const source = document.querySelector<HTMLCanvasElement>("#map-container canvas");
          if (!source) throw new Error("no map canvas");
          const canvas = document.createElement("canvas");
          canvas.width = 1200;
          canvas.height = Math.round((source.height / source.width) * 1200);
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("no 2d context");
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
          return { dataUrl: canvas.toDataURL("image/jpeg", 0.82), width: canvas.width, height: canvas.height };
        });
        const jpeg = Buffer.from(shot.dataUrl.split(",", 2)[1], "base64");
        fs.writeFileSync(path.join(GALLERY, view.file), jpeg);
        entries.push({ ...view, map: scene.map, width: shot.width, height: shot.height });
        log(`gallery ${view.file} (${(jpeg.length / 1024).toFixed(0)} KiB)`);
        await context.close();
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  fs.writeFileSync(
    path.join(GALLERY, "gallery.json"),
    JSON.stringify({ generated: new Date().toISOString(), images: entries }, null, 2),
  );
  if (problems.length > 0) fail(`failed requests or page errors while taking screenshots:\n${problems.join("\n")}`);
}

function size(dir: string): number {
  return walk(dir).reduce((sum, file) => sum + fs.statSync(file).size, 0);
}

async function main(): Promise<void> {
  const scenes = selectedScenes();
  if (!args["skip-render"]) {
    const repo = path.join(WS, "BlueMap");
    if (!fs.existsSync(path.join(repo, "settings.gradle.kts"))) fail(`BlueMap checkout not found at ${repo}`);
    if (!fs.existsSync(PACK)) fail(`exported resource pack missing: ${PACK} (see the exporter guide)`);
    for (const scene of scenes) {
      if (!fs.existsSync(path.join(WS, "worlds", scene.scene, "level.dat"))) {
        fail(`scene world missing: worlds/${scene.scene} (cd orchestrator && uv run orch scene ${scene.scene})`);
      }
    }
    if (args.build) buildJars(repo);
    const jars = locateJars(repo);
    log(`cli ${path.relative(WS, jars.cli)}; addons ${jars.addons.map((j) => path.basename(j)).join(", ")}`);
    const threads = Number(args.threads ?? Math.max(1, os.availableParallelism() - 2));
    fs.rmSync(DEMO, { recursive: true, force: true });
    fs.mkdirSync(WORK, { recursive: true });
    seedDownloads();
    const config = writeConfig(scenes, jars, threads);
    render(jars.cli, config);
    finishWebroot(scenes);
  } else if (!fs.existsSync(path.join(DEMO, "settings.json"))) {
    fail("public/demo has not been rendered yet; run `pnpm demo` without --skip-render");
  }
  await gallery(scenes);
  for (const dir of [DEMO, GALLERY]) {
    log(`${path.relative(SITE, dir)}: ${(size(dir) / 1024 / 1024).toFixed(1)} MiB`);
  }
}

await main();
