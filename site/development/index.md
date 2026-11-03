# Workspace & toolchain

The project is an umbrella repository with six submodules that are checked out next to each other. Each tool finds
the others as siblings, so always work in a full recursive clone.

## Repository map

| Submodule | Repository | Role |
|---|---|---|
| `BlueMap/` | [Bluemap-GTNH-Unofficial/BlueMap](https://github.com/Bluemap-GTNH-Unofficial/BlueMap) | Fork of BlueMap 5.29 with the 1.7.10 world reader and flattening (`legacy`), GregTech and mod renderers (`gtnh-render`) and the Forge 1.7.10 server mod (`implementations/gtnh`). |
| `gtnh-exporter/` | [Bluemap-GTNH-Unofficial/gtnh-exporter](https://github.com/Bluemap-GTNH-Unofficial/gtnh-exporter) | Client mod that exports modded block appearance and GregTech data into a BlueMap resource pack, plus the `gtnh-client` launcher. |
| `modernity/` | [Bluemap-GTNH-Unofficial/modernity](https://github.com/Bluemap-GTNH-Unofficial/modernity) | Builds optional Modernity-GTNH resource packs for the map. |
| `harness/` | [Bluemap-GTNH-Unofficial/harness](https://github.com/Bluemap-GTNH-Unofficial/harness) | `bmh`, a server-side test mod that builds test scenes and dumps world state over RCON. |
| `orchestrator/` | [Bluemap-GTNH-Unofficial/orchestrator](https://github.com/Bluemap-GTNH-Unofficial/orchestrator) | Headless GTNH server lifecycle, RCON and deterministic test scenes. |
| `e2e/` | [Bluemap-GTNH-Unofficial/e2e](https://github.com/Bluemap-GTNH-Unofficial/e2e) | Browser screenshot regression tests of rendered maps against local baselines. |

The umbrella repository itself holds the README, `NOTICE.md`, the licence, releases and this site (`site/`).

## Clone and set up

```sh
git clone --recursive https://github.com/Bluemap-GTNH-Unofficial/BlueMap-GTNH.git
cd BlueMap-GTNH
mise install java@temurin-25.0.5+8.0.LTS java@zulu-8.98.0.107
```

- **Java** comes from [mise](https://mise.jdx.dev/). Java 25 builds and runs everything; the GTNHGradle mod builds
  (server mod, exporter, harness) also need a Java 8 toolchain: Zulu, the only Java 8 build for macOS arm64.
  `BlueMap/mise.toml` pins `temurin-25.0.5+8.0.LTS` for the main BlueMap build.
- **Python tools** (`gtnh-exporter/launcher`, `modernity`, `orchestrator`, `e2e`) use [uv](https://docs.astral.sh/uv/)
  and Python 3.12 or newer. Run them with `uv run` inside their folder.
- **This site** uses Node LTS from mise and pnpm (`site/mise.toml`).

## Workspace layout

Each tool finds the workspace as the parent of its own repository root; set `BMGTNH_WORKSPACE` to override. Local
state lives in ignored folders at the workspace root and is never committed. Folders that depend on the GTNH pack
version end in `-<version>` (`worlds-2.9.0/`, `out/exporter-2.9.0/`, `clients/gtnh-2.9.0`):

```text
BlueMap-GTNH/                 # the workspace (umbrella checkout)
├── BlueMap/  gtnh-exporter/  modernity/  harness/  orchestrator/  e2e/   # submodules
├── site/                     # this documentation site
├── servers/<server>/         # unpacked GTNH server packs (+ .rcon-password): gtnh-2.9.0, gtnh-addons-2.9.0
├── clients/<client>/         # unpacked GTNH clients for exports: gtnh-2.9.0, gtnh-addons-2.9.0, gtnh-modernity-2.9.0
├── downloads/                # pack zips (gtnh-packs.json: URLs, sha256), addon jars, Mojang/Forge library cache
├── worlds-2.9.0/<scene>/     # scene world snapshots
├── out/                      # build and test outputs: exporter-2.9.0/, scenes-2.9.0/, e2e-2.9.0/, oracle-2.9.0/, ...
├── baselines-2.9.0/<scene>/  # e2e baselines, local only
└── sources/                  # reference checkouts
```

| Variable | Meaning |
|---|---|
| `BMGTNH_WORKSPACE` | workspace root (default: parent of the tool's repository) |
| `BMGTNH_JAVA` | Java binary for the BlueMap CLI in `e2e` and the site demo (default: `mise where java@temurin-25.0.5+8.0.LTS`) |
| `BMGTNH_PACK_VERSION` | GTNH pack version the tools use when not given `--pack-version` (default and only value: `2.9.0`) |
| `BMGTNH_BASELINES` | e2e baseline folder (default: the pack version's `<workspace>/baselines-<version>`) |

## Conventions

- New code is Kotlin; upstream BlueMap Java files stay Java and change as little as possible, so the fork can follow
  upstream.
- The Forge mods use GTNHGradle with `enableModernJavaSyntax = modern` (Java 25 bytecode) and force the Kotlin
  Gradle plugin to 2.3.21; Kotlin code targets API version 2.1, the stdlib Forgelin provides in the pack.
- Nothing that contains Minecraft or mod textures is committed: no exported packs, no screenshots, no baselines, no
  demo maps.

Next: [building](/development/building).
