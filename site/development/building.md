# Building

All Java builds run with Java 25 from mise. The three Forge mods (server mod, exporter, harness) also need the Java 8
toolchain, passed to Gradle as an extra installation path; `pipeline/gradlew` does both. All Gradle builds share the
default Gradle user home (`~/.gradle`), so Minecraft is decompiled once per machine (about 12 minutes, kept in
RetroFuturaGradle's `fernflower-cache` there), not once per mod.

## Container

The whole pipeline runs in one long-lived Linux x64 container (`.devcontainer/`, Ubuntu 24.04): mise with Java 25
(`temurin-25.0.5+8.0.LTS`), Java 8 (`zulu-8.98.0.107`), Python 3.13, Node 24 and pnpm 12, uv, Playwright's Chromium,
Xvfb and Mesa. It works with Docker and with `wslc` (WSL containers, Windows), which takes the same arguments. On
Windows the GTNH clients run natively on the host (see below).

```sh
.devcontainer/run.sh                        # build bmgtnh-dev:latest, create the volumes, (re)start container bmgtnh
wslc exec -it -w /ws bmgtnh bash            # a shell; `docker exec` likewise (Git Bash: MSYS_NO_PATHCONV=1)
wslc exec -w /ws bmgtnh mise run plan
```

- The checkout is bind-mounted at `/ws`, and so are the clients' inputs and outputs (`clients/`, `downloads/`,
  `worlds-2.9.0/`, `out/`), which the Windows host's clients read and write. The rest of the local state (`servers/`,
  `baselines-2.9.0/`, `locks/`, `sources/`, `out/oracle-2.9.0/`, `out/e2e-2.9.0/`, `out/e2e/`), `site/node_modules`,
  the BlueMap webapp's Node install and the tool caches (`~/.gradle`, `~/.cache`, mise state) are named volumes
  `bmgtnh-*` on the Linux file system: on the Windows bind mount reading many small files is about 100 times slower.
  Recreating the container keeps them.
- What makes the bind mount slow, measured 2026-11-03: nothing of it is cached in the container. Every path
  component the kernel looks up there is a round trip to the host (about 0.25 ms: `stat` of a file ten directories
  down takes 2.6 ms), and so is every read of an open file (0.13 ms, also for bytes just read). Absolute paths into
  the volumes pay for their `/ws` components too (0.5 ms per `stat` under `/ws/out/oracle-2.9.0/` against 1.4 µs
  relative to a directory descriptor). The tools that touch many files work around it: the state oracle compares
  against a local copy of its reference (`out/oracle-2.9.0/<variant>/states/client`, copied once per capture;
  the cache entry in `out/oracle-ref/` is then left writable, since clearing the write bits of its 125,000 files there
  took 13 minutes), opens the images relative to its directory and has BlueMap write its 125,000 images through a
  directory descriptor (`/proc/<pid>/fd/<n>`: 115 s became 8 s); BlueMap reads the state oracle's and the site
  demo's resource packs from local copies (it reads a pack entry by entry: loading the demo's took 68 s from the
  bind mount on an idle machine and 13 minutes beside other tasks).
- Check out with LF line endings (`git config core.autocrlf false` before cloning, or re-checkout): the scripts run in
  Linux.
- GTNH clients run on the Windows host, natively on its GPU: the container sets
  `BMGTNH_CLIENT_HOST=http://host.wslc.internal:8390`, so every `gtnh-client prepare|run|play|export|cameras|states` of
  the pipeline, e2e and modernity is forwarded unchanged to `gtnh-client serve` on the host (paths mapped between
  `/ws` and the Windows checkout, output streamed, exit code returned, the client killed when the caller stops; see
  the launcher README, "Windows host and bridge"). Start the server once per logon, in PowerShell on the host:
  `gtnh-exporter\launcher\windows\serve.ps1` (`-Install` adds a logon task, `-Stop` stops it; log
  `out\gtnh-client-serve.log`). It needs uv and Temurin 25.0.5+8 unpacked into `%USERPROFILE%\.jdks\temurin-25.0.5+8`
  (Adoptium's `OpenJDK25U-jdk_x64_windows_hotspot_25.0.5_8.zip`, sha256
  `636bdc13dc649ddc7d5921c5c7d23cca6e44fd19d662b45cc9c02135a6c96c42`). A client command fails at
  once with that hint when no server answers. Measured 2026-11-03 (RTX 5090): a client reaches the main menu in 41-59
  s, the default variant's 62,659 block states draw in 49 s, an export takes 69 s.
- Without `BMGTNH_CLIENT_HOST` (empty) the clients run in the container: the launcher starts a private Xvfb display
  per client (`-displayfd`, 1920×1080; its log next to the client log as `*.xvfb.log`) when there is no `DISPLAY`, and
  Mesa renders with llvmpipe on the CPU (GL 4.5 core); a client reaches the main menu in about 90 s. Captures from
  llvmpipe differ from the Windows host's native OpenGL: 7.4% of the block-state colour images and 0.1-0.7% of the
  pixels of a camera view are more than 8 off in a channel (llvmpipe against the host, not an oracle result), so
  references captured there do not mix with the host's (`STATES_CAPTURE_VERSION`, `CAPTURE_VERSION`).
- GPU passthrough into the container (`--gpus all`, WSL's `/dev/dxg`, Mesa's `GALLIUM_DRIVER=d3d12`) was measured on
  2026-11-03 and dropped: it rendered (`D3D12 (NVIDIA GeForce RTX 5090)`, main menu in about 70 s), but reading back
  2,312 block states took 33.2 s against 3.1 s on llvmpipe, a full state run lost the device ("D3D12: Removing
  Device", SIGSEGV in libgallium) after about 56,000 states, and world captures slowed to minutes per job after a few
  jobs and differed between runs (up to 23% of the pixels of a gtnh-zoo view).
- The launcher picks the LWJGL natives of the host (Prism's rules: `linux` x86_64 in the container, `windows` x86_64 on
  the Windows host, `osx-arm64` on Apple silicon) and adds `-XstartOnFirstThread` only on macOS.
- First-time setup of the local state, in the container: the pack zips into `downloads/` (sha256 sums on
  downloads.gtnewhorizons.com), the addon jars of `downloads/addons/versions.json` into `downloads/addons/`,
  `cd modernity && uv run modernity fetch`; both servers (`servers/gtnh-2.9.0`, `servers/gtnh-addons-2.9.0` with the
  addon jars and `crashOnNullRecipeInput=false`) unpacked from the server zip with a random `.rcon-password`
  (mode 600); `uv run gtnh-client prepare` for `clients/gtnh-2.9.0`, `gtnh-modernity-2.9.0` and `gtnh-addons-2.9.0`
  (`--client-dir`); then `mise run all`.

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
mise run build ::: test       # several tasks (`mise run build test` would pass `test` to `build` as an argument)
mise run --force e2e          # run a step although it is up to date
mise run timings             # wall clock of the last run: every task, slowest first, lock waits, critical path
mise run adopt                # once per workspace, see below
```

> [!WARNING] Use `mise run plan`, not `mise run --dry-run`
> mise 2026.10.21 recorded a dry run in content-hash mode as if the tasks had succeeded, so `mise run -n all` marked
> every stale task up to date without running it; 2026.10.25 no longer does (`min_version` still admits the older
> ones). `mise run plan` runs the dry run on a throwaway copy of mise's state; it lists tasks without declared outputs
> (`test:*`, `verify`) even when they are up to date.

| Task | Runs | Inputs | Outputs |
|---|---|---|---|
| `build-fork` | `:cli:shadowJar :legacy:addonJar :gtnh-render:addonJar` and the fork's unit suites `:legacy:test :gtnh-render:test :oracle:test` | BlueMap `api`, `core`, `common` (+ webapp), `legacy`, `gtnh-render`, `oracle`, `cli`, build files | CLI shadow jar, addon jars |
| `build-servermod` | `implementations/gtnh` `build` (jar and the server mod's tests) | the server mod + the BlueMap modules it shades | `bluemap-<version>.jar` |
| `build-exporter` | `gtnh-exporter` `build` | exporter sources, `ResourceKeys.kt` | `bluemap-gtnh-exporter-<version>.jar` |
| `build-harness` | `harness` `build`, then installs the jar into both 2.9.0 servers' `mods/` | harness sources | `bmh-<version>.jar` (built and installed) |
| `test` | `test:legacy`, `test:gtnh-render`, `test:fork-oracle` (= `build-fork`), `test:servermod` (= `build-servermod`), `test:launcher`, `test:orchestrator`, `test:e2e` (unit), `test:modernity`, `test:pipeline` | each suite's sources and tests | (pass marker) |
| `scenes` | `scene:<name>` for the 12 scenes (`orch scene`) | orchestrator modules, server mods, harness sources | `dump.ndjson`, snapshot `level.dat` |
| `verify` | `orch verify` of every scene, one `:legacy:verifyDump` run for all 12 | reader sources, dumps, snapshots | (pass marker; result in `scene.json`) |
| `export` | `export:default`, `export:addons`, `export:modernity-vanilla`, `export:modernity` (client runs) | exporter sources (not its `oracle/` capture code), launcher, client mods, addon jars, Modernity release, the zoo dumps | the four packs |
| `oracle` | `oracle:default\|modernity\|addons` (world, `--all`), `oracle:states-default\|modernity` | BlueMap jars, e2e oracle code and scenes, capture version, client mods, packs, dumps, worlds | `summary.json`, states `report.json` |
| `e2e` | `e2e run` of every scene with baselines | BlueMap jars, e2e code and scenes, baselines, packs, worlds | `report.json` per scene |
| `demo` | `pnpm demo` | BlueMap jars, packs, `endgame` and `gt-multiblocks` worlds, `build-demo.ts` | `site/public/demo/`, `site/public/generated/` |
| `site` | `pnpm build && pnpm check` | pages, theme, demo outputs | `.vitepress/dist/` |
| `doctor` | quick checks, every run: tools, workspace inputs, Gradle cache settings, repository state | - | - |
| `timings` | summary of `out/pipeline/timings.ndjson` (`--runs N`, `--all`) | - | - |

- Task groups live in `pipeline/tasks/*.toml`: mise counts the file that defines a task as one of its sources, so
  editing one group does not invalidate the others. Helpers: `pipeline/gradlew`, `pipeline/steps.py`.
- Independent tasks run side by side (`jobs = 8`). What may not run twice at once is serialized, within a run by
  `wait_for` chains and across runs (a second terminal, `mise run check` beside `mise run all`) by locks in
  `locks/`, each of which prints its holder while a task waits for it:
  - one Gradle build per source tree: the BlueMap tree (the fork, the server mod, which includes it, `verify`'s
    `:legacy:verifyDump` and the state oracle's `:oracle:renderStates`) runs build-fork, build-servermod, verify,
    oracle:states-default, oracle:states-modernity in that order and holds `locks/gradle-BlueMap.lock`; the exporter
    and the harness have trees and locks of their own (the task's `BMGTNH_TASK_LOCKS`; `BMGTNH_TASK_LOCK_WAIT=<s>`
    bounds the wait);
  - one scene per server: the scenes of the reference server and those of the addon server are two chains that run
    side by side (own ports, own level folder), and `orch scene` holds `locks/server-<server>.lock`
    (`BMGTNH_SERVER_LOCK_WAIT`);
  - one set of GTNH clients: export:default, export:addons, export:modernity, oracle:states-default, oracle:default,
    oracle:modernity, oracle:addons, oracle:states-modernity in that order (the world oracles calibrate on the
    default state run's vanilla classification); the launcher holds `locks/client.lock` (`BMGTNH_CLIENT_LOCK_WAIT`).

  The pytest suites, e2e, the demo and the site hold nothing exclusive (free ports, `--no-build`). Builds are
  dependencies (`depends`); exports, scenes and the oracle are only ordered (`wait_for`), so `mise run oracle` never
  starts an export or a scene build on its own; their outputs are inputs, though, so a new pack or scene makes the
  oracle stale. The oracle starts a client only on a reference cache miss.
- After the exports three lanes share the CPU: e2e, the demo then the site, and the oracle chain. The demo and the
  site are the critical path, so e2e and every oracle task run with lower CPU priority (`BMGTNH_TASK_NICE=10`: `nice`,
  through `pipeline/steps.py shell`) and leave the demo the CPU when both want it. Inside the lanes, e2e runs 3 scenes
  at a time (`e2e run --jobs`) and the demo shoots its gallery on 2 pages (`pnpm demo --pages`). A lock that lets
  only one CPU-heavy task run at a time does not pay: e2e alone kept 26% of the CPUs busy on average and the demo
  36%, so serialising them adds up their run times (see below).
- Every task command runs through `python3 pipeline/steps.py shell` (`task_config.shell`): bash with `errexit` and
  `pipefail`, the task's locks, then one line in `out/pipeline/timings.ndjson` (task, start, seconds, lock wait, exit
  status, the `mise run` it belongs to). The lock wait includes the GTNH client lock, which the launcher takes inside
  the command (also on the Windows host behind the bridge): the shell relays the command's stderr line by line and
  adds the launcher's `[lock] client lock acquired after Ns` (also recorded alone as `client_wait`). mise prints each
  task's time when it ends (`task.timings`); `mise run timings` lists the last run slowest first with start and end
  offsets and its critical path (from the task that ended last back through the tasks it waited for, `depends` and
  `wait_for`).
- Every task that runs something has a `timeout` (mise stops it with SIGTERM, SIGKILL 5 s later): about 3x the cold
  run measured in the container for builds, suites, scenes and `verify`; exports, the oracle, e2e, the demo
  and the site have generous upper bounds (hot runs are measured below; a cold oracle run captures references first).
- `mise run adopt` records the outputs already in a workspace (packs, scenes, oracle and e2e reports, demo) as
  current without producing them again (`BMGTNH_ADOPT=1`; builds, tests, `verify` and `site` run normally). mise has no
  record of a task before its first successful run and would otherwise rerun every expensive step once. Use it only
  when those outputs match the checkout. The same goes after an edit to a task file that changes no input (a comment,
  a `sources` pattern that matches the same files): mise's state key hashes the task's definition and the file is one
  of its sources, so `BMGTNH_ADOPT=1 mise run --skip-deps <tasks>` records the tasks of that file that were up to date.

Wall clock of `mise run build ::: test` in the container (32 CPUs; GTNH clients and servers of other runs were busy
alongside, so single runs vary by a few seconds), before (one task at a time, separate Gradle runs for the fork's
three suites and the server mod's tests, no parallel or on-demand configuration in the BlueMap build) and after:

| Run | Before | After | Critical path after |
|---|---|---|---|
| `/ws` (bind mount), every task forced, Gradle up to date | 280.6 s | 92.2 s | build-fork 42.0 s, build-servermod 43.5 s |
| `/ws`, nothing changed (mise only hashes the sources) | - | 6.8-12.4 s | - |
| copy on the container file system, no build outputs, warm Gradle user home and build cache | 80.7 s | 28.0 s | build-fork 12.5 s, build-servermod 15.3 s |
| copy on the container file system, every task forced | 29.8 s | 6.8 s | build-exporter 6.7 s |

On the bind mount, half of each BlueMap Gradle run is spent re-reading files Gradle cannot watch there (see Gradle
caches). mise's freshness checks cost time of their own there: for every task, mise walks each directory below the
literal prefix of each `sources` pattern, stats every entry twice by absolute path (about 0.25 ms per path component
on the bind mount) and shares nothing between tasks. A real run pays the check of each task before starting it (4-5 s
for build-servermod after build-fork, 22 s for `verify`); `mise run plan` pays all of them. It took 55-60 s, most of
it in two places (strace of the dry run, 2026-11-05):

- The worlds, 44 of 85 s of system calls: `worlds-2.9.0/**/*.mca` walked about 250 directories of mod data per world,
  for every task that reads worlds.
- The BlueMap sources, 25 s, 18 s of it `BlueMap/core/src/main/**`, listed by five tasks.

Region files are only in `region/` and `DIM<n>/region/`, so the world patterns name those directories and every world
(`pipeline/test_pipeline.py` keeps the lists complete). A region directory under a new name would go unnoticed, but
`level.dat`, which every scene build rewrites, still counts. Since then `mise run plan` takes 30-32 s, with the same
plan. The rest is the BlueMap trees and the clients' `mods/`, which those tasks do read.

The heavy tasks after the exports, forced together with every reference cached (`mise run --force e2e ::: demo :::
site ::: oracle:...`, 32 CPUs, 2026-11-03/04). Oracle chain: from the start of the first oracle task to the end of the
last; CPU: the machine's average busy share. all-4 is a full `mise run all` before these changes, counted from the
end of its exports (it ran four of the five oracle tasks: the Modernity state oracle took another 1382 s alone).

| Run | e2e | demo | site | Oracle chain | Wall | CPU |
|---|---|---|---|---|---|---|
| all-4: bind mount read file by file, one scene and one gallery page at a time | 1210 s | 1415 s | 211 s | 2094 s | 2099 s | - |
| bind-mount fixes (state references copied, packs local, BlueMap side through a descriptor) | 1306 s | 1148 s | 199 s | 1058 s | 1386 s | 67% |
| and e2e 3 scenes at a time, gallery on 2 pages | 698 s | 1140 s | 167 s | 1165 s | 1346 s | 67% |
| and e2e niced | 748 s | 1139 s | 158 s | 1146 s | 1335 s | 69% |
| and the oracle niced as well (current) | 719 s | 1052 s | 189 s | 1182 s | 1277 s | 70% |

One at a time each was far from using the machine: e2e 841 s at 26% CPU, the demo 835 s at 36%, the oracle chain
965 s at 39% (measured before the gallery, e2e and BlueMap-side changes), so a lock that runs one heavy task at a
time (`locks/cpu`) would take their sum, 2,641 s before the site. The Modernity state oracle took 1382 s before (13
minutes of it making the 125,000 files of a new reference read-only on the bind mount, 249 s comparing against them
there) and takes 93-133 s now with a cached reference (a new one adds its capture, about 150 s, and one local copy,
90-145 s).

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
- Configuration cache: on in the exporter and harness (no-op harness `build` 14.0-14.4 s with it, 17.9-18.2 s
  without); off in the BlueMap build and the server mod, which includes it, because BlueMap's `buildSrc` runs git at
  configuration time and `:common:zipWebapp` holds a `Project`.
- Parallel execution: on in all four builds. In the BlueMap build (measured in the container, 2026-11-03) a clean
  `:cli:shadowJar :legacy:addonJar :gtnh-render:addonJar` took 138 s serial and 67 s parallel without the build
  cache, 73 s and 54 s with it.
- Configure on demand: on in the BlueMap build, which then configures only the projects the requested tasks need,
  not fabric, forge (its Minecraft Mavenizer), neoforge, paper, spigot and sponge: a no-op `:legacy:test` went from
  33-35 s to 23-24 s. It does not reach the BlueMap build when the server mod includes it (no-op server mod `test`
  43-47 s either way).
- One Gradle run per tree where the pipeline can: build-fork runs the fork's three unit suites in its own Gradle run
  (the three suites rerun together 25.8 s, one Gradle run each 75.2 s), and build-servermod's `build` runs the server
  mod's tests, so `test:legacy`, `test:gtnh-render`, `test:fork-oracle` and `test:servermod` only depend on the builds.
- The checkout is bind-mounted into the container (`/ws`, virtiofs). Gradle cannot watch it for changes ("Not watching
  /ws/harness since the file system is not supported") and re-reads the outputs it checks on every build. That cost
  the BlueMap build 25 s per run in `:common:nodeSetup` and `:common:npmInstall` alone (up-to-date checks of the
  Node.js download and the webapp's `node_modules`, about 9,600 files: reading them takes 21.4 s on the bind mount and
  0.2 s on the container's own file system), so both directories are container volumes (`.devcontainer`). For the
  mods' `build/` directories a volume does not pay: a no-op harness `build` took 13.9-15.6 s on the container file
  system and 14.4-17.2 s on the bind mount.
- Not changed, measured: GTNHGradle's buildscript update check (`gtnh.modules.updater`) fails ("Could not check for
  buildscript updates") on every run of the three mods, but turning it off saved nothing measurable; pytest-xdist
  takes the launcher suite from 6.0 s to 2.9 s (`-n 4`) and the e2e unit suite from 5.3 s to 6.5-6.9 s (`-n 4`) or
  18.6 s (`-n auto`), and every pytest suite already finishes while the BlueMap Gradle chain is still running.
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
