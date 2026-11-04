// The results snapshot (data/results-<pack version>.json, written by scripts/numbers.ts from the pipeline outputs in
// WS/out/) and what is derived from it: the formatted values and tables the site pages render (results.data.ts,
// ResultsTable.vue, the home page features in config.mts) and the README blocks scripts/numbers.ts rewrites. One module
// for both, so a number reads the same everywhere. Plain TypeScript that Node runs as is (type stripping).

export interface Thresholds {
  iou_min: number;
  delta_e_max: number;
  ssim_min: number;
  min_pixels: number;
}

/** One variant of the state oracle (`e2e oracle states`, out/oracle-<pack>/<variant>/states/report.json). */
export interface StateRun {
  created: string;
  states: number;
  judged: number;
  passed: number;
  accepted: number;
  clientBlank: number;
  clientError: number;
  thresholds: { view: Thresholds; face: Thresholds };
  mods: Record<string, { judged: number; passed: number }>;
}

/** One scene of the world oracle (`e2e oracle world`, out/oracle-<pack>/<variant>/worlds/summary.json). */
export interface SceneRun {
  created: string;
  views: number;
  viewsAligned: number;
  judged: number;
  passed: number;
  accepted: number;
}

export interface CalibrationFailures {
  states: number;
  failing: number;
}

export interface WorldCalibrationFailures extends CalibrationFailures {
  faces: number;
  facesFailing: number;
}

/** One export (export-report.json of the default, addon and Modernity exports). */
export interface ExportRun {
  blocks: number;
  states: number;
  mods: number;
  failed: number;
  failedReasons: Record<string, number>;
  mte: { total: number; ok: number; failed: number };
  casings: number;
  casingErrors: number;
  /** Connected-texture entries of the pack (gtnh/mods/myctmlib.json). */
  ctmTextures: number;
}

export interface Snapshot {
  packVersion: string;
  states: { default: StateRun; modernity: StateRun };
  statesCalibration: { texture: CalibrationFailures; geometry: CalibrationFailures };
  /** `e2e oracle swap-test`: the Modernity client's renders judged as BlueMap renders against the default client. */
  statesSwap: { created: string; differing: number; flagged: number };
  worlds: { default: Record<string, SceneRun>; modernity: Record<string, SceneRun>; addons: Record<string, SceneRun> };
  worldsCalibration: {
    scene: string;
    thresholds: Thresholds;
    texture: WorldCalibrationFailures;
    geometry: WorldCalibrationFailures;
  };
  /** `e2e oracle world-swap-test`: each variant's BlueMap judged against the other variant's client, both directions. */
  worldsSwap: {
    created: string;
    scenes: string[];
    differing: number;
    flagged: number;
    same: number;
    sameFailing: number;
    byDifference: Record<string, { faces: number; flagged: number }>;
  };
  exports: { default: ExportRun; addons: ExportRun; modernity: ExportRun };
  /** Browser e2e views per scene (out/e2e-<pack>/<scene>/report.json); scenes without views are left out. */
  e2e: Record<string, { views: number }>;
  /** Counts from the scene dumps (out/scenes-<pack>/). */
  scenes: { gtMachines: Record<string, number>; gtOres: number; multiblocks: number; multiblocksFormed: number };
}

export const VARIANT_NAMES: Record<string, string> = {
  default: "default",
  modernity: "Modernity-GTNH",
  addons: "addons",
};

// Scenes in the order the pages list them; scenes not named here follow alphabetically.
const SCENE_ORDER = [
  "vanilla-zoo", "gtnh-zoo", "gt-machines", "gt-pipes", "gt-ores", "gt-multiblocks", "mod-renderers", "endgame",
  "addons-zoo", "addons-machines", "addons-multiblocks", "addons-tesr",
];

export function sceneOrder(scenes: Iterable<string>): string[] {
  const rank = (s: string) => (SCENE_ORDER.includes(s) ? SCENE_ORDER.indexOf(s) : SCENE_ORDER.length);
  return [...scenes].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

export function num(n: number): string {
  return n.toLocaleString("en-US");
}

/** A share as a percentage with two decimals ("78.10%"); "n/a" without a whole. */
export function pct(part: number, whole: number): string {
  return whole > 0 ? `${((100 * part) / whole).toFixed(2)}%` : "n/a";
}

function countOf(passed: number, judged: number) {
  return { passed: num(passed), judged: num(judged), rate: pct(passed, judged), failRate: pct(judged - passed, judged) };
}

function sum(runs: SceneRun[], key: keyof SceneRun): number {
  return runs.reduce((total, run) => total + (run[key] as number), 0);
}

function thresholdValues(t: Thresholds) {
  return { iou: String(t.iou_min), deltaE: String(t.delta_e_max), ssim: String(t.ssim_min), minPixels: num(t.min_pixels) };
}

function stateValues(run: StateRun) {
  return {
    ...countOf(run.passed, run.judged),
    states: num(run.states),
    accepted: num(run.accepted),
    clientBlank: num(run.clientBlank),
    clientError: num(run.clientError),
  };
}

function worldValues(scenes: Record<string, SceneRun>) {
  const runs = Object.values(scenes);
  return {
    scenes: Object.fromEntries(Object.entries(scenes).map(([name, run]) => [name, countOf(run.passed, run.judged)])),
    total: {
      ...countOf(sum(runs, "passed"), sum(runs, "judged")),
      scenes: num(runs.length),
      views: num(sum(runs, "views")),
      viewsAligned: num(sum(runs, "viewsAligned")),
    },
  };
}

function exportValues(run: ExportRun) {
  return {
    blocks: num(run.blocks),
    states: num(run.states),
    mods: num(run.mods),
    failed: num(run.failed),
    errorIcon: num(run.failedReasons.error_icon ?? 0),
    mte: num(run.mte.total),
    mteOk: num(run.mte.ok),
    mteFailed: num(run.mte.failed),
    casings: num(run.casings),
    casingErrors: num(run.casingErrors),
    ctmTextures: num(run.ctmTextures),
  };
}

/** Every number the pages and READMEs quote, formatted, by path (`states.default.rate`). */
export function values(s: Snapshot) {
  const gregtech = s.states.default.mods.gregtech;
  const bins = s.worldsSwap.byDifference;
  const strong = bins["20-inf"];
  const faint = bins["1-2"];
  const tex = s.worldsCalibration.texture;
  const geo = s.worldsCalibration.geometry;
  return {
    packVersion: s.packVersion,
    states: {
      default: stateValues(s.states.default),
      modernity: stateValues(s.states.modernity),
      vanilla: num(s.states.default.states - s.exports.default.states),
      gregtech: countOf(gregtech.passed, gregtech.judged),
      thresholds: { view: thresholdValues(s.states.default.thresholds.view), face: thresholdValues(s.states.default.thresholds.face) },
      calibration: {
        texture: countOf(s.statesCalibration.texture.states - s.statesCalibration.texture.failing, s.statesCalibration.texture.states),
        geometry: countOf(s.statesCalibration.geometry.states - s.statesCalibration.geometry.failing, s.statesCalibration.geometry.states),
      },
      swap: { flagged: num(s.statesSwap.flagged), differing: num(s.statesSwap.differing), rate: pct(s.statesSwap.flagged, s.statesSwap.differing) },
    },
    worlds: {
      default: worldValues(s.worlds.default),
      modernity: worldValues(s.worlds.modernity),
      addons: worldValues(s.worlds.addons),
      calibration: {
        scene: s.worldsCalibration.scene,
        thresholds: thresholdValues(s.worldsCalibration.thresholds),
        texture: { failing: num(tex.failing), states: num(tex.states), rate: pct(tex.failing, tex.states), facesFailing: num(tex.facesFailing) },
        geometry: { failing: num(geo.failing), states: num(geo.states), rate: pct(geo.failing, geo.states), facesFailing: num(geo.facesFailing) },
      },
      swap: {
        scenes: s.worldsSwap.scenes,
        flagged: num(s.worldsSwap.flagged),
        differing: num(s.worldsSwap.differing),
        rate: pct(s.worldsSwap.flagged, s.worldsSwap.differing),
        strong: { flagged: num(strong.flagged), faces: num(strong.faces), rate: pct(strong.flagged, strong.faces) },
        faint: { flagged: num(faint.flagged), faces: num(faint.faces), rate: pct(faint.flagged, faint.faces) },
        same: num(s.worldsSwap.same),
        sameFailing: num(s.worldsSwap.sameFailing),
        sameRate: pct(s.worldsSwap.sameFailing, s.worldsSwap.same),
      },
    },
    exports: { default: exportValues(s.exports.default), addons: exportValues(s.exports.addons), modernity: exportValues(s.exports.modernity) },
    e2e: {
      scenes: num(Object.keys(s.e2e).length),
      views: num(Object.values(s.e2e).reduce((total, scene) => total + scene.views, 0)),
    },
    scenes: {
      gtMachines: num(Object.values(s.scenes.gtMachines).reduce((a, b) => a + b, 0)),
      gtMachineScenes: sceneOrder(Object.keys(s.scenes.gtMachines)),
      gtOres: num(s.scenes.gtOres),
      multiblocks: num(s.scenes.multiblocks),
      multiblocksFormed: num(s.scenes.multiblocksFormed),
    },
  };
}

/** The value at a dotted path (`worlds.default.scenes.gt-ores.rate`); throws on a path that names no string. */
export function valueAt(v: object, key: string): string {
  let at: unknown = v;
  for (const part of key.split(".")) at = (at as Record<string, unknown> | undefined)?.[part];
  if (typeof at !== "string") throw new Error(`no number named ${key}`);
  return at;
}

/** A table: header and rows of cells in inline markdown (`code`, **bold**). */
export interface Table {
  header: string[];
  rows: string[][];
}

export function tables(s: Snapshot): Record<string, Table> {
  const v = values(s);
  const look = (name: "default" | "modernity") => {
    const r = v.states[name];
    return [VARIANT_NAMES[name], r.judged, r.passed, `**${r.rate}**`, r.accepted, r.clientBlank, r.clientError];
  };
  const worldCell = (variant: "default" | "modernity" | "addons", scene: string) => {
    const c = v.worlds[variant].scenes[scene];
    return c ? `${c.passed} of ${c.judged} (${c.rate})` : "not run";
  };
  const worldScenes = sceneOrder(new Set([...Object.keys(s.worlds.default), ...Object.keys(s.worlds.modernity)]));
  const total = (variant: "default" | "modernity") => {
    const t = v.worlds[variant].total;
    return `${t.passed} of ${t.judged} (${t.rate})`;
  };
  const wc = v.worlds.calibration;
  const ws = v.worlds.swap;
  return {
    "oracle-states": {
      header: ["Look", "Judged", "Pass", "Pass rate", "Accepted (1.13)", "Client draws nothing", "Client throws"],
      rows: [look("default"), look("modernity")],
    },
    "oracle-worlds": {
      header: ["Scene", VARIANT_NAMES.default, VARIANT_NAMES.modernity],
      rows: [
        ...worldScenes.map((scene) => [`\`${scene}\``, worldCell("default", scene), worldCell("modernity", scene)]),
        ["all of the above", total("default"), total("modernity")],
      ],
    },
    "oracle-worlds-addons": {
      header: ["Scene", "Faces passing"],
      rows: sceneOrder(Object.keys(s.worlds.addons)).map((scene) => [`\`${scene}\``, worldCell("addons", scene)]),
    },
    "oracle-trust": {
      header: ["", "Detection (known-different flagged)", "False failures"],
      rows: [
        [
          "State oracle",
          `${v.states.swap.flagged} of ${v.states.swap.differing} differing states (${v.states.swap.rate})`,
          `${num(s.statesCalibration.texture.failing)} of ${num(s.statesCalibration.texture.states)} calibration states for ` +
            `colour (${v.states.calibration.texture.failRate}), ${num(s.statesCalibration.geometry.failing)} of ` +
            `${num(s.statesCalibration.geometry.states)} for geometry (${v.states.calibration.geometry.failRate})`,
        ],
        [
          "World oracle",
          `${ws.flagged} of ${ws.differing} differing faces (${ws.rate}): ${ws.strong.flagged} of ${ws.strong.faces} ` +
            `(${ws.strong.rate}) where the two clients' captures of the face differ by a mean of 20 or more RGB levels, ` +
            `${ws.faint.flagged} of ${ws.faint.faces} where they differ by 1–2`,
          `${ws.sameFailing} of ${ws.same} faces the two clients draw alike (${ws.sameRate}); on \`${wc.scene}\` ` +
            `${wc.texture.failing} of ${wc.texture.states} calibration states for colour (${wc.texture.rate}, ` +
            `${wc.texture.facesFailing} faces) and ${wc.geometry.failing} of ${wc.geometry.states} for geometry ` +
            `(${wc.geometry.rate}, ${wc.geometry.facesFailing} faces)`,
        ],
      ],
    },
  };
}

/** The README blocks (`<!-- numbers:NAME -->` ... `<!-- /numbers -->`): paragraphs to wrap, `> [!NOTE]` alert titles. */
export function blocks(s: Snapshot): Record<string, string[]> {
  const v = values(s);
  const d = v.states.default;
  const m = v.states.modernity;
  const wd = v.worlds.default.total;
  const wm = v.worlds.modernity.total;
  const sv = v.states.thresholds.view;
  const sf = v.states.thresholds.face;
  const modernityScenes = sceneOrder(Object.keys(s.worlds.modernity));
  return {
    "readme-oracle": [
      `Rendering is checked against the **real GTNH client** (the e2e repository's oracle): on ${v.packVersion}, ` +
        `${d.rate} of ${d.judged} judged block states and ${wd.rate} of ${wd.judged} judged block faces in ${wd.scenes} ` +
        "test scene worlds match the client within thresholds calibrated on data; see [Status](site/status.md) for the " +
        "numbers per scene and the known gaps. The optional [Modernity-GTNH](https://github.com/ModernityGTNH/Modernity-GTNH) " +
        `look is checked the same way (${m.rate} of judged states, ${wm.rate} of judged faces in ${wm.scenes} scenes).`,
    ],
    "e2e-states-calibration": [
      `The ${v.packVersion} default run calibrated: view IoU ${sv.iou}, delta E max ${sv.deltaE}, SSIM min ${sv.ssim}; ` +
        `face IoU ${sf.iou}, delta E max ${sf.deltaE}, SSIM min ${sf.ssim}. With them, ${d.passed} of the ${d.judged} ` +
        `judged states pass (${d.rate}; ${d.accepted} accepted (1.13), ${d.clientBlank} client blank, ${d.clientError} ` +
        `client error); Modernity: ${m.passed} of ${m.judged} (${m.rate}).`,
    ],
    "modernity-oracle": [
      "> [!NOTE]",
      `> Modernity-GTNH maps are checked against a real GTNH ${v.packVersion} client running Modernity-GTNH and ` +
        "MyCTMLib, with the e2e repository's oracle. On the state oracle (`e2e oracle states --variant modernity`, " +
        `every block state drawn alone) ${m.passed} of ${m.judged} judged states match that client (${m.rate}), against ` +
        `${d.rate} for the default packs and the default client. On the world oracle (\`e2e oracle world --variant ` +
        `modernity\`, every visible block face of a scene) ${wm.passed} of ${wm.judged} judged faces pass (${wm.rate}): ` +
        modernityScenes.map((scene) => `${scene} ${v.worlds.modernity.scenes[scene].rate}`).join(", ") +
        ` (default packs on the same scenes: ${modernityScenes.map((scene) => v.worlds.default.scenes[scene]?.rate ?? "not run").join(", ")}). ` +
        "Connected textures (MyCTMLib sheets and GT's " +
        "MCPatcher compact glass), self-culling BartWorks glass, hatches joining their casings, panes and Werkstoff " +
        `layer order were fixed against that client. Details: \`WS/out/oracle-${v.packVersion}/SUMMARY.md\` and the site's status page.`,
    ],
  };
}
