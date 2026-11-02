---
aside: false
---

# Demo

A live BlueMap map of two test scenes, rendered by this port, and screenshots taken from it. Drag to rotate, scroll to
zoom, and switch maps with the map button in the top left corner of the map.

- **GTNH block zoo** (`gtnh_zoo`): 16,642 blocks of every mod in the pack on a 2-block grid, ordered by block id.
- **GregTech multiblocks** (`gt_multiblocks`): formed multiblocks of GregTech and its addon mods, one every 48 blocks
  along the x axis, floating at y = 20.

<DemoMap />

> [!NOTE] Test worlds, not a real base
> Both scenes are superflat test worlds that the harness mod built block by block; the black void around them is
> the edge of what was generated. Magenta-and-black cubes are block states the exporter could not capture (see
> [known gaps](/status#known-gaps)). The map and the screenshots contain Minecraft and mod textures, which belong to
> their authors; they are generated locally and never committed.

## Gallery

Screenshots taken from the demo map with Playwright and software WebGL. Select **Show in the live map** to fly the map
above to the same camera.

<DemoGallery />
