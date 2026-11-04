---
aside: false
---

<script setup>
import { data as n } from "./data/results.data.ts";
</script>

# Demo

> [!NOTE] Textures and takedown requests
> The maps and screenshots on this page show textures from Minecraft (Mojang), the GT New Horizons mods and
> [Modernity-GTNH](https://github.com/ModernityGTNH/Modernity-GTNH) by its contributors, which belong to their
> authors. Modernity-GTNH is licensed [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/); its
> textures were rendered into these map tiles and screenshots, which are shared under the same licence. The demo is
> non-commercial. Rights holders who want something removed can
> [open a takedown issue](https://github.com/Bluemap-GTNH-Unofficial/BlueMap-GTNH/issues/new?template=takedown.yml),
> and it will be removed promptly.

A live BlueMap map of test scenes, rendered by this port, and screenshots taken from it. Drag to rotate, scroll to
zoom, and switch maps with the map button in the top left corner of the map. Each map's name says which textures it
uses:

- **End-game machines (Modernity-GTNH textures)** (`endgame_modernity`): the largest end-game multiblocks of GTNH
  2.9.0 on one plaza, in the look of the [Modernity-GTNH](https://github.com/ModernityGTNH/Modernity-GTNH) resource
  pack. The map opens on it.
- **GregTech multiblocks (Modernity-GTNH textures)** (`gt_multiblocks_modernity`): formed multiblocks of GregTech
  and its addon mods, one every 48 blocks along the x axis, floating at y = 20.
- **End-game machines (default textures)** (`endgame_default`): the same plaza with the exported resource pack only,
  for comparison.

<DemoMap />

> [!NOTE] Test worlds, not a real base
> All scenes are superflat test worlds that the harness mod built block by block; the black void around them is the
> edge of what was generated. Magenta-and-black cubes are block states the exporter could not capture (see
> [known gaps](/status#known-gaps)). The Modernity-GTNH textures were converted from a release downloaded locally
> with the [`modernity`](https://github.com/Bluemap-GTNH-Unofficial/modernity) tool. The demo is rendered locally and
> published only as a pre-release asset of the umbrella repository that this site deploys; it is never committed.

## End-game machines

The `endgame` scene puts 35 end-game multiblocks on a smooth stone plaza, in rows from front to back: the fusion
reactors Mark I to MK V, the compact fusion computers Mk-I to Mk-V, the mega multiblocks, end-game processing
machines, the giants (Eye of Harmony, Dimensionally Transcendent Plasma Forge, Space Elevator, the antimatter forge
and generator) and, at the back, the Forge of the Gods with one module of each kind next to the Large Hadron
Collider. The [orchestrator](https://github.com/Bluemap-GTNH-Unofficial/orchestrator) built it: each controller is
placed facing north and its structure is built automatically with StructureLib, at the stack size that gives every
tiered part its highest tier (Eye of Harmony tier 9 field generators, Eternal coils, UXV-tier glass, Space Elevator
motor tier 5, all three Godforge rings). The scene then checks that every machine formed; on GTNH 2.9.0 all 35 do.
The world is generated without structures, and the plaza and its surroundings are cleared before anything is built.

Select **Show in the live map** to fly the map above to a screenshot's camera. The cameras use the map's perspective
view, so you can then drag to orbit around the machine and scroll to zoom.

<DemoEndgame />

### Modernity-GTNH or default textures

The same camera on both end-game maps. Drag the slider (or focus it and use the arrow keys): Modernity-GTNH on the
left of the line, the default textures on the right.

<DemoCompare />

### What the map does not show

BlueMap draws block models. What the game draws with special renderers (TileEntitySpecialRenderers, TESRs) is
missing from the map:

- **Space Elevator:** in the game a tether runs from the base into the sky. It is a special renderer; the map shows
  only the base.
- **Running machines:** a running Eye of Harmony shows a star in its centre, a fuelled Forge of the Gods replaces its
  rings with a rotating star, the Quantum Force Transformer shows a force field and the antimatter forge its
  antimatter, all special renderers. The machines here are idle and unfuelled, so the game draws them like the map
  does; on a real server's map, running ones would still look idle.
- **Left out:** the SGCraft Stargate and the Draconic Evolution reactor are drawn only by special renderers once they
  are formed, so the map could not show them. The Space Elevator's project modules and the Nano Forge do not form in
  a scene built this way.

The Modernity-GTNH look is checked against a real client running Modernity-GTNH and MyCTMLib, like the default look
against the plain client. Connected textures (MyCTMLib sheets and GregTech's MCPatcher glass), hatches joining their
casings, panes and layered Werkstoff blocks were fixed against that client. On the client oracle
{{ n.states.modernity.rate }} of judged block states and {{ n.worlds.modernity.total.rate }} of judged block faces in
{{ n.worlds.modernity.total.scenes }} scene worlds match it ({{ n.worlds.modernity.scenes["gt-multiblocks"].rate }} on
the GregTech multiblocks); the [status page](/status#real-client-oracle) has the numbers per scene.

## Gallery

Screenshots taken from the GregTech multiblocks map with Playwright and software WebGL. Select **Show in the live
map** to fly the map above to the same camera.

<DemoGallery />
