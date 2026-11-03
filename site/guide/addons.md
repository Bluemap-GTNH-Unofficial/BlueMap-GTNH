# Community addons

Five community addons for GT New Horizons 2.9.0 load, export and render, including their formed multiblocks and the
key special renderers. They were tested together on one 2.9.0 server, without changes to the addons' code.

| Addon | Version | Rendered |
|---|---|---|
| [Twist Space Technology](https://github.com/Nxer/Twist-Space-Technology-Mod) (TST) | 0.8.0 | blocks, machines, multiblocks; special renderers: artificial star, laser beacon / meteor miner beam, Eye of Wood, power chair, arcane hole |
| [Programmable Hatches](https://github.com/reobf/Programmable-Hatches-Mod) (PH) | 0.2.1p2 | blocks and machines |
| [GT: Not Leisure](https://github.com/GTNotLeisure/GT-Not-Leisure) (GTNL) | 0.2.7-rc2.1, with [GTNLLib](https://github.com/GTNotLeisure/GTNLLib) 1.1.3 | blocks, machines, multiblocks; special renderers: beam former, multi essentia jar, water candle, player doll, fumo, ender elevator |
| [NH Utilities](https://github.com/Keriils/NH-Utilities) | 1.7.0 | blocks |
| [Box++](https://github.com/luomolhx/BoxPlusPlus) (community fork) | 2.2.0.0 | blocks, machines; the ring renderer |

Animated effects (halos, beams) are drawn frozen at their first frame, and beams are opaque.

- **GT: Not Leisure needs GTNLLib.** GTNLLib is a library mod split out of GTNL; GTNL 0.2.7-rc2.1 does not load
  without it. Install `gtnllib-1.1.3.jar` next to the GTNL jar on the server and on the exporting client.
- **[123Technology](https://github.com/CallmeSHaobe/123Technology) is not supported** until an upstream release for
  2.9.0 exists. Its newest release, 2.2.0.1, stops a 2.9.0 server while loading
  (`NoSuchFieldError: tectech.util.CommonValues.TEC_MARK_EM`); the fix is on its main branch but not released yet.
  The port's 123Technology renderers (rocket, assembler, three figures) stay in place for that release.

## One configuration change

The addons need one setting, on **both the server and the exporting client**:

```properties [config/GregTech/GregTech.cfg]
# Twist Space Technology 0.8.0 builds a recipe from the empty ore dictionary
# entry craftingBlastFurnace and stops the game while loading otherwise.
B:crashOnNullRecipeInput=false
```

It only stops a crash. GT: Not Leisure needs no change: its recipe output chance (`enableRecipeOutputChance` in
`config/GTNotLeisure/machine.cfg`) works together with TST 0.8.0 and can stay on.

> [!NOTE]
> The exact layout of the lines in the `.cfg` file is Forge's configuration format: find the existing
> `crashOnNullRecipeInput` entry and change its value to `false`.

## Export with the addons

The pack has to come from a client with the same addons, so their blocks and GregTech machine textures are in it. Of
the two [ready-made packs](/guide/export#ready-made-packs) attached to the releases, use the addon pack
`bluemap-gtnh-resources-2.9.0-addons.zip`: it was exported from a 2.9.0 client with exactly the five addons and
versions above, so it fits a server with that modlist (the base pack `bluemap-gtnh-resources-2.9.0.zip` is for plain
2.9.0 servers). To export your own, use a separate client directory with the launcher and pass the addon jars,
GTNLLib included, with `--extra-mod`; see
[export the resource pack](/guide/export#route-1-the-launcher-tested-on-macos-arm64). The result is
`bluemap-gtnh-resources-2.9.0-addons.zip`; install it instead of the plain pack.

## Known addon problems

- TST's large solar boiler and GTNL's multi essentia pipe have no dedicated renderer.
