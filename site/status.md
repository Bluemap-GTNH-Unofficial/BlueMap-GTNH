<script setup>
import { data as n } from "./data/results.data.ts";
</script>

# Status

This page describes the current source: the server mod released as **`v5.29-gtnh.2`** (BlueMap 5.29 plus the port)
and the exporter and launcher released as **`exporter-0.2.1`**. It supports **GT New Horizons 2.9.0** only, and every
number on this page was measured on 2.9.0, on one machine.

> [!WARNING] Unofficial, vibe coded, no guarantee
> This project is **not** affiliated with, endorsed by or supported by [BlueMap](https://github.com/BlueMap-Minecraft/BlueMap)
> or the [GT New Horizons](https://github.com/GTNewHorizons) team; do not report problems with this port to them. Most
> of the code, tests and documentation were written by an AI coding agent under human direction. It is tested (see
> [verification](#verification)) but has not been audited. There is **no warranty and no quality guarantee**.
> **Back up your world before installing it.**

## What works

- **World reading.** 1.7.10 Anvil regions with EndlessIDs / ChunkAPI extended IDs and metadata, block names from the
  FML registry in `level.dat`. Checked block by block against dumps taken from the live server on 12 test scenes:
  0 mismatches.
- **Vanilla blocks.** 1.7.10 IDs and metadata are flattened to 1.13 block states, including shapes that depend on
  neighbours (stairs, fences, panes, redstone, doors and so on). Compared with a real Minecraft 1.13.2 world upgrade
  over 905,216 positions; every remaining difference is a deliberate choice to keep the 1.7 look.
- **Modded blocks.** The client exporter captures the appearance of every block state the pack registers
  ({{ n.exports.default.blocks }} blocks, {{ n.exports.default.states }} states from {{ n.exports.default.mods }} mods,
  in 51 s). On the `gtnh-zoo` test scene, 14,887 of 16,266 placed modded states (91.52%) render with their own model
  (simple bounding-box fallbacks counted).
- **Dedicated renderers** for GregTech machines, pipes, cables, ores and frames; connected textures (Chisel, MyCTMLib
  and GregTech's MCPatcher glass, with hatches joining their casings); Iron Chests; BiblioCraft (partial); Applied
  Energistics 2 cables, parts and facades; EnderIO conduits.
- **Modernity-GTNH.** The optional [`modernity`](https://github.com/Bluemap-GTNH-Unofficial/modernity) packs give the
  map the Modernity-GTNH look, checked against a real client running Modernity-GTNH (see
  [real-client oracle](#real-client-oracle)).
- **Community addons.** The addons load, export and render, including their formed multiblocks and key special
  renderers: Twist Space Technology 0.8.0, Programmable Hatches 0.2.1p2, GT: Not Leisure 0.2.7-rc2.1 with GTNLLib 1.1.3
  (required), NH Utilities 1.7.0 and the Box++ community fork 2.2.0.0. 123Technology is not supported until an
  upstream release for 2.9.0 exists (2.2.0.1 stops a 2.9.0 server: `NoSuchFieldError TEC_MARK_EM`).
- **Server integration.** A map is created automatically for every dimension that has region files; modded
  dimension types and biomes come from the running server; tiles update after world saves; online players appear on
  the map; `/bluemap` commands work in game and over RCON. On a plain and an addon 2.9.0 server the mod loads, renders
  the maps, and the web app, `settings.json`, `players.json` and `markers.json` answer, with no BlueMap warnings or
  errors.
- **Performance.** See [performance](/guide/performance).

### GregTech in numbers

| | Result |
|---|---|
| Machines exported | {{ n.exports.default.mteOk }} of {{ n.exports.default.mte }} MTEs on the base pack ({{ n.exports.addons.mteOk }} of {{ n.exports.addons.mte }} with the addons), {{ n.exports.default.casings }} casings, {{ n.exports.default.mteFailed }} failures |
| GregTech blocks in the test scenes | {{ n.scenes.gtMachines }} `gt.blockmachines` in `gt-machines`, `gt-pipes` and `gt-multiblocks`, {{ n.scenes.gtOres }} ores in `gt-ores`; the reader matches the server on all of them |
| Multiblocks in the `gt-multiblocks` scene | {{ n.scenes.multiblocks }} controllers, {{ n.scenes.multiblocksFormed }} formed (GregTech cannot check the bricked blast furnace) |
| State oracle, `gregtech` states | {{ n.states.gregtech.passed }} of {{ n.states.gregtech.judged }} judged states match the client ({{ n.states.gregtech.rate }}) |

## Real-client oracle

The [client oracle](/development/oracle) compares BlueMap with the real GTNH 2.9.0 client: every block state drawn
alone (`e2e oracle states`), and every visible block face of the test scene worlds at the client's own camera
(`e2e oracle world`). The pass thresholds are calibrated on vanilla blocks that look the same in 1.7.10 and 1.13, not
tuned by hand.

**Block states.** {{ n.states.default.states }} states ({{ n.states.vanilla }} vanilla states and the
{{ n.exports.default.states }} the exporter captured):

<ResultsTable name="oracle-states" />

**Scene worlds.** Faces passing per scene, in views whose client and BlueMap renderings line up (default:
{{ n.worlds.default.total.viewsAligned }} of {{ n.worlds.default.total.views }} views, Modernity-GTNH:
{{ n.worlds.modernity.total.viewsAligned }} of {{ n.worlds.modernity.total.views }}). Faces of accepted 1.13
differences are counted apart and not included:

<ResultsTable name="oracle-worlds" />

With the community addons (`addons` look):

<ResultsTable name="oracle-worlds-addons" />

`gtnh-initial-rwg`, a freshly generated world, has no dump, so the world oracle cannot judge it. The world
thresholds, calibrated on `{{ n.worlds.calibration.scene }}`: IoU at least {{ n.worlds.calibration.thresholds.iou }},
ΔE at most {{ n.worlds.calibration.thresholds.deltaE }}, SSIM at least {{ n.worlds.calibration.thresholds.ssim }}, on
faces of at least {{ n.worlds.calibration.thresholds.minPixels }} pixels.

**How far to trust it.** The swap tests judge renders that are known to differ from the reference: the default
client's renders against the Modernity client's, and BlueMap with one look against the client with the other.

<ResultsTable name="oracle-trust" />

A failing state or face is therefore almost always a real difference, while a passing face can still hide a small
colour difference that the world thresholds do not resolve.

## Known gaps

- {{ n.states.default.failRate }} of the judged block states and {{ n.worlds.default.total.failRate }} of the judged
  scene faces still differ from the client beyond the thresholds; the oracle reports list them per mod with client,
  BlueMap and difference images. The weakest scenes are `gt-ores` ({{ n.worlds.default.scenes["gt-ores"].rate }} of
  faces pass; its client captures never fully settled, so this number is less certain) and `mod-renderers`
  ({{ n.worlds.default.scenes["mod-renderers"].rate }}).
- BiblioCraft furniture is mostly drawn as boxes (65 of 285 states have a dedicated renderer).
- Applied Energistics 2 and EnderIO render without some details (AE2 cable textures do not follow their direction, no
  smart-cable channel lights; EnderIO without facade connection plates and input/output markers).
- GregTech covers, machines with special (TESR) renderers and pipes inside frame boxes are not drawn.
- {{ n.exports.default.failed }} of the {{ n.exports.default.states }} exported states have no usable model
  ({{ n.exports.default.errorIcon }} of them because the mod returns the client's placeholder icon); they show as
  missing-texture cubes unless a dedicated renderer draws them.
- Animated effects are drawn frozen; beams are opaque.
- Exporting needs a desktop session; a headless Docker export is not available yet.
- Tested on GTNH 2.9.0 only; other pack versions are untested.

## Verification

What the tests prove, and what they do not:

| Check | What it compares | What it proves |
|---|---|---|
| Reader reconciliation (`:legacy:verifyDump`) | every block, metadata and tile entity id the reader sees vs a dump from the live server | the world reader reads what the server wrote: 0 mismatches on 12 scenes |
| Vanilla flattening oracle | the reader's 1.13 block states vs the same world upgraded by Minecraft 1.13.2 itself | vanilla flattening matches Mojang's own upgrade, apart from listed deliberate differences |
| Exporter coverage | rendered modded states vs placed modded states in `gtnh-zoo` | 91.52% have their own model; the rest are listed by reason |
| [Real-client oracle](/development/oracle) | BlueMap vs the real GTNH client, per block state and per visible block face of the scene worlds | how closely the map matches the game, within thresholds calibrated on data; see [above](#real-client-oracle) |
| Browser e2e ({{ n.e2e.views }} views, {{ n.e2e.scenes }} scenes) | screenshots of rendered maps vs **locally approved screenshots of earlier renders** | renders did not change since a human approved them by eye |

> [!IMPORTANT] The e2e baselines are a regression check, not a proof of correctness
> The browser checks compare BlueMap with BlueMap: a check passes when a render looks like the render that was
> approved earlier. They catch unintended changes, not wrong output; a rendering bug that was present when a baseline
> was approved passes forever. The baselines are generated and approved locally and never committed, because they
> contain Minecraft and mod textures. Correctness is the job of the [client oracle](/development/oracle).

## GTNH 2.9.0

The stable release (released 31 October 2026; client and server packs from downloads.gtnewhorizons.com) is the only
supported pack version. The exported resource pack must come from a 2.9.0 client: your own export, or the release's
base pack (`bluemap-gtnh-resources-2.9.0.zip`, plain 2.9.0) or addon pack (`bluemap-gtnh-resources-2.9.0-addons.zip`,
with the five supported addons). Things that matter for the map:

- GT 5.09.54.265 adds MCPatcher connected textures for three DTPF casings; the exporter records them
  ({{ n.exports.default.ctmTextures }} connected-texture entries).
- Postea migrates IC2 metal blocks and basic machine casings to their GregTech equivalents and Village Names concrete
  to Et Futurum concrete when old chunks load; the reader reads either.
- Even with structure generation off, 2.9.0 places Village Names villages, Pam's gardens and Thaumcraft aura nodes.
  The test scenes therefore clear their build volume and a margin around it before the dump; see
  [tests and scenes](/development/testing#scenes).
