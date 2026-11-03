# Tests & scenes

Every layer has its own check. What each check proves, and what it does not, is summarised on the
[status page](/status#verification).

## Unit tests

From the workspace root, `mise run test` runs every suite below (each one is skipped while its sources are unchanged
since it last passed), `mise run test:<suite>` one of them and `mise run check` only those the current changes need;
see [the pipeline](/development/building#pipeline).

::: code-group

```sh [BlueMap fork]
cd BlueMap
mise exec -- ./gradlew :legacy:test :gtnh-render:test
```

```sh [Python tools]
cd orchestrator && uv run --group dev pytest
cd e2e && uv run --group dev pytest -m "not e2e"     # unit tests only, seconds
cd gtnh-exporter/launcher && uv run pytest
cd modernity && uv run --group dev pytest
```

:::

## Scenes

Test scenes are deterministic worlds built by the [`orchestrator`](https://github.com/Bluemap-GTNH-Unofficial/orchestrator)
on a headless GTNH server with the [`bmh` harness mod](https://github.com/Bluemap-GTNH-Unofficial/harness). Every scene
starts from an empty level with structure generation off (`generate-structures=false`, for that boot only) and
daylight cycle, mob spawning, fire tick and mob griefing off. A superflat scene first generates the chunks under its
build volume and clears everything above the ground there (`<name>-cleared.ndjson`, `cleared` in `scene.json`): even
with structures off, GTNH 2.9.0 places Village Names villages, Pam's gardens and Thaumcraft aura nodes. It then builds
its content over RCON, generates the chunks around it and clears everything above the ground in a three-chunk margin
around the dump box (`margin-cleared-<i>.ndjson`, `margin_cleared`), so renders and client captures of the
surroundings show flat ground. Finally it holds its chunks so tile entities settle, drops scheduled block updates,
saves, dumps every block of its box (`dump.ndjson`, right after saving so it matches the disk), stops the server and
fails if a crash report appeared.

GTNH 2.9.0 is the only pack version: `orch --pack-version` accepts `2.9.0` (the default, also `$BMGTNH_PACK_VERSION`)
and with it picks the server (`gtnh-2.9.0` on ports 25569/25579) and the output folders `out/scenes-2.9.0/` and
`worlds-2.9.0/`.

```sh
cd orchestrator
uv run orch scene --list                  # every scene, its level type and the server it needs
uv run orch scene vanilla-zoo             # fresh world -> bmh zoo + dump -> out/scenes-2.9.0/ and worlds-2.9.0/
uv run orch scene gt-machines --verify    # ... then :legacy:verifyDump on the snapshot and the dump
uv run orch scene all --verify            # every scene runnable on this server; exit 1 on any failure
uv run orch scene endgame --verify        # the end-game plaza of the site demo (35 machines, about a minute)
```

| Scene | Content |
|---|---|
| `vanilla-zoo` | every vanilla block on a 2-block grid (326 placed) |
| `gtnh-zoo` | every block of every mod in the pack (16,595 placed on 2.9.0) |
| `gt-machines` | every single-block GregTech MetaTileEntity, facing north, plus other facings per class |
| `gt-pipes` | every cable, fluid pipe, item pipe and frame, as lines, T, crosses and in 17 colours |
| `gt-ores` | every material on every `gt.blockores2` stone, normal and small |
| `gt-multiblocks` | GT, GT++, bartworks, TecTech and kekztech multiblocks, built with StructureLib, every 48 blocks (19 controllers, 18 formed; GregTech cannot check the bricked blast furnace) |
| `mod-renderers` | blocks of the mods with dedicated renderers, placed like a player would: Chisel connected textures, Iron Chests, BiblioCraft, AE2 cables and parts, EnderIO conduits |
| `endgame` | the site demo's plaza of 35 end-game multiblocks |
| `terrain-rwg` | Realistic World Gen terrain, seed 1710 |
| `addons-zoo`, `addons-machines`, `addons-multiblocks` | the five community addons of 2.9.0 (need the addon server) |

The addon scenes need the pack version's addon server, a second server with the addon jars and the
[addon config changes](/guide/addons#configuration-changes):

```sh
uv run orch --server gtnh-addons-2.9.0 --port 25572 --rcon-port 25582 scene addons-zoo --verify
```

## Reader reconciliation

`verifyDump` compares, at every position of a scene's dump box, the block name and metadata the reader sees with the
server's dump, checks that every non-air block the reader sees is in the dump, and compares tile entity presence and
ids.

```sh
cd BlueMap
mise exec -- ./gradlew :legacy:verifyDump \
  --args="<world> minecraft:overworld <dump.ndjson> [--box x1 y1 z1 x2 y2 z2]"
```

The vanilla flattening oracle (a 1.7.10 world upgraded by the official 1.13.2 server, compared position by position):

```sh
cd BlueMap
python3 legacy/src/test/python/oracle_world.py all
mise exec -- ./gradlew :legacy:compareFlattening
```

## Browser e2e

The [`e2e`](https://github.com/Bluemap-GTNH-Unofficial/e2e) suite renders each scene with the BlueMap CLI, serves it,
opens camera views in headless Chromium with software WebGL (SwiftShader, so pixels do not depend on the GPU) and
compares the screenshots with locally approved baselines. Repeated runs give pixel-identical screenshots.

```sh
cd e2e
uv sync --group dev
uv run playwright install chromium                 # once per machine
uv run e2e run [scene...]                          # all scenes by default; exit 1 if any check fails
uv run e2e run gtnh-zoo --no-build --packs ../out/exporter-2.9.0/bluemap-gtnh-resources-2.9.0.zip
uv run e2e approve <scene> [view...]               # copy the latest screenshots to baselines-2.9.0/
uv run e2e list                                    # scenes, views and their URL hashes
uv run --group dev pytest                          # unit tests + one e2e test per scene view
```

`e2e` works on the GTNH 2.9.0 folders: the scene worlds (`worlds-2.9.0/`), the scene outputs (`out/scenes-2.9.0/`),
the exported pack (`out/exporter-2.9.0/`), the run outputs (`out/e2e-2.9.0/`) and the baselines (`baselines-2.9.0/`;
8 scenes, 50 views). `--pack-version` (default `$BMGTNH_PACK_VERSION`, else 2.9.0) accepts only `2.9.0`.

A view fails when it has no baseline, differs from it beyond the tolerance, shows too little content, shows too much
of BlueMap's missing texture, does not settle in time, or logs console errors or failed requests.

> [!IMPORTANT] Regression only
> Baselines are approved by eye from earlier renders of the same tool and live only on the machine that approved
> them (they contain Minecraft and mod textures). A passing run shows that nothing changed, not that the map looks
> like the game. That is the job of the [client oracle](/development/oracle).

## Site demo

The [demo page](/showcase) embeds a live BlueMap map and a gallery. Both are generated locally and git-ignored,
because they contain Minecraft, mod and Modernity-GTNH textures:

```sh
cd orchestrator && uv run orch scene endgame   # the end-game plaza world, once
cd site
pnpm demo                        # render + gallery
pnpm demo --skip-render          # gallery only, from the existing maps
pnpm demo --build                # build the CLI and addon jars with Gradle first
pnpm demo --maps gt_multiblocks_modernity,gtnh_zoo_default   # a subset; gtnh_zoo_default is only built this way
```

`scripts/build-demo.ts` renders scene worlds the same way `e2e` does (the newest CLI shadow jar, the `legacy` and
`gtnh-render` addon jars, loader `gtnh:anvil_1_7`), but writes one static webapp with all maps to `site/public/demo/`.
It renders the GTNH 2.9.0 scene worlds (`worlds-2.9.0/`, `out/scenes-2.9.0/`). Each map has a texture variant, named
in its id and label: `default` uses the exported pack (`out/exporter-2.9.0/bluemap-gtnh-resources-2.9.0.zip`),
`modernity` adds the Modernity-GTNH modded pack built for 2.9.0 and the vanilla pack of `out/modernity/` on top of it,
in the order `modernity e2e` uses. BlueMap loads one set of packs per run, so each variant is a CLI run of its own
into the same webroot. The default maps are `endgame_modernity`, `gt_multiblocks_modernity` and `endgame_default`.

- gzip file storage with the webapp's `client-decompression`, so the map data stays small and needs no web server
  configuration;
- a small service worker (`demo-sw.js`) stands in for what BlueMap's own web server does and a static host cannot:
  it answers 204 for tiles outside the rendered area and for the live-update stream, and keeps `.gz` bodies gzipped
  on hosts that send them with `Content-Encoding: gzip` (such as `pnpm preview`), so the map loads without failed
  requests anywhere;
- then it takes screenshots with Playwright (software WebGL) into `site/public/generated/`, downscaled JPEGs plus
  `gallery.json`: the fixed gt-multiblocks views, an overview and one view per machine of the end-game plaza
  (labels and boxes from `out/scenes-2.9.0/endgame/scene.json`), and two machines again on `endgame_default` for the
  Modernity vs default slider. The end-game cameras use the webapp's perspective view; since it sets the orbit
  target's height from the terrain, the script samples the terrain heights in the loaded map to aim each camera at
  the middle of its machine, so "Show in the live map" lands on the same view. The live map opens on the overview
  (`startLocation` in `settings.json`).

`pnpm build` works with or without these folders; without them the demo page shows placeholders. `pnpm check` serves
the build on a free port of its own, so a running `pnpm preview` does not get in the way.

To publish the demo with the site, `pnpm demo:bundle` packs `public/demo/` and `public/generated/` into
`out/site-demo-bundle/` and `pnpm demo:publish --tag demo-<date>` prints (with `--yes`, runs) the `gh release create`
command for a `demo-*` pre-release of the umbrella repository. The Pages workflow (`.github/workflows/pages.yml`)
fetches the newest `demo-*` release with `pnpm demo:fetch` before `pnpm build`; without one the site builds with the
placeholders. The demo is never committed.
