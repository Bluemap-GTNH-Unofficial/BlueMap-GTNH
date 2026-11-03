# Status

Release **`v5.29-gtnh.1`**: BlueMap 5.29 plus the port. It supports GT New Horizons 2.9.0 and is tested on 2.9.0 and
2.9.0-RC-2. Unless a number is marked 2.9.0, it was measured on 2.9.0-RC-2; [GTNH 2.9.0](#gtnh-2-9-0) lists the checks
repeated on the stable release. Everything ran on one machine.

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
- **Modded blocks.** The client exporter captures the appearance of every block state the pack registers (on
  2.9.0-RC-2 4,092 blocks, 62,476 states from 138 mods). On the `gtnh-zoo` test scene, 91.53% of the placed modded
  states render with their own model (simple bounding-box fallbacks counted).
- **Dedicated renderers** for GregTech machines, pipes, cables, ores and frames; Chisel connected textures; Iron
  Chests; BiblioCraft (partial); Applied Energistics 2 cables, parts and facades; EnderIO conduits.
- **Community addons.** The addons load, export and render, including their formed multiblocks and key special
  renderers: Twist Space Technology 0.8.0, Programmable Hatches 0.2.1p2, GT: Not Leisure 0.2.7-rc2.1 with GTNLLib 1.1.3
  (required), NH Utilities 1.7.0 and the Box++ community fork 2.2.0.0, on GTNH 2.9.0. 123Technology is not supported
  until an upstream release for 2.9.0 exists (2.2.0.1 stops a 2.9.0 server: NoSuchFieldError TEC_MARK_EM).
- **Server integration.** A map is created automatically for every dimension that has region files; modded
  dimension types and biomes come from the running server; tiles update after world saves; online players appear on
  the map; `/bluemap` commands work in game and over RCON.
- **Performance.** Rendering all 65,536 chunks of a fresh world took 941 s with the default 3 render threads and 556 s
  with 8 threads. The server stayed at 20 TPS in both runs. Details on [performance](/guide/performance).

### GregTech in numbers

| | Result |
|---|---|
| Machines exported | 3,412 of 3,412 MTEs on the base pack, 0 failures |
| `gt.blockmachines` in the four GT scenes | 8,090 of 8,094 drawn by the GregTech machine renderer (4 ice cream machines have no face data and show their casing) |
| Ores / frames | 3,904 of 3,904 / 42 of 42 |
| Face selection | identical, face by face, to GregTech's own dump; ores and frames match 1,000+ quads captured in the client |
| Multiblocks in the `gt-multiblocks` scene | 19 controllers, 18 formed |

## Known gaps

- **Modernity-GTNH support is currently broken**: textures render incorrectly with the packs built by the
  `modernity` tool. It is being reworked.
- BiblioCraft furniture is mostly drawn as boxes (65 of 285 states have a dedicated renderer).
- Applied Energistics 2 and EnderIO render without some details (AE2 cable textures do not follow their direction, no
  smart-cable channel lights; EnderIO without facade connection plates and input/output markers).
- GregTech covers, machines with special (TESR) renderers and pipes inside frame boxes are not drawn.
- 518 block states could not be exported on 2.9.0-RC-2; they show as missing-texture cubes.
- Animated effects are drawn frozen; beams are opaque.
- Exporting needs a desktop session; a headless Docker export is not available yet.
- Tested on GTNH 2.9.0 and 2.9.0-RC-2 only; other pack versions are untested.

## Verification

What the tests prove, and what they do not:

| Check | What it compares | What it proves |
|---|---|---|
| Reader reconciliation (`:legacy:verifyDump`) | every block, metadata and tile entity id the reader sees vs a dump from the live server | the world reader reads what the server wrote: 0 mismatches on 12 scenes |
| Vanilla flattening oracle | the reader's 1.13 block states vs the same world upgraded by Minecraft 1.13.2 itself | vanilla flattening matches Mojang's own upgrade, apart from listed deliberate differences |
| Exporter coverage | rendered modded states vs placed modded states in `gtnh-zoo` | 91.53% have their own model; the rest are listed by reason |
| Browser e2e (118 checks) | screenshots of rendered maps vs **locally approved screenshots of earlier renders** | renders did not change since a human approved them by eye |
| Real-client oracle | renders vs screenshots from the real GTNH client | **in progress** |

> [!IMPORTANT] The e2e baselines are a regression check, not a proof of correctness
> The 118 browser checks compare BlueMap with BlueMap: a check passes when a render looks like the render that was
> approved earlier. They catch unintended changes, not wrong output; a rendering bug that was present when a baseline
> was approved passes forever. The baselines are generated locally and never committed, because they contain Minecraft
> and mod textures. A reference check against the **real GTNH client** is being built in the `e2e` repository; see
> [client oracle](/development/oracle).

## GTNH 2.9.0

The stable release (released 31 October 2026; client and server packs from downloads.gtnewhorizons.com) behaves like
2.9.0-RC-2. The same server mod jar, exporter and harness run on both; only the exported resource pack must come from a
client of the same version.

| Check on 2.9.0 | 2.9.0 | 2.9.0-RC-2 |
|---|---|---|
| Reader reconciliation, `vanilla-zoo` / `gtnh-zoo` / `gt-machines` / `gt-multiblocks` | 0 / 0 / 0 / 0 mismatches (7,215 / 335,405 / 56,260 / 4,332,185 positions) | 0 mismatches |
| Export | 4,087 blocks, 61,468 states from 138 mods; 3,412 of 3,412 MTEs, 498 casings, 0 GregTech errors | 4,092 blocks, 61,579 states, same GregTech counts |
| Exporter coverage on `gtnh-zoo` | 14,887 of 16,266 placed modded states (91.52%) | 14,934 of 16,313 (91.55%) |
| Per-state real-client oracle | 48,266 of 61,513 judged states pass (78.46%) | 48,191 of 61,625 (78.20%) |
| World real-client oracle, `vanilla-zoo` | 1,991 of 2,221 faces pass (89.64%), 5 of 5 views aligned | 1,980 of 2,221 (89.15%) |
| World real-client oracle, `gt-multiblocks` | 401 of 414 faces pass (96.86%), 9 of 9 views aligned | 478 of 492 (97.15%) |
| Server mod | loads, renders 4 maps, web app and `players.json` answer, no BlueMap warnings or errors | same |

Differences that matter for the map: GT 5.09.54.265 adds MCPatcher connected textures for three DTPF casings
(exported, 98 instead of 95 connected-texture entries); Postea migrates IC2 metal blocks and basic machine casings to
their GregTech equivalents and Village Names concrete to Et Futurum concrete when old chunks load (the reader reads
either). The GT assembly line in `gt-multiblocks` no longer forms with the RC-2 build recipe (its survival build stops
after five slices), so that scene has 17 formed multiblocks on 2.9.0. Scene worlds of 2.9.0 were built with structure
generation off and a cleared build volume; see [tests and scenes](/development/testing).
