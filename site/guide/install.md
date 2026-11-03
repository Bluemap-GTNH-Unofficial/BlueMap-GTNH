# Install the server mod

1. **Back up your world.**
2. Download `bluemap-5.29-gtnh.2.jar` from the
   [releases](https://github.com/Bluemap-GTNH-Unofficial/BlueMap-GTNH/releases) and put it in the server's `mods/`
   folder. Clients do not need it.
3. Start the server once. BlueMap writes its configuration to `config/bluemap/` and its data to `bluemap/`.
4. Accept the download of Mojang's client jar, which BlueMap renders vanilla blocks with, by setting
   `accept-download: true` in `config/bluemap/core.conf`. This means you accept the
   [Minecraft EULA](https://www.minecraft.net/eula).
5. Get the resource pack and copy the zip into `config/bluemap/packs/`, either
   - **ready-made:** download from the same
     [release](https://github.com/Bluemap-GTNH-Unofficial/BlueMap-GTNH/releases) the base pack
     `bluemap-gtnh-resources-2.9.0.zip` for a plain GTNH 2.9.0 server, or the addon pack
     `bluemap-gtnh-resources-2.9.0-addons.zip` for a server running the five supported addons (see
     [ready-made packs](/guide/export#ready-made-packs) for their terms), or
   - **your own:** [export it](/guide/export) from a client copy. Do this if your modlist differs from both.
6. Run `/bluemap reload` (or restart the server).
7. Open the web map at port **8100** of your server, e.g. `http://localhost:8100/`.

::: code-group

```properties [config/bluemap/core.conf]
# BlueMap downloads Mojang's client jar for the vanilla textures.
# Setting this to true means you accept the Minecraft EULA.
accept-download: true
```

```sh [copy the pack]
cp bluemap-gtnh-resources-2.9.0.zip /path/to/server/config/bluemap/packs/   # or -addons.zip, or your exported zip
```

```text [server console / RCON]
bluemap reload
```

:::

## What the mod does on start

- It creates a map configuration for every dimension that has at least one region file and none yet, with
  `loader: "gtnh:anvil_1_7"`. Details on [maps, commands and config](/guide/maps).
- It regenerates `config/bluemap/packs/gtnh-runtime/` from the running server: the dimension types of loaded
  non-vanilla dimensions and all modded biomes.
- BlueMap loads in the background after the server is ready.

## Requirements recap

- GTNH **2.9.0**, Java 17-26 server pack, running on **Java 25** (lwjgl3ify). On Java 8 the mod does not load.
- Forgelin, which the pack provides.
- A resource pack (a ready-made one from the release, or your own export), or modded blocks render as
  missing-texture cubes.

## Updating and removing

The mod jar, `mcmod.info` and BlueMap itself share one version, `<upstream>-gtnh.<n>` (for example `5.29-gtnh.2`;
`/bluemap version` shows it). To update, replace the jar and restart. To remove the mod, delete the jar. Map data
lives in `bluemap/` by default; `core.conf`, `webapp.conf` and the storage configs say where yours is.

Server mod internals are documented in the
[server mod README](https://github.com/Bluemap-GTNH-Unofficial/BlueMap/blob/main/implementations/gtnh/README.md).
