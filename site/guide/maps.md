# Maps, commands and configuration

The server mod embeds BlueMap 5.29, so most of [BlueMap's own documentation](https://bluemap.bluecolored.de/wiki/)
applies. This page covers what is different on GTNH.

## Files

| Path | Content |
|---|---|
| `config/bluemap/` | BlueMap's configuration: `core.conf`, `webapp.conf`, `webserver.conf`, `maps/`, `storages/`, `packs/` |
| `config/bluemap/maps/<map>.conf` | one map; generated for new dimensions, then yours to edit |
| `config/bluemap/packs/` | resource packs and addons BlueMap loads: put the exported pack here |
| `config/bluemap/packs/gtnh-runtime/` | regenerated from the running server on every start; do not edit |
| `config/bluemap/gtnh-known-dimensions.conf` | dimensions that already got a map config; they are never offered again |
| `bluemap/` | BlueMap's data |

## Maps and dimensions

GTNH creates about 55 dimension folders on the first start, most of them empty. The mod therefore only creates a map
for a dimension that has **at least one region file**:

- On every start, every dimension with region files that has no map config yet gets one, with
  `loader: "gtnh:anvil_1_7"`. Non-vanilla dimensions also get `dimension-type: "gtnh:dim_<id>_type"`.
- Existing map configs are **never modified**.
- Every dimension that got (or had) a config is recorded in `gtnh-known-dimensions.conf`. Deleting a map config
  therefore removes the map for good; it does not come back on the next start.
- `gtnh-runtime/` holds the dimension types of loaded non-vanilla dimensions (sky, ceiling, light from the dimension's
  `WorldProvider`) and every modded biome (temperature, rainfall, water colour; 155 modded biomes on 2.9.0-RC-2).
  Dimensions loaded later update their file for the next `/bluemap reload`.

The generated configs use BlueMap's own commented template and its map ids: `world` for the overworld,
`world_<dimension>` for the others (named like `world (the_nether)`). The keys the mod sets, for a modded dimension
with id 7:

```properties
world: "world"
dimension: "gtnh:dim_7"
dimension-type: "gtnh:dim_7_type"
loader: "gtnh:anvil_1_7"
name: "world (gtnh:dim_7)"
```

To hide a dimension, delete its config. To get a deleted config generated again, remove the dimension from its list
in `gtnh-known-dimensions.conf` and restart. A dimension without region files gets a map once it has been visited
and saved, on the next start.

## Commands

`/bluemap` drives BlueMap's command tree directly. Every subcommand needs operator rights (permission level 1). Some
of the most useful ones:

| Command | What it does |
|---|---|
| `/bluemap` | status of BlueMap and its render tasks |
| `/bluemap maps` | list the maps |
| `/bluemap reload` | reload configuration and resource packs (after adding a pack) |
| `/bluemap update [map] [radius]` | save the world and update changed tiles |
| `/bluemap force-update [map] [radius]` | re-render, whether or not the tiles changed |
| `/bluemap fix-edges [map] [radius]` | re-render tile edges |
| `/bluemap freeze <map>` / `unfreeze <map>` | stop or resume automatic updates of a map |
| `/bluemap purge <map>` | delete the rendered data of a map |
| `/bluemap tasks` | running render tasks; `tasks cancel all` stops them |
| `/bluemap troubleshoot [map]` | diagnose a map |
| `/bluemap version` | BlueMap version (`5.29-gtnh.1`) |

### Over RCON

The commands also work over RCON, and the reply contains the command output. GTNH's Hodgepodge
(`fixRconThreading`, on by default) runs RCON commands on the server thread, so the mod waits at most 1 s there and
lets BlueMap's server-thread work (such as saving) run meanwhile. Commands still running after that, such as
`reload`, reply "Still running ..." and finish in the background. Without Hodgepodge's fix the command waits up to
60 s on the RCON thread.

`/bluemap update` saves the dimension on the server thread and waits for the chunk IO thread.

## Live updates and players

- Tiles update after world saves: BlueMap watches the region files. In our test, tiles were re-rendered within 25 s
  of `save-all`.
- Online players appear on the map. In a test with a real client, login, position, teleports (updated within
  1-1.5 s), invisibility and logout were all shown correctly.

## Render threads

BlueMap renders with 3 threads by default (`render-thread-count` in `core.conf`). For the first full render of a
large world, more threads are much faster and did not cost TPS on our 18-core machine; see
[performance](/guide/performance).

## Web server

The map is served by BlueMap's integrated web server on port 8100 (`config/bluemap/webserver.conf`). To put it behind
a reverse proxy or host it as static files, follow
[BlueMap's wiki](https://bluemap.bluecolored.de/wiki/).
