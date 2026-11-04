// Builds the local demo of the site: a static BlueMap webapp with test scene maps in `public/demo/` and a screenshot
// gallery in `public/generated/`. Both are generated, git-ignored and never committed (they contain Minecraft, mod
// and Modernity-GTNH textures).
//
// Rendering mirrors `e2e/src/e2e/bluemap.py`: the BlueMap CLI of the fork with the `legacy` and `gtnh-render` addon
// jars, loader `gtnh:anvil_1_7`, scene worlds from the pack version's `<workspace>/worlds-<version>/`. Every map
// names its textures: `default` is the exported resource pack, `modernity` adds the two Modernity-GTNH packs of
// `out/modernity/` on top of it, as `modernity e2e` does. BlueMap loads one set of resource packs per run, so each
// texture is a CLI run of its own into the same webroot. Differences to e2e: one map per scene (the overworld), no
// webserver, gzip file storage with the webapp's `client-decompression`, and a service worker (demo-sw.js) so that any
// plain static file server (GitHub Pages included) can host the map.
//
// The end-game maps take one camera per machine from the scene's `out/scenes-<version>/endgame/scene.json` (labels
// and boxes), aimed in the browser with the webapp's own perspective controls, so "Show in the live map" lands on the
// same view.
//
//   pnpm demo                           render + gallery
//   pnpm demo --skip-render             gallery only, from the existing public/demo
//   pnpm demo --build                   build the CLI and addon jars with Gradle first
//   pnpm demo --maps gt_multiblocks_modernity,gtnh_zoo_default   a subset of the maps (ids below)
//
// Environment: BMGTNH_WORKSPACE (default: the parent of site/), BMGTNH_JAVA (default: mise java@temurin-25).

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WS = path.resolve(process.env.BMGTNH_WORKSPACE ?? path.join(SITE, ".."));
const DEMO = path.join(SITE, "public", "demo");
const GALLERY = path.join(SITE, "public", "generated");
const LOGS = path.join(WS, "out", "site-demo"); // BlueMap's console and debug log of each CLI run
// File system types reached through the host: the dev container's bind mount of the checkout (virtiofs from Windows),
// Docker Desktop's file sharing, network shares (the list of e2e/src/e2e/oracle/reference.py, HOST_SHARED).
const HOST_SHARED = ["virtiofs", "9p", "drvfs", "fakeowner", "fuse.grpcfuse", "osxfs", "nfs", "nfs4", "cifs", "smb3"];
// BlueMap's config directory (with copies of the packs) and data directory (Minecraft client jars). BlueMap reads the
// packs entry by entry; through the host every read is a round trip, so there they go to the local disk instead.
const WORK = HOST_SHARED.includes(fileSystem(LOGS) ?? "") ? path.join(os.tmpdir(), "bluemap-gtnh-site-demo") : LOGS;
const JAVA_TOOL = "java@temurin-25.0.5+8.0.LTS";
const PACK_VERSION = "2.9.0"; // the GTNH pack the worlds, scene outputs, exported pack and Modernity pack are built on
const WORLDS = path.join(WS, `worlds-${PACK_VERSION}`);
const SCENES = path.join(WS, "out", `scenes-${PACK_VERSION}`);
const PACK = path.join(WS, "out", `exporter-${PACK_VERSION}`, `bluemap-gtnh-resources-${PACK_VERSION}.zip`);
const ORCH_SCENE = "uv run orch scene";
const MODERNITY = path.join(WS, "out", "modernity");

type Texture = "modernity" | "default";
const TEXTURE_NAMES: Record<Texture, string> = { modernity: "Modernity-GTNH textures", default: "default textures" };

type Box = [number, number, number, number, number, number]; // inclusive block box x1, y1, z1, x2, y2, z2

interface View {
  file: string;
  title: string;
  caption: string;
  // a fixed camera: the webapp location hash after "<map>:", x:y:z:distance:rotation:angle:tilt:ortho:mode ...
  camera?: string;
  // ... or a perspective camera aimed at a box in the browser (aim())
  aim?: Aim;
}

interface Aim {
  box: Box;
  rotation: number; // the webapp's: 0 looks north (-z), PI/2 east
  angle: number; // 0 looks straight down, PI/2 level
  margin: number; // share of the view the box may fill
}

interface DemoMap {
  scene: string; // folder under the pack version's <workspace>/worlds and out/scenes
  title: string; // the map list shows "<title> (<textures>)"
  texture: Texture;
  startPos?: [number, number]; // default: the centre of the scene's plaza
  views: View[];
  machines?: boolean; // add an overview and one view per machine of the pack version's out/scenes/<scene>/scene.json
  optional?: boolean; // only with --maps
}

const mapId = (m: DemoMap): string => `${m.scene.replaceAll("-", "_")}_${m.texture}`;

// Camera positions follow the e2e scene views (e2e/scenes/<scene>.yaml).
const MAPS: DemoMap[] = [
  { scene: "endgame", title: "End-game machines", texture: "modernity", views: [], machines: true },
  {
    scene: "gt-multiblocks",
    title: "GregTech multiblocks",
    texture: "modernity",
    startPos: [24, 10],
    views: [
      {
        file: "gt-ebf.jpg",
        title: "Electric Blast Furnace",
        caption: "A formed EBF from the south-east: heating coils, casings, hatches and the controller front overlay.",
        camera: "6:25:8:0:-0.9:1:0:0:free",
      },
      {
        file: "gt-distillation-tower.jpg",
        title: "Distillation Tower",
        caption: "The distillation tower controller and its output hatches, seen from the front.",
        camera: "192.5:25:-12:0:3.14159:1.35:0:0:free",
      },
      {
        file: "gt-assembly-line.jpg",
        title: "Assembly Line",
        caption: "The assembly line with its input buses and casings.",
        camera: "240.5:24:-14:0:3.14159:1.35:0:0:free",
      },
      {
        file: "gt-mega-ebf.jpg",
        title: "Mega Blast Furnace",
        caption: "The Mega Blast Furnace, one of the largest structures in the scene, behind its glass walls.",
        camera: "576.5:28:-18:0:3.14159:1.35:0:0:free",
      },
      {
        file: "gt-large-turbine.jpg",
        title: "Large Turbine",
        caption: "A large turbine from the front. Its rotor comes from a special (TESR) renderer and is not drawn.",
        camera: "384.5:22:-6:0:3.14159:1.35:0:0:free",
      },
    ],
  },
  // the same plaza with the exported pack only: the "Modernity vs default" comparisons are taken on it
  { scene: "endgame", title: "End-game machines", texture: "default", views: [] },
  {
    scene: "gtnh-zoo",
    title: "GTNH block zoo",
    texture: "default",
    startPos: [129, 128],
    optional: true,
    views: [
      {
        file: "zoo-first-rows.jpg",
        title: "Block zoo",
        caption: "The first rows of the zoo: 16,642 blocks of every mod in the pack on a 2-block grid, by block id.",
        camera: "16:5:16:40:0.6:1:0:0:perspective",
      },
      {
        file: "zoo-middle.jpg",
        title: "Modded blocks up close",
        caption: "The middle of the zoo: blocks from many mods, drawn from the exported resource pack.",
        camera: "129:5:128:40:0.6:1:0:0:perspective",
      },
      {
        file: "zoo-far-corner.jpg",
        title: "Last rows",
        caption: "The last rows of the zoo, with the highest block ids. Magenta cubes are states the exporter could not capture.",
        camera: "236:5:236:40:0.6:1:0:0:perspective",
      },
    ],
  },
];

// Modernity vs default: these end-game machines are also shot on the default-texture map, with the same camera.
const COMPARE = ["mega-ebf", "dtpf"];

// End-game views: from the north-west (the controllers face north), flat machines from higher up.
const MACHINE_VIEW = { rotation: 2.5, angle: 1.0, margin: 0.86 };
const FLAT_VIEW = { angle: 0.78 };
const FLAT_MACHINES = /^(fusion-mk|compact-fusion-mk|lhc$)/;

// What the screenshots of the end-game machines show, besides the name; the tier is the one the scene builds.
const MACHINE_NOTES: Record<string, string> = {
  "fusion-mk1": "GregTech's first fusion reactor ring, 15 × 3 × 15 blocks.",
  "fusion-mk2": "Mark II: the same ring with fusion casings and coils of the next tier.",
  "fusion-mk3": "Mark III, the last GregTech fusion computer.",
  "fusion-mk4": "GT++'s Mark IV fusion reactor.",
  "fusion-mk5": "GT++'s Mark V, the top of the classic fusion line.",
  "compact-fusion-mk1": "GoodGenerator's compact fusion computer: a ring 47 blocks across.",
  "compact-fusion-mk2": "Compact fusion Mk-II.",
  "compact-fusion-mk3": "Compact fusion Mk-III.",
  "compact-fusion-mk4": "Compact fusion Mk-IV.",
  "compact-fusion-mk5": "Compact fusion Mk-V, the largest fusion computer.",
  "mega-ebf": "Eternal heating coils and UXV-tier glass, the highest tiers the structure takes.",
  "mega-vf": "With tier 2 (rhugnor) casings.",
  "mega-dt": "All five layers: 54 blocks tall, the tallest machine of the plaza.",
  "mega-chem": "With UXV-tier glass.",
  "mega-oil-cracker": "Eternal coils and UXV-tier glass.",
  "mega-abs": "Eternal coils and UXV-tier glass.",
  "mega-apiary": "Kubatech's mega apiary (the Industrial Apicultural Acclimatiser and Drone Domestication Station) with UXV glass and a LuV energy hatch.",
  eig: "Kubatech's greenhouse with UXV glass; the machine fills in its own water and farmland once formed.",
  eec: "The Extreme Entity Crusher with UXV glass.",
  qft: "Top-tier pulse manipulators and shielding cores. The force field is only drawn while it runs.",
  tpm: "The Transcendent Plasma Mixer.",
  nfr: "With tier 4 field restriction coils.",
  lnr: "The Large Naquadah Reactor.",
  cal: "MAX-tier Component Assembly Line casings, 33 blocks long.",
  "precise-assembler": "Top-tier precise electronic unit casings, machine casings and glass.",
  defc: "The Draconic Evolution Fusion Crafter with the top core tier.",
  "dyson-swarm": "The ground unit of the Dyson swarm.",
  "nanochip-complex": "63 × 49 × 63 blocks; its modules are separate machines and not built here.",
  eoh: "Tier 9 spacetime compression, time dilation and stabilisation field generators. A running Eye of Harmony shows a star in its centre, which is a special (TESR) renderer; this one is idle.",
  dtpf: "Eternal coils, the highest tier.",
  "space-elevator": "Motor tier 5 and the extension ring. In the game a tether runs from the base into the sky; it is a special (TESR) renderer, so the map shows only the base.",
  "antimatter-forge": "The Semi-Stable Antimatter Stabilization Sequencer, 53 blocks across. Its antimatter is only drawn while it holds some.",
  "antimatter-generator": "The Shielded Lagrangian Annihilation Matrix.",
  godforge: "All three rings and one module of each kind (Helioflare Power Forge, Helioflux Melting Core, Heliothermal Plasma Fabricator, Heliofusion Exoticizer): 127 × 29 × 187 blocks. Fuelled, the Godforge replaces its rings with a rotating star render (TESR); unfuelled, as here, the game shows these blocks too.",
  lhc: "The Large Hadron Collider with all four modules: 115 × 16 × 125 blocks.",
};

const { values: args } = parseArgs({
  options: {
    "skip-render": { type: "boolean", default: false },
    build: { type: "boolean", default: false },
    maps: { type: "string", multiple: true },
    threads: { type: "string" },
    pages: { type: "string" },
  },
});

function fail(message: string): never {
  console.error(`demo: ${message}`);
  process.exit(1);
}

function log(message: string): void {
  console.log(`demo: ${message}`);
}

// The type of the file system `target` (existing or not) is on, from /proc/mounts (undefined without one, e.g. macOS).
function fileSystem(target: string): string | undefined {
  let mounts: string[];
  try {
    mounts = fs.readFileSync("/proc/mounts", "utf8").split("\n");
  } catch {
    return undefined;
  }
  let best = "";
  let kind: string | undefined;
  for (const line of mounts) {
    const [, field, type] = line.split(" ");
    if (!type) continue;
    const mount = field.replaceAll("\\040", " ");
    const inside = target === mount || target.startsWith(mount.endsWith("/") ? mount : `${mount}/`);
    if (inside && mount.length >= best.length) [best, kind] = [mount, type];
  }
  return kind;
}

function selectedMaps(): DemoMap[] {
  const wanted = (args.maps ?? []).flatMap((s) => s.split(","));
  if (wanted.length === 0) return MAPS.filter((m) => !m.optional);
  const unknown = wanted.filter((w) => !MAPS.some((m) => mapId(m) === w));
  if (unknown.length > 0) fail(`unknown map(s) ${unknown.join(", ")}; known: ${MAPS.map(mapId).join(", ")}`);
  return MAPS.filter((m) => wanted.includes(mapId(m)));
}

interface SceneMachine {
  key: string;
  label: string;
  alias?: string;
  mte: number;
  tier: number;
  row: string;
  box: Box;
}

interface SceneFile {
  plaza?: { box: Box };
  machines?: SceneMachine[];
}

function sceneFile(scene: string): SceneFile {
  const file = path.join(SCENES, scene, "scene.json");
  if (!fs.existsSync(file)) fail(`${path.relative(WS, file)} missing (cd orchestrator && ${ORCH_SCENE} ${scene})`);
  return JSON.parse(fs.readFileSync(file, "utf8")) as SceneFile;
}

// The overview and one aimed view per machine, labelled from the scene; file names do not depend on the texture.
function machineViews(scene: string): View[] {
  const data = sceneFile(scene);
  if (!data.plaza || !data.machines) fail(`${path.relative(WS, SCENES)}/${scene}/scene.json has no plaza/machines`);
  const overview: View = {
    file: `${scene}-overview.jpg`,
    title: "The plaza",
    caption: `All ${data.machines.length} machines from the north-west: fusion reactors in front, the Forge of the Gods and the Large Hadron Collider at the back.`,
    aim: { box: data.plaza.box, rotation: 2.55, angle: 0.9, margin: 0.95 },
  };
  return [
    overview,
    ...data.machines.map((m) => ({
      file: `${scene}-${m.key}.jpg`,
      title: m.alias ? `${m.alias} (${m.label})` : m.label,
      caption: MACHINE_NOTES[m.key] ?? `${m.label}, tier ${m.tier}.`,
      aim: { box: m.box, ...MACHINE_VIEW, ...(FLAT_MACHINES.test(m.key) ? FLAT_VIEW : {}) },
    })),
  ];
}

function startPos(map: DemoMap): [number, number] {
  if (map.startPos) return map.startPos;
  const box = sceneFile(map.scene).plaza?.box;
  if (!box) fail(`no startPos for ${mapId(map)} and no plaza in its scene.json`);
  return [Math.round((box[0] + box[3] + 1) / 2), Math.round((box[2] + box[5] + 1) / 2)];
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

// Resource packs of a texture variant. BlueMap loads packs/ in reverse file-name order and the first pack providing a
// resource wins, so the `modernity-…` packs take priority over `bluemap-gtnh-resources-…` (see modernity/README.md).
function texturePacks(texture: Texture): string[] {
  if (!fs.existsSync(PACK)) fail(`exported resource pack missing: ${PACK} (see the exporter guide)`);
  if (texture === "default") return [PACK];
  const modded = newest(MODERNITY, (n) => n.startsWith("modernity-") && n.endsWith(`-modded-${PACK_VERSION}.zip`));
  const vanilla = newest(MODERNITY, (n) => /^modernity-.*-vanilla-1\.13\.zip$/.test(n));
  if (!modded || !vanilla) {
    fail(
      "Modernity packs missing in out/modernity (cd modernity && uv run modernity " +
        "fetch, vanilla and modded)",
    );
  }
  return [PACK, modded, vanilla];
}

function writeConfig(maps: DemoMap[], texture: Texture, jars: { addons: string[] }, threads: number): string {
  const config = path.join(WORK, `config-${texture}`);
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
    log: { file: path.join(LOGS, `bluemap-${texture}-debug.log`), append: false },
  });
  write("webapp.conf", {
    enabled: true,
    webroot: DEMO,
    "update-settings-file": true, // each run lists only its own maps; finishWebroot() lists them all
    "use-cookies": false,
    // map data stays gzip files on disk and the webapp inflates it itself: no webserver configuration needed
    "client-decompression": true,
    // the end-game plaza is about 300 × 450 blocks: keep it in full detail from the overview
    "hires-slider-default": 300,
  });
  write("webserver.conf", { enabled: false });
  write("storages/file.conf", { "storage-type": "file", root: path.join(DEMO, "maps"), compression: "gzip" });
  for (const map of maps) {
    const [x, z] = startPos(map);
    write(`maps/${mapId(map)}.conf`, {
      world: path.join(WORLDS, map.scene),
      loader: "gtnh:anvil_1_7",
      dimension: "minecraft:overworld",
      name: `${map.title} (${TEXTURE_NAMES[map.texture]})`,
      sorting: MAPS.indexOf(map),
      storage: "file",
      "start-pos": { x, z },
      "sky-color": "#7dabff",
      "ambient-light": 0.1,
      "remove-caves-below-y": 55,
      "cave-detection-ocean-floor": -5,
    });
  }
  for (const jar of [...jars.addons, ...texturePacks(texture)]) {
    fs.copyFileSync(jar, path.join(config, "packs", path.basename(jar)));
  }
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

function render(cli: string, config: string, texture: Texture): void {
  const logFile = path.join(LOGS, `bluemap-${texture}.log`);
  log(`rendering the ${TEXTURE_NAMES[texture]} maps (log ${path.relative(WS, logFile)}, work directory ${WORK})`);
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

// Patches the webapp's settings.json (BlueMap writes it on every render pass).
function updateSettings(patch: Record<string, unknown>): void {
  const file = path.join(DEMO, "settings.json");
  fs.writeFileSync(file, JSON.stringify({ ...JSON.parse(fs.readFileSync(file, "utf8")), ...patch }));
}

function finishWebroot(maps: DemoMap[]): void {
  // not needed (or not usable) on a static host
  fs.rmSync(path.join(DEMO, "sql.php"), { force: true });
  for (const file of walk(path.join(DEMO, "assets")).filter((f) => f.endsWith(".map"))) fs.rmSync(file);
  for (const map of maps) {
    const mapDir = path.join(DEMO, "maps", mapId(map));
    fs.rmSync(path.join(mapDir, "rstate"), { recursive: true, force: true }); // incremental render state
    const live = path.join(mapDir, "live");
    fs.mkdirSync(live, { recursive: true });
    if (!fs.existsSync(path.join(live, "markers.json"))) fs.writeFileSync(path.join(live, "markers.json"), "{}");
    if (!fs.existsSync(path.join(live, "players.json"))) fs.writeFileSync(path.join(live, "players.json"), '{"players":[]}');
  }
  // maps of earlier runs with other map selections
  const keep = new Set(maps.map(mapId));
  for (const entry of fs.readdirSync(path.join(DEMO, "maps"))) {
    if (!keep.has(entry)) fs.rmSync(path.join(DEMO, "maps", entry), { recursive: true, force: true });
  }
  // every render pass wrote settings.json with its own maps only
  updateSettings({ maps: maps.map(mapId) });

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

// MapHeightControls eases the target and camera heights towards the terrain under them over many frames and snaps to
// it once within 0.001; under software WebGL that takes longer than a fixed wait, and reading the target height early
// misaims the camera (it was still coming down from the previous view).
const HEIGHTS_SETTLED = `() => {
  const viewer = window.bluemap?.mapViewer;
  const manager = viewer?.controlsManager;
  const heights = manager?.controls?.mapHeight;
  if (!heights || !viewer.map) return true; // free-flight controls, or no map yet
  if (manager.ortho !== 0 && manager.angle !== 0) return true; // MapControls only update the heights otherwise
  const target = viewer.map.terrainHeightAt(manager.position.x, manager.position.z) + 3 || 0;
  if (heights.targetHeight !== target) return false;
  if (heights.minCameraHeight === 0) return true; // the camera height is not used at this distance
  const camera = manager.camera.position;
  return heights.cameraHeight === (viewer.map.terrainHeightAt(camera.x, camera.z) || 0);
}`;

// ---- aiming (the webapp's ControlsManager, MapControls and MapHeightControls) ----

type Vec = [number, number, number];
const VIEWPORT = { width: 1600, height: 900 };
const FOV = (75 * Math.PI) / 180; // vertical, MapViewer's CombinedCamera
const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// The parts of BlueMap's webapp state (`window.bluemap`) the aiming reads.
declare global {
  interface Window {
    bluemap?: {
      mapViewer?: {
        map?: { terrainHeightAt(x: number, z: number): number | false };
        controlsManager?: { position: { y: number } };
      };
    };
  }
}

// The camera looks along this direction at the target, from `distance` before it.
function lookDirection(rotation: number, angle: number): Vec {
  return [Math.sin(rotation) * Math.sin(angle), -Math.cos(angle), -Math.cos(rotation) * Math.sin(angle)];
}

// The smallest distance at which all corners of `box` are inside the view, looking at `target`.
function fitDistance(target: Vec, aim: Aim): number {
  const forward = lookDirection(aim.rotation, aim.angle);
  const side = cross(forward, [0, 1, 0]);
  const right: Vec = [side[0] / Math.hypot(...side), 0, side[2] / Math.hypot(...side)];
  const up = cross(right, forward);
  const tanV = Math.tan(FOV / 2) * aim.margin;
  const tanH = tanV * (VIEWPORT.width / VIEWPORT.height);
  const [x1, y1, z1, x2, y2, z2] = aim.box;
  let distance = 5; // the webapp's minimum zoom distance
  for (const x of [x1, x2 + 1]) {
    for (const y of [y1, y2 + 1]) {
      for (const z of [z1, z2 + 1]) {
        const p: Vec = [x - target[0], y - target[1], z - target[2]];
        const depth = dot(p, forward);
        distance = Math.max(distance, Math.abs(dot(p, right)) / tanH - depth, Math.abs(dot(p, up)) / tanV - depth);
      }
    }
  }
  return distance;
}

const centreOf = (box: Box): Vec => [(box[0] + box[3] + 1) / 2, (box[1] + box[4] + 1) / 2, (box[2] + box[5] + 1) / 2];

// A perspective camera on `target`, pulled back until the box fits.
function perspective(map: string, target: Vec, view: Aim): string {
  const values = [...target, fitDistance(target, view)].map((v) => v.toFixed(2));
  return `${map}:${values.join(":")}:${view.rotation}:${view.angle}:0:0:perspective`;
}

// In perspective view the webapp ignores the hash's y: the target sits at the terrain height under it plus 3, lowered
// towards 0 as the distance grows to 500 (MapHeightControls). To keep the box in the middle of the view, the target is
// the point on the line of sight through the box centre whose height best matches that rule, from terrain heights
// sampled along it in the loaded map.
async function aimTarget(page: Page, view: Aim): Promise<Vec> {
  const [x1, y1, z1, x2, y2, z2] = view.box;
  const centre = centreOf(view.box);
  const forward = lookDirection(view.rotation, view.angle);
  const reach = Math.hypot(x2 - x1, y2 - y1, z2 - z1) / 2 + 8;
  const steps = Array.from({ length: Math.ceil(reach) * 4 + 1 }, (_, i) => i / 2 - reach);
  const heights = await page.evaluate(
    (points) => points.map(([x, z]) => window.bluemap?.mapViewer?.map?.terrainHeightAt(x, z) ?? false),
    steps.map((t): [number, number] => [centre[0] + t * forward[0], centre[2] + t * forward[2]]),
  );
  let target = centre;
  for (let round = 0; round < 5; round++) {
    const lowered = 1 - Math.min(fitDistance(target, view) / 500, 1);
    let best = { error: Infinity, t: 0, y: centre[1] };
    steps.forEach((t, i) => {
      const terrain = heights[i];
      if (terrain === false) return;
      const y = (terrain + 3) * lowered;
      const error = Math.abs(centre[1] + t * forward[1] - y) + Math.abs(t) * 1e-3;
      if (error < best.error) best = { error, t, y };
    });
    target = [centre[0] + best.t * forward[0], best.y, centre[2] + best.t * forward[2]];
  }
  return target;
}

interface Shot {
  file: string;
  title: string;
  caption: string;
  hash: string;
  map: string;
  texture: Texture;
  group: "endgame" | "gallery";
  width: number;
  height: number;
}

interface Comparison {
  key: string;
  title: string;
  caption: string;
  hash: string; // of the Modernity shot
  modernity: string;
  default: string;
  width: number;
  height: number;
}

async function settle(page: Page, map: string): Promise<void> {
  const ready = `(${SETTLED})(${JSON.stringify(map)})`;
  await page.waitForFunction(ready, undefined, { timeout: 180_000, polling: 250 });
  // let the last tiles draw, wait for the height controls to reach the terrain under the target, then check the tiles
  await page.waitForTimeout(2500);
  await page.waitForFunction(`(${HEIGHTS_SETTLED})()`, undefined, { timeout: 180_000, polling: 250 });
  await page.waitForFunction(ready, undefined, { timeout: 60_000 });
}

// Changing the hash moves the camera asynchronously, and the webapp also writes its own (debounced) camera position
// back into the hash, which can overwrite ours before it is applied. On a flat plaza the "settled" checks already
// hold at the old position, so keep setting the hash until the orbit target has reached the requested x/z.
async function go(page: Page, hash: string): Promise<void> {
  const [, x, , z] = hash.split(":").map(Number);
  for (let attempt = 1; ; attempt++) {
    await page.evaluate((h) => {
      window.location.hash = h;
    }, hash);
    if (Number.isNaN(x) || Number.isNaN(z)) return;
    for (let poll = 0; poll < 30; poll++) {
      const arrived = await page.evaluate(
        ([tx, tz]) => {
          const p = window.bluemap?.mapViewer?.controlsManager?.position;
          return !!p && Math.abs(p.x - tx) < 0.5 && Math.abs(p.z - tz) < 0.5;
        },
        [x, z],
      );
      if (arrived) return;
      await page.waitForTimeout(100);
    }
    if (attempt === 20) {
      const now = await page.evaluate(() => {
        const p = window.bluemap?.mapViewer?.controlsManager?.position;
        return { x: p?.x, y: p?.y, z: p?.z, hash: window.location.hash };
      });
      throw new Error(`camera did not reach ${hash}: at ${JSON.stringify(now)}`);
    }
  }
}

// The height of the orbit target the webapp settled on (the height controls set it in perspective view).
async function targetY(page: Page): Promise<number> {
  return page.evaluate(() => window.bluemap?.mapViewer?.controlsManager?.position.y ?? NaN);
}

// the webapp's WebGL canvas keeps its drawing buffer, so it can be copied (downscaled) into a JPEG
async function capture(page: Page, file: string): Promise<{ width: number; height: number }> {
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
  fs.writeFileSync(path.join(GALLERY, file), jpeg);
  log(`gallery ${file} (${(jpeg.length / 1024).toFixed(0)} KiB)`);
  return { width: shot.width, height: shot.height };
}

// Each map's views are shot by up to `pages` pages side by side, each taking a contiguous run of them (neighbouring
// machines, like one page going through all of them) after loading the map at the first. One page of software WebGL
// kept about 14 of 32 CPUs busy and took 10.5 minutes for the 43 views on an idle machine.
async function gallery(maps: DemoMap[], pages: number): Promise<void> {
  fs.rmSync(GALLERY, { recursive: true, force: true });
  fs.mkdirSync(GALLERY, { recursive: true });
  const server = await serve(DEMO);
  // software WebGL like e2e, so the shots do not depend on the host GPU
  const browser = await chromium.launch({
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const shots: Shot[] = [];
  const comparisons: Comparison[] = [];
  const problems: string[] = [];
  let start: string | undefined;
  const settled = new Map<string, number>(); // file -> camera target y the webapp settled on
  const open = async (label: string, hash: string): Promise<Page> => {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on("response", (response) => {
      if (response.status() >= 400) problems.push(`${label}: HTTP ${response.status()} ${response.url()}`);
    });
    page.on("pageerror", (error) => problems.push(`${label}: ${error.message}`));
    await page.goto(`${server.url}index.html#${hash}`);
    return page;
  };
  const shoot = async (page: Page, map: DemoMap, view: View): Promise<Shot> => {
    const id = mapId(map);
    let hash = `${id}:${view.camera}`;
    if (view.aim) {
      // load the tiles around the box first: the target height comes from them
      await go(page, perspective(id, centreOf(view.aim.box), view.aim));
      await settle(page, id);
      let target = await aimTarget(page, view.aim);
      for (let attempt = 1; ; attempt++) {
        hash = perspective(id, target, view.aim);
        await go(page, hash);
        await settle(page, id);
        const y = await targetY(page);
        if (Math.abs(y - target[1]) <= 1) break;
        if (attempt === 3 || Number.isNaN(y)) {
          problems.push(`${view.file}: the camera target settled at y ${y.toFixed(1)}, not ${target[1].toFixed(1)}`);
          break;
        }
        // the height controls also keep the camera above the terrain under it: refit around where it settled
        target = [target[0], y, target[2]];
      }
    } else {
      await go(page, hash);
      await settle(page, id);
    }
    settled.set(view.file, await targetY(page));
    const size = await capture(page, view.file);
    const group = map.machines ? "endgame" : "gallery";
    return { ...view, hash, map: id, texture: map.texture, group, ...size };
  };
  try {
    for (const map of maps) {
      const id = mapId(map);
      const views = [...map.views, ...(map.machines ? machineViews(map.scene) : [])];
      if (views.length === 0) continue;
      const taken: Shot[] = new Array(views.length);
      const run = Math.ceil(views.length / Math.max(1, Math.min(pages, views.length)));
      const runs: [number, number][] = [];
      for (let first = 0; first < views.length; first += run) runs.push([first, Math.min(first + run, views.length)]);
      await Promise.all(
        runs.map(async ([first, end]) => {
          const camera = views[first].camera;
          const page = await open(id, camera ? `${id}:${camera}` : id);
          try {
            for (let i = first; i < end; i++) taken[i] = await shoot(page, map, views[i]);
          } finally {
            await page.context().close();
          }
        }),
      );
      shots.push(...taken);
      if (map.machines && !start) start = taken[0].hash; // the overview opens the live map
    }

    // Modernity vs default: the same camera on the default-texture end-game map
    const other = maps.find((m) => m.scene === "endgame" && m.texture === "default");
    if (other) {
      const id = mapId(other);
      const page = await open(id, id);
      for (const key of COMPARE) {
        const modernity = shots.find((s) => s.group === "endgame" && s.file === `endgame-${key}.jpg`);
        if (!modernity) continue;
        const hash = modernity.hash.replace(/^[^:]+/, id);
        await go(page, hash);
        await settle(page, id);
        // both shots must come from the same camera, or the slider does not line up; Modernity's models may differ a
        // little where the height controls look, a fraction of a block moves the view by about a pixel
        const y = await targetY(page);
        if (!(Math.abs(y - (settled.get(modernity.file) ?? NaN)) <= 0.5)) {
          problems.push(`compare ${key}: camera target y ${y}, ${settled.get(modernity.file)} on the Modernity map`);
        }
        const file = `endgame-${key}-default.jpg`;
        const size = await capture(page, file);
        comparisons.push({
          key,
          title: modernity.title,
          caption: modernity.caption,
          hash: modernity.hash,
          modernity: modernity.file,
          default: file,
          ...size,
        });
      }
      await page.context().close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  fs.writeFileSync(
    path.join(GALLERY, "gallery.json"),
    JSON.stringify({ generated: new Date().toISOString(), start, images: shots, compare: comparisons }, null, 2),
  );
  // the live map opens on the plaza overview
  if (start) updateSettings({ startLocation: start });
  if (problems.length > 0) fail(`failed requests, page errors or misaimed cameras:\n${problems.join("\n")}`);
}

function size(dir: string): number {
  return walk(dir).reduce((sum, file) => sum + fs.statSync(file).size, 0);
}

async function main(): Promise<void> {
  const maps = selectedMaps();
  if (!args["skip-render"]) {
    const repo = path.join(WS, "BlueMap");
    if (!fs.existsSync(path.join(repo, "settings.gradle.kts"))) fail(`BlueMap checkout not found at ${repo}`);
    for (const map of maps) {
      if (!fs.existsSync(path.join(WORLDS, map.scene, "level.dat"))) {
        fail(`scene world missing: ${path.relative(WS, WORLDS)}/${map.scene} (cd orchestrator && ${ORCH_SCENE} ${map.scene})`);
      }
    }
    if (args.build) buildJars(repo);
    const jars = locateJars(repo);
    log(`cli ${path.relative(WS, jars.cli)}; addons ${jars.addons.map((j) => path.basename(j)).join(", ")}`);
    const threads = Number(args.threads ?? Math.max(1, os.availableParallelism() - 2));
    fs.rmSync(DEMO, { recursive: true, force: true });
    fs.mkdirSync(WORK, { recursive: true });
    fs.mkdirSync(LOGS, { recursive: true });
    seedDownloads();
    for (const texture of [...new Set(maps.map((m) => m.texture))]) {
      const config = writeConfig(
        maps.filter((m) => m.texture === texture),
        texture,
        jars,
        threads,
      );
      render(jars.cli, config, texture);
    }
    finishWebroot(maps);
  } else if (!fs.existsSync(path.join(DEMO, "settings.json"))) {
    fail("public/demo has not been rendered yet; run `pnpm demo` without --skip-render");
  }
  // pages of software WebGL side by side: one keeps about 14 of 32 CPUs busy
  await gallery(maps, Number(args.pages ?? Math.max(1, Math.floor(os.availableParallelism() / 16))));
  for (const dir of [DEMO, GALLERY]) {
    log(`${path.relative(SITE, dir)}: ${(size(dir) / 1024 / 1024).toFixed(1)} MiB`);
  }
  for (const map of maps) {
    log(`maps/${mapId(map)}: ${(size(path.join(DEMO, "maps", mapId(map))) / 1024 / 1024).toFixed(1)} MiB`);
  }
}

await main();
