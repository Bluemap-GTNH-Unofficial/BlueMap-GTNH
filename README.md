# BlueMap for GT New Horizons (unofficial)

> [!WARNING]
> **Unofficial project. Use at your own risk.**
>
> - This is **not** affiliated with, endorsed by or supported by [BlueMap](https://github.com/BlueMap-Minecraft/BlueMap)
>   or the [GT New Horizons](https://github.com/GTNewHorizons) team. Do not report problems with this port to them.
> - It is **vibe coded**: most of the code, tests and documentation were written by an AI coding agent under human
>   direction. It is tested (see [Status](site/status.md)) but has not been audited.
> - There is **no warranty and no quality guarantee**. It has only been tested on two versions of one pack (GTNH 2.9.0
>   and 2.9.0-RC-2) and on one machine.
> - **Back up your world before installing it.** The server mod does not change chunk data, but it runs inside your
>   server process and asks the server to save the world.

A port of [BlueMap](https://bluemap.bluecolored.de/), the 3D web map for Minecraft, to **Minecraft 1.7.10** and the
**GT New Horizons 2.9.0** modpack (2.9.0-RC-2 is tested too). It runs as a Forge server mod inside the GTNH server,
reads the 1.7.10 world files (including EndlessIDs' extended block IDs and 16-bit metadata), and renders vanilla
terrain, GregTech machines, pipes and ores, and blocks from the pack's other mods into BlueMap's browser map. Modded
blocks look right only with a resource pack that you export yourself from a GTNH client of the same pack version with
the bundled exporter; this project never distributes that pack, because it contains other authors' textures.

[Community addons](site/guide/addons.md) render too (GTNH 2.9.0): Twist Space Technology 0.8.0, Programmable Hatches
0.2.1p2, GT: Not Leisure 0.2.7-rc2.1 (with GTNLLib 1.1.3), NH Utilities 1.7.0 and the Box++ community fork 2.2.0.0.
123Technology is not supported until an upstream release for 2.9.0 exists.

## Documentation

The documentation lives in [`site/`](site/), a VitePress site with the guide, status, architecture, development
notes and a live demo map. A hosted version will follow; to read it locally:

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
  [Tests & scenes](site/development/testing.md)
- [Releases](https://github.com/Bluemap-GTNH-Unofficial/BlueMap-GTNH/releases) (`v5.29-gtnh.1`: BlueMap 5.29 plus
  the port) · [Third-party notices](NOTICE.md)

## Repositories

This is the umbrella repository. Releases are published here; the code lives in submodules that are checked out
next to each other (`git clone --recursive https://github.com/Bluemap-GTNH-Unofficial/BlueMap-GTNH.git`).

| Submodule | Repository | Role |
|---|---|---|
| `BlueMap/` | [Bluemap-GTNH-Unofficial/BlueMap](https://github.com/Bluemap-GTNH-Unofficial/BlueMap) | Fork of BlueMap 5.29 with the 1.7.10 world reader and flattening (`legacy`), GregTech and mod renderers (`gtnh-render`) and the Forge 1.7.10 server mod (`implementations/gtnh`). |
| `gtnh-exporter/` | [Bluemap-GTNH-Unofficial/gtnh-exporter](https://github.com/Bluemap-GTNH-Unofficial/gtnh-exporter) | Client mod that exports modded block appearance and GregTech data into a BlueMap resource pack, plus the `gtnh-client` launcher. |
| `modernity/` | [Bluemap-GTNH-Unofficial/modernity](https://github.com/Bluemap-GTNH-Unofficial/modernity) | Builds optional Modernity-GTNH resource packs for the map (currently broken, being reworked). |
| `harness/` | [Bluemap-GTNH-Unofficial/harness](https://github.com/Bluemap-GTNH-Unofficial/harness) | `bmh`, a server-side test mod that builds test scenes and dumps world state over RCON. |
| `orchestrator/` | [Bluemap-GTNH-Unofficial/orchestrator](https://github.com/Bluemap-GTNH-Unofficial/orchestrator) | Headless GTNH server lifecycle, RCON and deterministic test scenes. |
| `e2e/` | [Bluemap-GTNH-Unofficial/e2e](https://github.com/Bluemap-GTNH-Unofficial/e2e) | Browser screenshot regression tests of rendered maps against local baselines. |

## Licence

MIT, except where [NOTICE.md](NOTICE.md) says otherwise: one function adapted from GT: Not Leisure (and two beam
angle lines) stays LGPL-3.0, code adapted from MyCTMLib keeps its MIT notice, and Kotlin re-implementations of
Minecraft behaviour are credited to Mojang. The BlueMap fork keeps the upstream copyright of Blue (Lukas Rieger) and
contributors. NOTICE.md also lists the mods used as references, the libraries in the server jar and the ones the mods
are built against, and the textures in screenshots. Minecraft is a trademark of Mojang; mod names and textures belong
to their authors.
