# Status

This page describes the current source, which the next release, **`v5.29-gtnh.2`** (BlueMap 5.29 plus the port),
will ship. It supports **GT New Horizons 2.9.0** only, and every number on this page was measured on 2.9.0, on one
machine.

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
- **Modded blocks.** The client exporter captures the appearance of every block state the pack registers (4,087
  blocks, 61,468 states from 138 mods, in 51 s). On the `gtnh-zoo` test scene, 14,887 of 16,266 placed modded states
  (91.52%) render with their own model (simple bounding-box fallbacks counted).
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
| Machines exported | 3,412 of 3,412 MTEs on the base pack (4,450 of 4,450 with the addons), 498 casings, 0 failures |
| GregTech blocks in the test scenes | 8,066 `gt.blockmachines` in `gt-machines`, `gt-pipes` and `gt-multiblocks`, 3,904 ores in `gt-ores`; the reader matches the server on all of them |
| Multiblocks in the `gt-multiblocks` scene | 19 controllers, 18 formed (GregTech cannot check the bricked blast furnace) |
| State oracle, `gregtech` states | 3,839 of 6,157 judged states match the client (62.4%) |

## Real-client oracle

The [client oracle](/development/oracle) compares BlueMap with the real GTNH 2.9.0 client: every block state drawn
alone (`e2e oracle states`), and every visible block face of the test scene worlds at the client's own camera
(`e2e oracle world`). The pass thresholds are calibrated on vanilla blocks that look the same in 1.7.10 and 1.13, not
tuned by hand.

**Block states.** 62,659 states (1,191 vanilla states and the 61,468 the exporter captured):

| Look | Judged | Pass | Pass rate | Accepted (1.13) | Client draws nothing | Client throws |
|---|---|---|---|---|---|---|
| default | 61,513 | 48,266 | **78.5%** | 120 | 789 | 237 |
| Modernity-GTNH | 61,582 | 47,138 | **76.5%** | 52 | 788 | 237 |

**Scene worlds.** Faces passing per scene, in views whose client and BlueMap renderings line up (every view did).
Faces of accepted 1.13 differences are counted apart and not included:

| Scene | default | Modernity-GTNH |
|---|---|---|
| `vanilla-zoo` | 1,991 of 2,221 (89.6%) | 2,281 of 2,578 (88.5%) |
| `gtnh-zoo` | 2,387 of 3,380 (70.6%) | 2,378 of 3,380 (70.4%) |
| `gt-machines` | 2,968 of 3,299 (90.0%) | 2,865 of 3,299 (86.8%) |
| `gt-pipes` | 3,043 of 3,486 (87.3%) | not run |
| `gt-ores` | 1,439 of 2,632 (54.7%) | not run |
| `gt-multiblocks` | 398 of 411 (96.8%) | 400 of 421 (95.0%) |
| `mod-renderers` | 2,041 of 3,008 (67.9%) | 2,052 of 3,011 (68.2%) |
| all of the above | 14,267 of 18,437 (77.4%) | 9,976 of 12,689 (78.6%) |

With the community addons (`addons` look): `addons-machines` 3,423 of 3,690 faces (92.8%), `addons-multiblocks`
7,792 of 7,982 (97.6%). `gtnh-initial-rwg`, a freshly generated world, has no dump, so the world oracle cannot judge
it. The world thresholds, calibrated on `vanilla-zoo`: IoU at least 1.0, ΔE at most 2.337, SSIM at least 0.9323, on
faces of at least 64 pixels.

**How far to trust it.** The swap tests judge renders that are known to differ from the reference: the default
client's renders against the Modernity client's, and BlueMap with one look against the client with the other.

| | Detection (known-different flagged) | False failures |
|---|---|---|
| State oracle | 27,744 of 27,748 differing states (99.99%) | 6 of 233 calibration states for colour (2.6%), 12 of 261 for geometry (4.6%) |
| World oracle | 5,222 of 6,549 differing faces (79.7%): 2,051 of 2,074 (98.9%) where the two clients' captures of the face differ by a mean of 20 or more RGB levels, 2 of 167 where they differ by 1–2 | 2 of 3,220 faces the two clients draw alike (0.06%); on `vanilla-zoo` 3 of 137 calibration states for colour and 3 of 143 for geometry (2.2%, 7 faces each) |

A failing state or face is therefore almost always a real difference, while a passing face can still hide a small
colour difference that the world thresholds do not resolve.

## Known gaps

- About a fifth of the judged block states and of the judged scene faces still differ from the client beyond the
  thresholds; the oracle reports list them per mod with client, BlueMap and difference images. The weakest scenes are
  `gt-ores` (54.7% of faces pass; its client captures never fully settled, so this number is less certain) and
  `mod-renderers` (67.9%).
- BiblioCraft furniture is mostly drawn as boxes (65 of 285 states have a dedicated renderer).
- Applied Energistics 2 and EnderIO render without some details (AE2 cable textures do not follow their direction, no
  smart-cable channel lights; EnderIO without facade connection plates and input/output markers).
- GregTech covers, machines with special (TESR) renderers and pipes inside frame boxes are not drawn.
- 1,476 of the 61,468 exported states have no usable model (920 of them because the mod returns the client's
  placeholder icon); they show as missing-texture cubes unless a dedicated renderer draws them.
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
| Browser e2e (50 views, 8 scenes) | screenshots of rendered maps vs **locally approved screenshots of earlier renders** | renders did not change since a human approved them by eye |

> [!IMPORTANT] The e2e baselines are a regression check, not a proof of correctness
> The browser checks compare BlueMap with BlueMap: a check passes when a render looks like the render that was
> approved earlier. They catch unintended changes, not wrong output; a rendering bug that was present when a baseline
> was approved passes forever. The baselines are generated and approved locally and never committed, because they
> contain Minecraft and mod textures. Correctness is the job of the [client oracle](/development/oracle).

## GTNH 2.9.0

The stable release (released 31 October 2026; client and server packs from downloads.gtnewhorizons.com) is the only
supported pack version. The exported resource pack must come from a 2.9.0 client
(`bluemap-gtnh-resources-2.9.0.zip`). Things that matter for the map:

- GT 5.09.54.265 adds MCPatcher connected textures for three DTPF casings; the exporter records them (98
  connected-texture entries).
- Postea migrates IC2 metal blocks and basic machine casings to their GregTech equivalents and Village Names concrete
  to Et Futurum concrete when old chunks load; the reader reads either.
- Even with structure generation off, 2.9.0 places Village Names villages, Pam's gardens and Thaumcraft aura nodes.
  The test scenes therefore clear their build volume and a margin around it before the dump; see
  [tests and scenes](/development/testing#scenes).
