# BlueMap for GT New Horizons (unofficial)

> [!WARNING]
> **Unofficial project. Use at your own risk.**
>
> - This is **not** affiliated with, endorsed by or supported by [BlueMap](https://github.com/BlueMap-Minecraft/BlueMap)
>   or the [GT New Horizons](https://github.com/GTNewHorizons) team. Do not report problems with this port to them.
> - It is **vibe coded**: most of the code, tests and documentation were written by an AI coding agent under human
>   direction. It is tested (see [Status](site/status.md)) but has not been audited.
> - There is **no warranty and no quality guarantee**. It has only been tested on one version of one pack (GTNH 2.9.0)
>   and on one machine.
> - **Back up your world before installing it.** The server mod does not change chunk data, but it runs inside your
>   server process and asks the server to save the world.

A port of [BlueMap](https://bluemap.bluecolored.de/), the 3D web map for Minecraft, to **Minecraft 1.7.10** and the
**GT New Horizons 2.9.0** modpack. It runs as a Forge server mod inside the GTNH server,
reads the 1.7.10 world files (including EndlessIDs' extended block IDs and 16-bit metadata), and renders vanilla
terrain, GregTech machines, pipes and ores, and blocks from the pack's other mods into BlueMap's browser map. Modded
blocks look right only with a resource pack exported from a GTNH client of the same pack version and modlist with the
bundled exporter. For convenience, two ready packs for 2.9.0 are attached to the releases: the base pack
(`bluemap-gtnh-resources-2.9.0.zip`) for plain GTNH 2.9.0 servers and the addon pack
(`bluemap-gtnh-resources-2.9.0-addons.zip`) for servers running the five supported community addons. Their textures
belong to their authors; they are offered for non-commercial use only and are removed on request
([takedown](https://github.com/Bluemap-GTNH-Unofficial/BlueMap-GTNH/issues/new?template=takedown.yml)). If your
modlist differs, export your own pack.

<!-- numbers:readme-oracle -->
Rendering is checked against the **real GTNH client** (the e2e repository's oracle): on 2.9.0, 78.10% of 61,513 judged
block states and 94.04% of 97,139 judged block faces in 8 test scene worlds match the client within thresholds
calibrated on data; see [Status](site/status.md) for the numbers per scene and the known gaps. The optional
[Modernity-GTNH](https://github.com/ModernityGTNH/Modernity-GTNH) look is checked the same way (76.17% of judged states,
93.93% of judged faces in 8 scenes).
<!-- /numbers -->

[Community addons](site/guide/addons.md) render too (GTNH 2.9.0): Twist Space Technology 0.8.0, Programmable Hatches
0.2.1p2, GT: Not Leisure 0.2.7-rc2.1 (with GTNLLib 1.1.3), NH Utilities 1.7.0 and the Box++ community fork 2.2.0.0.
123Technology is not supported until an upstream release for 2.9.0 exists.

## Documentation

The documentation lives in [`site/`](site/), a VitePress site with the guide, status, architecture, development
notes and a live demo map. It is hosted on GitHub Pages at
<https://bluemap-gtnh-unofficial.github.io/BlueMap-GTNH/> (built by `.github/workflows/pages.yml`; the demo map comes
from the newest `demo-*` release asset). To read it locally:

```bash
cd site && pnpm i && pnpm dev    # http://localhost:5173/BlueMap-GTNH/
```

Quick links (readable on GitHub too):

- [Requirements](site/guide/index.md) · [Install the server mod](site/guide/install.md) ·
  [Export the resource pack](site/guide/export.md) · [Community addons](site/guide/addons.md) ·
  [Maps, commands, config](site/guide/maps.md) · [Troubleshooting](site/guide/troubleshooting.md)
- [Status and known gaps](site/status.md) · [Performance](site/guide/performance.md) ·
  [Architecture](site/architecture.md)
- [Development: workspace & toolchain](site/development/index.md) · [Building](site/development/building.md) ·
  [Tests & scenes](site/development/testing.md) · [Client oracle](site/development/oracle.md)
- [Releases](https://github.com/Bluemap-GTNH-Unofficial/BlueMap-GTNH/releases) (`v5.29-gtnh.2`: BlueMap 5.29 plus
  the port, and the ready 2.9.0 base and addon resource packs) · [Third-party notices](NOTICE.md)

## Repositories

This is the umbrella repository. Releases are published here; the code lives in submodules that are checked out
next to each other (`git clone --recursive https://github.com/Bluemap-GTNH-Unofficial/BlueMap-GTNH.git`).

| Submodule | Repository | Role |
|---|---|---|
| `BlueMap/` | [Bluemap-GTNH-Unofficial/BlueMap](https://github.com/Bluemap-GTNH-Unofficial/BlueMap) | Fork of BlueMap 5.29 with the 1.7.10 world reader and flattening (`legacy`), GregTech and mod renderers (`gtnh-render`) and the Forge 1.7.10 server mod (`implementations/gtnh`). |
| `gtnh-exporter/` | [Bluemap-GTNH-Unofficial/gtnh-exporter](https://github.com/Bluemap-GTNH-Unofficial/gtnh-exporter) | Client mod that exports modded block appearance and GregTech data into a BlueMap resource pack, plus the `gtnh-client` launcher. |
| `modernity/` | [Bluemap-GTNH-Unofficial/modernity](https://github.com/Bluemap-GTNH-Unofficial/modernity) | Builds optional Modernity-GTNH resource packs for the map from a Modernity release you download yourself. |
| `harness/` | [Bluemap-GTNH-Unofficial/harness](https://github.com/Bluemap-GTNH-Unofficial/harness) | `bmh`, a server-side test mod that builds test scenes and dumps world state over RCON. |
| `orchestrator/` | [Bluemap-GTNH-Unofficial/orchestrator](https://github.com/Bluemap-GTNH-Unofficial/orchestrator) | Headless GTNH server lifecycle, RCON and deterministic test scenes. |
| `e2e/` | [Bluemap-GTNH-Unofficial/e2e](https://github.com/Bluemap-GTNH-Unofficial/e2e) | The real-client oracle (BlueMap against the real GTNH client, per block state and per block face of scene worlds) and browser screenshot regression tests against local baselines. |

## Development

Every build and check of the workspace is a [mise](https://mise.jdx.dev/) task of the umbrella `mise.toml` (groups in
`pipeline/tasks/`); each declares its inputs and outputs and is skipped while their content hashes match its last
successful run. Prerequisites: mise (Java 25 and Zulu 8, see [workspace & toolchain](site/development/index.md)), uv
and pnpm; the container in `.devcontainer/` provides them all (see [building](site/development/building.md)).

```sh
mise tasks                 # every task with what it does
mise run all               # builds, unit suites, scenes, verify, exports, oracle, e2e, site demo, site
mise run check             # only the unit suites and scene checks the current changes need
mise run check --plan      # ... printed, not run
mise run build-servermod   # one step (also build-fork, build-exporter, build-harness, test, e2e, oracle, ...)
mise run docs:numbers      # the numbers the site and READMEs quote, from out/ into site/data/results-2.9.0.json
mise run adopt             # once per existing workspace: record the outputs already there as current
```

`check` maps each file changed against the upstream branches (plus uncommitted files) through
`pipeline/affected.toml` to unit suites and scenes, and runs the affected scenes' BlueMap-side oracle (cached client
references, no client) and e2e views. Independent tasks run side by side; one Gradle build per source tree, one scene
per GTNH server and one set of GTNH clients run at a time (wait_for chains and locks), and `mise run timings` shows
the last run's critical path. The three GTNHGradle mods share one Gradle user home and its local build cache:
Minecraft is decompiled once per machine, and a clean mod build takes its recompiled Minecraft and compiled modules
from the cache. Details: [Building](site/development/building.md#pipeline).

## Licence

MIT, except where [NOTICE.md](NOTICE.md) says otherwise: one function adapted from GT: Not Leisure (and two beam
angle lines) stays LGPL-3.0, code adapted from MyCTMLib keeps its MIT notice, and Kotlin re-implementations of
Minecraft behaviour are credited to Mojang. The BlueMap fork keeps the upstream copyright of Blue (Lukas Rieger) and
contributors. NOTICE.md also lists the mods used as references, the libraries in the server jar and the ones the mods
are built against, and the textures in screenshots. Minecraft is a trademark of Mojang; mod names and textures belong
to their authors.
