# Export the resource pack

Modded blocks in 1.7.10 are drawn by code, not by resource-pack models, so BlueMap cannot render them on its own. The
[`gtnh-exporter`](https://github.com/Bluemap-GTNH-Unofficial/gtnh-exporter) client mod asks a running GTNH client how
every registered block looks and writes the answer as a BlueMap resource pack. Vanilla blocks are rendered from
Mojang's 1.13 client jar and are not exported.

Either route gives you `bluemap-gtnh-resources-2.9.0-RC-2.zip` (about 27 MB) and `export-report.json` with per-mod
counts. If your server runs any of the [community addons](/guide/addons), export from a client that has the same
addons and configuration.

> [!CAUTION] Do not redistribute the pack
> The pack contains the textures of the pack's mods. Use it on your own server only. Release assets of this project
> never include one.

## Route 1: the launcher (tested on macOS arm64)

The `gtnh-client` launcher unpacks a fresh client from the Prism instance zip, downloads Mojang, Forge and LWJGL 3
libraries (SHA-1 verified), starts the client minimized and muted with plain `java`, runs the exporter and quits.

1. Clone the workspace with its submodules (see [workspace & toolchain](/development/)).
2. Put the
   [GTNH 2.9.0-RC-2 Java 17-26 instance zip](https://downloads.gtnewhorizons.com/Multi_mc_downloads/betas/GT_New_Horizons_2.9.0-RC-2_Java_17-26.zip)
   into `downloads/`.
3. Run the export:

::: code-group

```sh [build the exporter too]
cd gtnh-exporter/launcher
uv run gtnh-client export --clean
```

```sh [use the released jar]
cd gtnh-exporter/launcher
uv run gtnh-client export --clean \
  --mod-jar /path/to/bluemap-gtnh-exporter-0.1.0.jar
```

```sh [with community addons]
cd gtnh-exporter/launcher
uv run gtnh-client prepare --client-dir ../../clients/gtnh-addons
# apply the two config changes from "Community addons" to clients/gtnh-addons, then
# install the addon jars for this export only (--extra-mod is repeatable):
uv run gtnh-client export --client-dir ../../clients/gtnh-addons \
  --out ../../out/exporter-addons --pack-suffix addons \
  --extra-mod /path/to/addon-1.jar --extra-mod /path/to/addon-2.jar
```

:::

The pack lands in `out/exporter/`. One export takes about a minute on our machine (client start, about 5 s of
export, automatic exit); the first boot of a freshly unpacked client takes about 96 s to the main menu.

Useful launcher commands:

| Command | What it does |
|---|---|
| `uv run gtnh-client prepare --clean` | unpack a fresh client into `clients/gtnh-2.9.0-RC-2` and fetch its libraries and assets |
| `uv run gtnh-client run --timeout 600` | start the client (minimized, muted), stop it after the timeout |
| `uv run gtnh-client export` | build the exporter, prepare, run it, check the outputs |
| `uv run gtnh-client play --server 127.0.0.1:25567` | play on a local server without the exporter, e.g. to test player markers |

All options are in the
[launcher README](https://github.com/Bluemap-GTNH-Unofficial/gtnh-exporter/blob/main/launcher/README.md).

## Route 2: by hand (untested)

1. Make a **copy** of your 2.9.0-RC-2 client instance.
2. Put `bluemap-gtnh-exporter-0.1.0.jar` into the copy's `mods/` folder.
3. Start the copy. When the main menu appears, the mod exports to `.minecraft/bluemap-gtnh-export/` and closes the
   game (exit code 0; 1 if the export failed).
4. Remove the jar from the copy afterwards.

## Install the pack

```sh
cp out/exporter/bluemap-gtnh-resources-2.9.0-RC-2.zip /path/to/server/config/bluemap/packs/
```

then run `/bluemap reload` on the server (or restart it).

## What gets exported

| Block | Result in the pack |
|---|---|
| Plain full cubes (render type 0) | JSON cube models with the block's own icons, tint and light |
| Any other shape (vanilla shapes, custom block renderers) | quads captured from the client's tessellator, drawn by the `gtnh:quads` renderer |
| Only a tile-entity special renderer | a bounding-box fallback with the block's own icons |
| No icon or an exception | nothing; the map draws a missing-texture cube and the report says why |

GregTech machines, ores and frames also get a dump of GregTech's own texture data (`gtnh/gregtech/`), which the
[GregTech renderers](/architecture#renderers) use. On 2.9.0-RC-2 the export covers 4,092 blocks with 62,476 states
from 138 mods; 518 states could not be exported. The format is documented in the
[exporter README](https://github.com/Bluemap-GTNH-Unofficial/gtnh-exporter#what-is-exported).

## Optional: Modernity-GTNH look

The [`modernity`](https://github.com/Bluemap-GTNH-Unofficial/modernity) tool builds packs with the
[Modernity-GTNH](https://github.com/ModernityGTNH/Modernity-GTNH) textures from a release you download yourself.

> [!IMPORTANT] Currently broken
> Textures render incorrectly with the packs the `modernity` tool builds. It is being reworked; do not use it for now.
