# Community addons

Six community addons for GTNH 2.9.0-RC-2 load, export and render, including their formed multiblocks and the key
special renderers. They were tested together on one server, without changes to the addons' code.

| Addon | Version | Rendered |
|---|---|---|
| [Twist Space Technology](https://github.com/Nxer/Twist-Space-Technology-Mod) (TST) | 0.8.0-RC2.9 | blocks, machines, multiblocks; special renderers: artificial star, laser beacon / meteor miner beam, Eye of Wood, power chair, arcane hole |
| [Programmable Hatches](https://github.com/reobf/Programmable-Hatches-Mod) (PH) | 0.2.0p28 | blocks and machines |
| [GT: Not Leisure](https://github.com/ABKQPO/GT-Not-Leisure) (GTNL) | 0.2.7-rc2 | blocks, machines, multiblocks; special renderers: beam former, multi essentia jar, water candle, player doll, fumo, ender elevator |
| [123Technology](https://github.com/CallmeSHaobe/123Technology) | 2.2.0 | blocks and machines; rocket, assembler and three figure renderers |
| [NH Utilities](https://github.com/Keriils/NH-Utilities) | 1.7.0 | blocks |
| [Box++](https://github.com/luomolhx/BoxPlusPlus) (community fork) | 2.2.0.0 | blocks, machines; the ring renderer |

Animated effects (halos, beams) are drawn frozen at their first frame, and beams are opaque.

## Two configuration changes

On 2.9.0-RC-2 the addons need two settings, on **both the server and the exporting client**:

::: code-group

```properties [config/GregTech/GregTech.cfg]
# Twist Space Technology 0.8.0-RC2.9 builds a recipe from the empty ore dictionary
# entry craftingBlastFurnace and crashes the game on start otherwise.
B:crashOnNullRecipeInput=false
```

```properties [config/GTNotLeisure/GTNotLeisure.cfg]
# GTNL 0.2.7-rc2's mixin into TST's GTCM_ParallelHelper fails against TST RC2.9,
# so no TST multiblock can form otherwise.
B:enableRecipeOutputChance=false
```

:::

The first change only stops a crash. The second one **turns off a GTNL gameplay feature** (recipe output chance);
decide whether you want that on your server.

> [!NOTE]
> The exact layout of the lines in the two `.cfg` files is Forge's configuration format: find the existing
> `crashOnNullRecipeInput` and `enableRecipeOutputChance` entries and change their value to `false`.

## Export with the addons

The exported pack has to come from a client with the same addons, so their blocks and GregTech machine textures are
in it. With the launcher, use a separate client directory and pass the addon jars with `--extra-mod`; see
[export the resource pack](/guide/export#route-1-the-launcher-tested-on-macos-arm64). The result is
`bluemap-gtnh-resources-2.9.0-RC-2-addons.zip`; install it instead of the plain pack.

## Known addon problems

- **GT: Not Leisure machine 21153** (Eye of Harmony module, `ETGWEyeOfHarmonyModule`) crashes the server on
  2.9.0-RC-2 within one tick of being placed. This is a GTNL bug, unrelated to this mod.
- A GTNL machine shows about 1% missing texture in our tests because GTNL's texture folder has the wrong case; it
  looks the same in game.
- TST's large solar boiler and GTNL's multi essentia pipe have no dedicated renderer.
