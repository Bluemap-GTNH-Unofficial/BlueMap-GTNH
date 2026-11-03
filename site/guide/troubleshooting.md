# Troubleshooting

Problems we ran into, and what fixed them. Remember that this port is [unofficial](/status): do not report its
problems to BlueMap or the GTNH team.

## The mod does not load

**Symptom:** the server log shows `UnsupportedClassVersionError` or the mod is missing from the mod list.

The mod is compiled to **Java 25** bytecode. It only loads on the Java 17-26 server pack running on Java 25 through
lwjgl3ify, not on the Java 8 pack. Check the Java version in the first lines of the server log, and that the server
starts through lwjgl3ify (`@java9args.txt -jar lwjgl3ify-forgePatches.jar nogui`).

## Modded blocks are magenta-and-black cubes

That is BlueMap's missing-texture cube. Either the exported pack is missing, or it does not match the pack:

- Check that a pack of your server's version and modlist is in `config/bluemap/packs/` (on 2.9.0 the ready base pack
  `bluemap-gtnh-resources-2.9.0.zip` for a plain server, the ready addon pack `bluemap-gtnh-resources-2.9.0-addons.zip`
  with the five supported addons, or your own export) and run `/bluemap reload`, then `/bluemap force-update` for the
  affected area.
- If your modlist is neither plain 2.9.0 nor 2.9.0 with the five supported addons, export from a client with the same
  pack version and the same addons as the server.
- 1,476 of the 61,468 block states of 2.9.0 cannot be exported at all; unless a dedicated renderer draws them, they
  always show as missing-texture cubes. `export-report.json` lists them; see [known gaps](/status#known-gaps).

## Vanilla blocks have no textures

BlueMap needs Mojang's client jar for vanilla textures. Set `accept-download: true` in `config/bluemap/core.conf`
(this accepts the Minecraft EULA) and reload.

## The export client hangs or times out (macOS)

### Display sleep

With the display asleep, the client's render loop is throttled so hard that Forge's login handshake times out. The
launcher keeps the display awake with `caffeinate -dimsu` while the client runs. If you start a client by hand, keep the
display awake yourself (for example `caffeinate -d` in a terminal) and do not lock the screen.

### "Timeout waiting for client thread to catch up!" on a local server

Forge 1.7.10 opens its connecting screen before it creates the client latch, so a fast **local** server's login
reply can arrive too early and get lost; the FML handshake then times out. `gtnh-client play` routes the connection
through a small local proxy that holds the server's first reply for 2 s (`--connect-delay 2`, the default). Use
`--connect-delay 0` to connect directly.

```sh
uv run gtnh-client play --server 127.0.0.1:25567 --username Tester   # 2 s delay by default
```

### The export does not start

The exporter runs 20 client ticks after the first screen (the main menu) opens, then quits. If the client never
reaches the main menu, read the client log (`clients/<client>/logs-launcher/client-*.log`); first boots of a fresh
client take longer than later ones. The launcher stops the client after `--timeout` (1800 s by default) with exit
code 124.

## The server crashes with the community addons

- **On start, in a Twist Space Technology recipe:** set `crashOnNullRecipeInput=false` in
  `config/GregTech/GregTech.cfg`; needed on 2.9.0 (TST 0.8.0). See [community addons](/guide/addons).
- **GT: Not Leisure 0.2.7-rc2.1 does not load:** install GTNLLib 1.1.3 (required since rc2.1).

## `/bluemap reload` answers "Still running ..."

Normal over RCON: GTNH runs RCON commands on the server thread, so the mod replies after at most 1 s and the command
finishes in the background. Watch the server log for the result.

## Building: "Failed to open bundled webapp"

The BlueMap CLI and the server mod need the webapp in the jar. Do not build them with `-x :common:buildWebapp`; see
[building](/development/building).
