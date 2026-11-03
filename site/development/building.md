# Building

All Java builds run with Java 25 from mise. The three Forge mods (server mod, exporter, harness) also need the Java 8
toolchain, passed to Gradle as an extra installation path; `pipeline/gradlew` does both. All Gradle builds share the
default Gradle user home (`~/.gradle`), so Minecraft is decompiled once per machine (about 12 minutes, kept in
RetroFuturaGradle's `fernflower-cache` there), not once per mod.

## Pipeline

The umbrella `mise.toml` defines every build and test step as a mise task; `mise tasks` lists them. Each task declares
its inputs (`sources`) and outputs, and mise skips it while both hash the same as after its last successful run
(content hashes, `task.source_freshness_hash_contents`), so a touched or re-checked-out file reruns nothing.

```sh
mise run all                  # everything below; on an unchanged tree only `doctor` runs
mise run plan                 # what `mise run all` would run (`mise run plan e2e` for one task), nothing recorded
mise run check                # only what the current changes need (next section)
mise run check --plan         # ... print it without running anything
mise run build-servermod      # one step; its unchanged inputs make it a no-op
mise run --force e2e          # run a step although it is up to date
mise run adopt                # once per workspace, see below
```

> [!WARNING] Use `mise run plan`, not `mise run --dry-run`
> mise 2026.10.21 records a dry run in content-hash mode as if the tasks had succeeded, so `mise run -n all` marks
> every stale task up to date without running it. `mise run plan` runs the dry run on a throwaway copy of mise's
> state; it lists tasks without declared outputs (`test:*`, `verify`) even when they are up to date.

| Task | Runs | Inputs | Outputs |
|---|---|---|---|
| `build-fork` | `:cli:shadowJar :legacy:addonJar :gtnh-render:addonJar` | BlueMap `api`, `core`, `common` (+ webapp), `legacy`, `gtnh-render`, `cli`, build files | CLI shadow jar, addon jars |
| `build-servermod` | `implementations/gtnh` `build` | the server mod + the BlueMap modules it shades | `bluemap-<version>.jar` |
| `build-exporter` | `gtnh-exporter` `build` | exporter sources, `ResourceKeys.kt` | `bluemap-gtnh-exporter-<version>.jar` |
| `build-harness` | `harness` `build`, then installs the jar into both 2.9.0 servers' `mods/` | harness sources | `bmh-<version>.jar` (built and installed) |
| `test` | `test:legacy`, `test:gtnh-render`, `test:fork-oracle`, `test:servermod`, `test:launcher`, `test:orchestrator`, `test:e2e` (unit), `test:modernity`, `test:pipeline` | each suite's sources and tests | (pass marker) |
| `scenes` | `scene:<name>` for the 12 scenes (`orch scene`) | orchestrator modules, server mods, harness sources | `dump.ndjson`, snapshot `level.dat` |
| `verify` | `orch verify` of every scene | reader sources, dumps, snapshots | (pass marker; result in `scene.json`) |
| `export` | `export:default`, `export:addons`, `export:modernity-vanilla`, `export:modernity` (client runs) | exporter sources (not its `oracle/` capture code), launcher, client mods, addon jars, Modernity release, the zoo dumps | the four packs |
| `oracle` | `oracle:default\|modernity\|addons` (world, `--all`), `oracle:states-default\|modernity` | BlueMap jars, e2e oracle code and scenes, capture version, client mods, packs, dumps, worlds | `summary.json`, states `report.json` |
| `e2e` | `e2e run` of every scene with baselines | BlueMap jars, e2e code and scenes, baselines, packs, worlds | `report.json` per scene |
| `demo` | `pnpm demo` | BlueMap jars, packs, `endgame` and `gt-multiblocks` worlds, `build-demo.ts` | `site/public/demo/`, `site/public/generated/` |
| `site` | `pnpm build && pnpm check` | pages, theme, demo outputs | `.vitepress/dist/` |
| `doctor` | quick checks, every run: tools, workspace inputs, Gradle cache settings, repository state | - | - |

- Task groups live in `pipeline/tasks/*.toml`: mise counts the file that defines a task as one of its sources, so
  editing one group does not invalidate the others. Helpers: `pipeline/gradlew`, `pipeline/steps.py`.
- Tasks run one at a time (`jobs = 1`): exports and oracle captures start a GTNH client, scenes a GTNH server on fixed
  ports. Builds are dependencies (`depends`); exports, scenes and the oracle are only ordered (`wait_for`), so
  `mise run oracle` never starts an export or a scene build on its own; their outputs are inputs, though, so a new
  pack or scene makes the oracle stale. The oracle starts a client only on a reference cache miss.
- `mise run adopt` records the outputs already in a workspace (packs, scenes, oracle and e2e reports, demo) as
  current without producing them again (`BMGTNH_ADOPT=1`; builds, tests, `verify` and `site` run normally). mise has no
  record of a task before its first successful run and would otherwise rerun every expensive step once. Use it only
  when those outputs match the checkout.

### Changed-path checks

`mise run check` diffs every repository against its upstream tracking branch (`--base REV` to override, `--repo` to
limit, `--files` to give paths), including staged, unstaged and untracked files, and maps each changed file to the
first matching rule of `pipeline/affected.toml`: the unit suites (mise tasks) to run and the affected scenes. For
those scenes it runs the BlueMap side of the world oracle against the cached client references
(`e2e oracle world --all --scene … --no-build --no-capture`, never a client) and the e2e views of the scenes that have
baselines. A file no rule matches runs every suite and scene and is listed, so the map stays complete. Follow-ups the
check cannot do itself (exports, scene rebuilds, captures) are printed as notes. As long as e2e has no world
calibration stored (`out/oracle-ref/2.9.0/calibration/world-*.json`), the check adds the calibration scene
`vanilla-zoo` to the oracle run, which e2e needs to judge anything.

```sh
$ mise run check --files BlueMap/gtnh-render/src/main/kotlin/de/bluecolored/bluemap/gtnh/render/mods/chisel/ChiselCtm.kt --plan
[check] 1 changed file(s), 0 without a rule in affected.toml
[check]   BlueMap/gtnh-render/src/main/kotlin/de/bluecolored/bluemap/gtnh/render/mods/chisel/ChiselCtm.kt: test:gtnh-render; scenes mod-renderers, gtnh-zoo
[check] plan:
[check]   mise run test:gtnh-render
[check]   mise run build-fork
[check]   oracle default+modernity: gtnh-zoo mod-renderers
[check]   e2e: gtnh-zoo mod-renderers
```

### Gradle caches

- One Gradle user home for all builds: the dependency cache, RetroFuturaGradle's decompiled Minecraft
  (`caches/retro_futura_gradle/fernflower-cache`, keyed by its inputs, so every mod's build logs "Using cached
  decompiled jar") and the local build cache (`org.gradle.caching = true` in the gradle.properties of the fork and the
  three mods). From the build cache come RetroFuturaGradle's recompiled Minecraft (`compilePatchedMcJava`), which the
  exporter and harness share, and the mods' and BlueMap modules' compile tasks. RetroFuturaGradle's merge,
  deobfuscate, patch and remap steps still run in each mod's `build/rfg/` (about 8 to 10 s): their cache entries are
  written but not reused.
- Configuration cache: on in the exporter and harness; off in the BlueMap build and the server mod, which includes
  it, because BlueMap's `buildSrc` runs git at configuration time and `:common:zipWebapp` holds a `Project`.
- Clean build of each mod (`build/` deleted, warm Gradle user home), task execution time from `--profile`, measured
  2026-11-02 on the MacBook (wall times varied by minutes with GTNH clients running alongside):

  | Build | Before | Build cache filled by an earlier mod | Build cache warm |
  |---|---|---|---|
  | exporter | 14.0 s (Minecraft recompile 4.0 s) | 15.1 s (first in line, recompiles) | 10.0 s (recompile from cache) |
  | harness | 13.7 s (recompile 4.3 s) | 10.8 s (recompile from the exporter's entry) | 8.7 s |
  | server mod | 39.7 s (recompile 6.5 s) | 53.2 s (recompiles: its RetroFuturaGradle settings differ) | 22.0 s (26 tasks from cache) |

## Forge mods

::: code-group

```sh [mise]
mise run build-servermod      # -> BlueMap/implementations/gtnh/build/libs/bluemap-<version>.jar (reobfuscated, the one to install)
mise run build-exporter       # -> gtnh-exporter/build/libs/bluemap-gtnh-exporter-<version>.jar
mise run build-harness        # -> harness/build/libs/bmh-<version>.jar, also copied into servers/gtnh{,-addons}-2.9.0/mods/
```

```sh [by hand]
cd harness                    # or gtnh-exporter, BlueMap/implementations/gtnh (../../../pipeline/gradlew)
../pipeline/gradlew build     # = mise exec java@temurin-25.0.5+8.0.LTS -- ./gradlew \
                              #   -Porg.gradle.java.installations.paths=<zulu-8 home>,<temurin-25 home> build
```

:::

- The server mod pulls BlueMap's `:common`, `:legacy` and `:gtnh-render` from the enclosing BlueMap build through a
  composite build (`includeBuild("../..")`). The webapp has to be built in the BlueMap build (`:common:buildWebapp`,
  which runs automatically unless excluded).
- The exporter compiles the reader's `legacy/.../ResourceKeys.kt` from the sibling `BlueMap/` checkout verbatim and
  fails without it.
- Versions: `<bluemapUpstreamVersion>-gtnh.<gtnhRevision>` from BlueMap's root `gradle.properties` (for example
  `5.29-gtnh.2`), shared by the mod jar, `mcmod.info` and BlueMap itself.

## BlueMap: CLI and addon jars

The `e2e` suite and the site demo render with the BlueMap CLI plus the `legacy` and `gtnh-render` addon jars:

```sh
mise run build-fork           # = cd BlueMap && ../pipeline/gradlew :cli:shadowJar :legacy:addonJar :gtnh-render:addonJar
# -> implementations/cli/build/libs/cli-<version>-shadow.jar
# -> legacy/build/libs/legacy-<version>-addon.jar, gtnh-render/build/libs/gtnh-render-<version>-addon.jar
```

> [!WARNING] Keep the webapp in the CLI jar
> Building with `-x :common:buildWebapp` produces a CLI that fails with "Failed to open bundled webapp". `e2e` and
> `pnpm demo` refuse such a jar.

## Python tools

```sh
cd gtnh-exporter/launcher && uv run gtnh-client --help
cd orchestrator && uv run orch --help
cd e2e && uv sync --group dev && uv run playwright install chromium
cd modernity && uv sync --group dev
```

## This site

::: code-group

```sh [develop]
cd site
pnpm install
pnpm dev            # http://localhost:5173/BlueMap-GTNH/
```

```sh [build and preview]
cd site
pnpm build          # -> .vitepress/dist
pnpm preview        # static server on http://localhost:4173/BlueMap-GTNH/
```

```sh [root base path]
cd site
SITE_BASE=/ pnpm build    # for hosting at the root of a domain
```

:::

The optional local demo map and screenshot gallery are built with `pnpm demo`; see
[tests & scenes](/development/testing#site-demo).
