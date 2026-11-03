# Export the resource pack

Modded blocks in 1.7.10 are drawn by code, not by resource-pack models, so BlueMap cannot render them on its own. The
[`gtnh-exporter`](https://github.com/Bluemap-GTNH-Unofficial/gtnh-exporter) client mod asks a running GTNH client how
every registered block looks and writes the answer as a BlueMap resource pack. Vanilla blocks are rendered from
Mojang's 1.13 client jar and are not exported.

Either route gives you `bluemap-gtnh-resources-2.9.0.zip` (named after the client's pack version; about 31 MB) and
`export-report.json` with per-mod counts. If your server runs any of the [community addons](/guide/addons), export
from a client that has the same addons and configuration.

> [!CAUTION] Do not redistribute the pack
> The pack contains the textures of the pack's mods. Use it on your own server only. Release assets of this project
> never include one.

## Route 1: the launcher (tested on macOS arm64)

The `gtnh-client` launcher unpacks a fresh client from the Prism instance zip, downloads Mojang, Forge and LWJGL 3
libraries (SHA-1 verified), starts the client minimized and muted with plain `java`, runs the exporter and quits.

1. Clone the workspace with its submodules (see [workspace & toolchain](/development/)).
2. Put the
   [GTNH 2.9.0 Java 17-26 instance zip](https://downloads.gtnewhorizons.com/Multi_mc_downloads/GT_New_Horizons_2.9.0_Java_17-26.zip)
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
uv run gtnh-client prepare --client-dir ../../clients/gtnh-addons-2.9.0   # or a copy of clients/gtnh-2.9.0
# apply the GregTech config change from "Community addons" to clients/gtnh-addons-2.9.0, then
# install the addon jars for this export only (--extra-mod is repeatable):
uv run gtnh-client export --client-dir ../../clients/gtnh-addons-2.9.0 \
  --out ../../out/exporter-addons-2.9.0 --pack-suffix addons \
  --extra-mod /path/to/TwistSpaceTechnology-0.8.0.jar --extra-mod /path/to/gtnllib-1.1.3.jar \
  --extra-mod /path/to/sciencenotleisure-0.2.7-rc2.1.jar  # ... and the other addon jars
```

:::

The pack lands in `out/exporter-2.9.0/`. One export takes about 51 s on our machine (client start, about 5 s of
export, automatic exit).

Every launcher command takes `--pack-version`, which only accepts `2.9.0` (the default; `$BMGTNH_PACK_VERSION` sets it
too). Given the flag, the launcher refuses a client directory whose own pack version (GTNH Core Mod's
`ModPackVersion` in `config/GTNewHorizons/dreamcraft.cfg`) differs.

Useful launcher commands:

| Command | What it does |
|---|---|
| `uv run gtnh-client prepare --clean` | unpack a fresh client into `clients/gtnh-2.9.0` and fetch its libraries and assets |
| `uv run gtnh-client run --timeout 600` | start the client (minimized, muted), stop it after the timeout |
| `uv run gtnh-client export` | build the exporter, prepare, run it, check the outputs |
| `uv run gtnh-client play --server 127.0.0.1:25567` | play on a local server without the exporter, e.g. to test player markers |

All options are in the
[launcher README](https://github.com/Bluemap-GTNH-Unofficial/gtnh-exporter/blob/main/launcher/README.md).

## Route 2: by hand (untested)

1. Make a **copy** of your 2.9.0 client instance.
2. Put `bluemap-gtnh-exporter-0.1.0.jar` into the copy's `mods/` folder.
3. Start the copy. When the main menu appears, the mod exports to `.minecraft/bluemap-gtnh-export/` and closes the
   game (exit code 0; 1 if the export failed).
4. Remove the jar from the copy afterwards.

## Install the pack

```sh
cp out/exporter-2.9.0/bluemap-gtnh-resources-2.9.0.zip /path/to/server/config/bluemap/packs/
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
[GregTech renderers](/architecture#renderers) use. On 2.9.0 the export covers 4,087 blocks with 61,468 states from
138 mods; 1,476 of these states could not be exported (`export-report.json` lists them per mod, with the reason) and
draw as missing-texture cubes unless a dedicated renderer draws them. The format is documented in the
[exporter README](https://github.com/Bluemap-GTNH-Unofficial/gtnh-exporter#what-is-exported).

## Optional: Modernity-GTNH look

The [`modernity`](https://github.com/Bluemap-GTNH-Unofficial/modernity) tool builds packs with the
[Modernity-GTNH](https://github.com/ModernityGTNH/Modernity-GTNH) textures from a release you download yourself.

`modernity vanilla` converts its vanilla textures; `modernity modded` exports a 2.9.0 client with the release enabled.
Connected-texture sheets, MCPatcher compact CTM, self-culling glass, hatch connections, panes and the layer order of
werkstoff textures are handled. In the per-state oracle on 2.9.0, 76.5% of the judged block states pass with the
Modernity packs (78.5% with the default export); see [status](/status).
