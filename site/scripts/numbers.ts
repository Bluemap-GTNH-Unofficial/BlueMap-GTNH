// The single source of the numbers the documentation quotes (oracle pass rates, export counts, e2e views, scene
// counts): reads the pipeline outputs in WS/out/, writes data/results-<pack version>.json (committed, because the
// Pages build has no out/) and rewrites the marked parts of the READMEs from it. The site renders the same snapshot
// (data/results.data.ts, `{{ n.<path> }}` in the pages, <ResultsTable>); data/numbers.ts formats both.
//
//   node scripts/numbers.ts           snapshot from WS/out/, then the README parts   (mise run docs:numbers)
//   node scripts/numbers.ts --check   exit 1 if a README part or a page's `{{ n.<path> }}` does not match the
//                                     snapshot, or, when WS/out/ has every input, the snapshot does not match WS/out/
//
// README markers: a block `<!-- numbers:NAME -->` ... `<!-- /numbers -->` on lines of their own (NAME from blocks() in
// data/numbers.ts; the lines keep the opening marker's indentation), or one value inline:
// `<!-- n:PATH -->...<!-- /n -->` (PATH from values(), e.g. `states.default.rate`).
//
// The swap tests are not pipeline tasks: after a recalibration run `uv run --directory e2e e2e oracle swap-test` and
// `... e2e oracle world-swap-test` (about 90 s together); the snapshot refuses swap results of other thresholds.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { blocks, sceneOrder, tables, valueAt, values } from "../data/numbers.ts";
import type { ExportRun, SceneRun, Snapshot, StateRun, Thresholds } from "../data/numbers.ts";

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WS = path.resolve(process.env.BMGTNH_WORKSPACE ?? path.join(SITE, ".."));
const PACK = process.env.BMGTNH_PACK_VERSION ?? "2.9.0";
const SNAPSHOT = path.join(SITE, "data", `results-${PACK}.json`);
const READMES = ["README.md", "e2e/README.md", "gtnh-exporter/README.md", "modernity/README.md"];
const WIDTH = 120; // the READMEs' line length
const MODS = ["gregtech"]; // state oracle mods the pages quote
const GT_MACHINE_SCENES = ["gt-machines", "gt-pipes", "gt-multiblocks"];

const { values: args } = parseArgs({ options: { check: { type: "boolean", default: false } } });

function fail(message: string): never {
  console.error(`numbers: ${message}`);
  process.exit(1);
}

const out = (...parts: string[]) => path.join(WS, "out", ...parts);
const oracle = (...parts: string[]) => out(`oracle-${PACK}`, ...parts);

/** Every file the snapshot is made from, so `--check` can tell a complete WS/out/ from a partial one. */
function inputs(): string[] {
  return [
    ...["default", "modernity"].map((v) => oracle(v, "states", "report.json")),
    oracle("default", "states", "calibration.json"),
    oracle("default", "states", "swap-test.json"),
    ...["default", "modernity", "addons"].map((v) => oracle(v, "worlds", "summary.json")),
    oracle("default", "worlds", "calibration.json"),
    oracle("default", "worlds", "swap-test.json"),
    out(`exporter-${PACK}`, "export-report.json"),
    out(`exporter-addons-${PACK}`, "export-report.json"),
    out("modernity", "export-modernity", "export-report.json"),
    ...[...GT_MACHINE_SCENES, "gt-ores"].map((scene) => out(`scenes-${PACK}`, scene, "dump.ndjson")),
    out(`scenes-${PACK}`, "gt-multiblocks", "multiblocks.json"),
    out(`e2e-${PACK}`),
  ];
}

// The parts of the pipeline's reports read here (written by e2e, the exporter and the orchestrator).
interface StatesReport {
  created: string;
  total: { states: number; judged: number; pass: number; accepted: number; clientBlank: number; clientError: number };
  thresholds: { view: Thresholds; face: Thresholds };
  mods: Record<string, { judged: number; pass: number }>;
}
type FalseFailures = Record<"texture" | "geometry", { states: number; fail: number }>;
interface StatesCalibration {
  view: { thresholds: Thresholds };
  face: { thresholds: Thresholds };
  falseFailures: FalseFailures;
}
interface StatesSwap {
  created: string;
  differingStates: number;
  judges: { current: { thresholds: unknown; flagged: number } };
}
interface WorldSummary {
  scenes: Record<string, {
    created: string;
    summary: { views: number; views_aligned: number; judged: number; passed: number; accepted: number };
  }>;
}
type WorldFalseFailures = Record<"texture" | "geometry", { states: number; states_fail: number; faces: number; faces_fail: number }>;
interface WorldCalibration {
  scene: string;
  thresholds: Thresholds;
  falseFailures: WorldFalseFailures;
}
interface WorldSwap {
  created: string;
  totals: {
    current: {
      differing: number;
      flagged: number;
      same: number;
      same_failing: number;
      by_difference: Record<string, { faces: number; flagged: number }>;
    };
  };
  results: { scene: string; judges: { current: { thresholds: unknown } } }[];
}
interface ExportReport {
  modData: { myctmlibTextures: number };
  total: { blocks: number; states: number; failed: number; failedReasons: Record<string, number> };
  mods: Record<string, unknown>;
  gregtech: { mte: { total: number; ok: number; failed: number }; casings: number; casingErrors: number };
}

/** A JSON file, typed as what the caller reads of it (the reports are other tools' output, read as written). */
function json<T>(file: string): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch (e) {
    fail(`cannot read ${path.relative(WS, file)}: ${(e as Error).message}`);
  }
}

function stateRun(variant: string): StateRun {
  const r = json<StatesReport>(oracle(variant, "states", "report.json"));
  const t = r.total;
  return {
    created: r.created,
    states: t.states,
    judged: t.judged,
    passed: t.pass,
    accepted: t.accepted,
    clientBlank: t.clientBlank,
    clientError: t.clientError,
    thresholds: { view: r.thresholds.view, face: r.thresholds.face },
    mods: Object.fromEntries(MODS.map((mod) => [mod, { judged: r.mods[mod].judged, passed: r.mods[mod].pass }])),
  };
}

function worldRuns(variant: string): Record<string, SceneRun> {
  const scenes = json<WorldSummary>(oracle(variant, "worlds", "summary.json")).scenes;
  return Object.fromEntries(
    sceneOrder(Object.keys(scenes)).map((name) => {
      const s = scenes[name].summary;
      return [name, {
        created: scenes[name].created,
        views: s.views,
        viewsAligned: s.views_aligned,
        judged: s.judged,
        passed: s.passed,
        accepted: s.accepted,
      }];
    }),
  );
}

function exportRun(file: string): ExportRun {
  const r = json<ExportReport>(file);
  return {
    blocks: r.total.blocks,
    states: r.total.states,
    mods: Object.keys(r.mods).length,
    failed: r.total.failed,
    failedReasons: r.total.failedReasons,
    mte: { total: r.gregtech.mte.total, ok: r.gregtech.mte.ok, failed: r.gregtech.mte.failed },
    casings: r.gregtech.casings,
    casingErrors: r.gregtech.casingErrors,
    ctmTextures: r.modData.myctmlibTextures,
  };
}

/** Blocks of the dump whose registry name starts with `prefix`. */
function dumpCount(scene: string, prefix: string): number {
  const file = out(`scenes-${PACK}`, scene, "dump.ndjson");
  let count = 0;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (line.includes(`"name":"${prefix}`)) count++;
  }
  return count;
}

function snapshot(): Snapshot {
  const states = { default: stateRun("default"), modernity: stateRun("modernity") };

  const stateCal = json<StatesCalibration>(oracle("default", "states", "calibration.json"));
  const stateSwap = json<StatesSwap>(oracle("default", "states", "swap-test.json"));
  const stateThresholds = { view: stateCal.view.thresholds, face: stateCal.face.thresholds };
  if (JSON.stringify(stateSwap.judges.current.thresholds) !== JSON.stringify(stateThresholds)) {
    fail("states/swap-test.json was measured with other thresholds than the current calibration: run `uv run --directory e2e e2e oracle swap-test`");
  }

  const worldCal = json<WorldCalibration>(oracle("default", "worlds", "calibration.json"));
  const worldSwap = json<WorldSwap>(oracle("default", "worlds", "swap-test.json"));
  if (worldSwap.results.some((r) => JSON.stringify(r.judges.current.thresholds) !== JSON.stringify(worldCal.thresholds))) {
    fail("worlds/swap-test.json was measured with other thresholds than the current calibration: run `uv run --directory e2e e2e oracle world-swap-test`");
  }
  const worldFailures = (name: "texture" | "geometry") => {
    const f = worldCal.falseFailures[name];
    return { states: f.states, failing: f.states_fail, faces: f.faces, facesFailing: f.faces_fail };
  };
  const swapTotals = worldSwap.totals.current;

  const e2eDir = out(`e2e-${PACK}`);
  const e2e: Snapshot["e2e"] = {};
  for (const scene of sceneOrder(fs.readdirSync(e2eDir))) {
    const report = path.join(e2eDir, scene, "report.json");
    if (!fs.existsSync(report)) continue;
    const views = json<{ views: unknown[] }>(report).views.length;
    if (views > 0) e2e[scene] = { views };
  }

  const multiblocks = json<{ formed: boolean }[]>(out(`scenes-${PACK}`, "gt-multiblocks", "multiblocks.json"));

  return {
    packVersion: PACK,
    states,
    statesCalibration: {
      texture: { states: stateCal.falseFailures.texture.states, failing: stateCal.falseFailures.texture.fail },
      geometry: { states: stateCal.falseFailures.geometry.states, failing: stateCal.falseFailures.geometry.fail },
    },
    statesSwap: { created: stateSwap.created, differing: stateSwap.differingStates, flagged: stateSwap.judges.current.flagged },
    worlds: { default: worldRuns("default"), modernity: worldRuns("modernity"), addons: worldRuns("addons") },
    worldsCalibration: {
      scene: worldCal.scene,
      thresholds: worldCal.thresholds,
      texture: worldFailures("texture"),
      geometry: worldFailures("geometry"),
    },
    worldsSwap: {
      created: worldSwap.created,
      scenes: [...new Set(worldSwap.results.map((r) => r.scene))],
      differing: swapTotals.differing,
      flagged: swapTotals.flagged,
      same: swapTotals.same,
      sameFailing: swapTotals.same_failing,
      byDifference: swapTotals.by_difference,
    },
    exports: {
      default: exportRun(out(`exporter-${PACK}`, "export-report.json")),
      addons: exportRun(out(`exporter-addons-${PACK}`, "export-report.json")),
      modernity: exportRun(out("modernity", "export-modernity", "export-report.json")),
    },
    e2e,
    scenes: {
      gtMachines: Object.fromEntries(GT_MACHINE_SCENES.map((s) => [s, dumpCount(s, "gregtech:gt.blockmachines")])),
      gtOres: dumpCount("gt-ores", "gregtech:gt.blockores"),
      multiblocks: multiblocks.length,
      multiblocksFormed: multiblocks.filter((m) => m.formed).length,
    },
  };
}

function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  return [...lines, line];
}

/** The lines of a block at `indent`: alert titles and blank lines as they are, paragraphs (`> ` quoted too) wrapped. */
function blockLines(parts: string[], indent: string): string[] {
  const width = WIDTH - indent.length;
  return parts.flatMap((part) => {
    if (part === "" || part.startsWith("> [!")) return [part];
    if (part.startsWith("> ")) return wrap(part.slice(2), width - 2).map((l) => `> ${l}`);
    return wrap(part, width);
  }).map((l) => (l ? indent + l : l));
}

const BLOCK = /^([ \t]*)<!-- numbers:([\w-]+) -->\r?\n[\s\S]*?^[ \t]*<!-- \/numbers -->/gm;
const INLINE = /<!-- n:([\w.-]+) -->([\s\S]*?)<!-- \/n -->/g;

/** The README with its marked parts generated from the snapshot. */
function render(text: string, file: string, s: Snapshot): string {
  const v = values(s);
  const b = blocks(s);
  if ((text.match(/<!-- numbers:/g) ?? []).length !== (text.match(BLOCK) ?? []).length) {
    fail(`${file}: a <!-- numbers:NAME --> block without its <!-- /numbers -->`);
  }
  // A line that starts with an HTML comment is an HTML block in markdown: its markdown would show as written.
  const lineStart = text.split("\n").findIndex((line) => /^\s*<!-- n:/.test(line));
  if (lineStart >= 0) fail(`${file}:${lineStart + 1}: an inline <!-- n:... --> marker must not start a line`);
  return text
    .replace(BLOCK, (_, indent: string, name: string) => {
      if (!b[name]) fail(`${file}: no block named ${name}`);
      return [`${indent}<!-- numbers:${name} -->`, ...blockLines(b[name], indent), `${indent}<!-- /numbers -->`].join("\n");
    })
    .replace(INLINE, (_, key: string) => `<!-- n:${key} -->${valueAt(v, key)}<!-- /n -->`);
}

/** `{{ n.<path> }}` and `<ResultsTable name="...">` in the site's pages: each must name a value or a table. */
function checkPages(s: Snapshot): string[] {
  const v = values(s);
  const t = tables(s);
  const problems: string[] = [];
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      if (["node_modules", ".vitepress", "public", "scripts", "data"].includes(e.name)) return [];
      const p = path.join(dir, e.name);
      return e.isDirectory() ? walk(p) : e.name.endsWith(".md") ? [p] : [];
    });
  for (const page of walk(SITE)) {
    const text = fs.readFileSync(page, "utf8");
    for (const m of text.matchAll(/\{\{\s*n\.([\w.]+(?:\[["'][\w-]+["']\][\w.]*)*)\s*\}\}/g)) {
      try {
        valueAt(v, m[1].replace(/\[["']([\w-]+)["']\]/g, ".$1"));
      } catch {
        problems.push(`${path.relative(WS, page)}: {{ n.${m[1]} }} names no number`);
      }
    }
    for (const m of text.matchAll(/<ResultsTable name="([^"]*)"/g)) {
      if (!t[m[1]]) problems.push(`${path.relative(WS, page)}: no results table named ${m[1]}`);
    }
  }
  return problems;
}

const stale: string[] = [];
let s: Snapshot;
const missing = inputs().filter((f) => !fs.existsSync(f));
if (args.check) {
  if (!fs.existsSync(SNAPSHOT)) fail(`${path.relative(WS, SNAPSHOT)} is missing: run \`mise run docs:numbers\``);
  s = json<Snapshot>(SNAPSHOT);
  if (missing.length === 0) {
    if (JSON.stringify(snapshot(), null, 1) !== JSON.stringify(s, null, 1)) {
      stale.push(`${path.relative(WS, SNAPSHOT)} does not match WS/out/`);
    }
  } else {
    console.log(`numbers: WS/out/ lacks ${missing.length} input(s) (${path.relative(WS, missing[0])}, ...): checking against the snapshot only`);
  }
  stale.push(...checkPages(s));
} else {
  if (missing.length > 0) fail(`missing pipeline outputs:\n  ${missing.map((f) => path.relative(WS, f)).join("\n  ")}`);
  s = snapshot();
  const text = `${JSON.stringify(s, null, 1)}\n`;
  if (!fs.existsSync(SNAPSHOT) || fs.readFileSync(SNAPSHOT, "utf8") !== text) {
    fs.writeFileSync(SNAPSHOT, text);
    console.log(`numbers: wrote ${path.relative(WS, SNAPSHOT)}`);
  }
  const problems = checkPages(s);
  if (problems.length > 0) fail(problems.join("\n"));
}

for (const readme of READMES) {
  const file = path.join(WS, readme);
  if (!fs.existsSync(file)) continue; // a submodule that is not checked out
  const text = fs.readFileSync(file, "utf8");
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const updated = render(text.replaceAll("\r\n", "\n"), readme, s).replaceAll("\n", eol);
  if (updated === text) continue;
  if (args.check) {
    stale.push(`${readme}: marked numbers differ from the snapshot`);
  } else {
    fs.writeFileSync(file, updated);
    console.log(`numbers: updated ${readme}`);
  }
}

if (stale.length > 0) fail(`${stale.join("\n  ")}\n(stale numbers: \`mise run docs:numbers\` regenerates them)`);
console.log(args.check ? "numbers: up to date" : `numbers: ${path.relative(WS, SNAPSHOT)} and the READMEs are current`);
