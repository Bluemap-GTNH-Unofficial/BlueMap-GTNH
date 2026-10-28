# Third-party notices

This project is an unofficial port. It is not affiliated with, endorsed by or supported by the BlueMap project,
the GT New Horizons team, Mojang or Microsoft, or the authors of any mod named here. All names and trademarks
belong to their owners.

## Licence summary

Everything in this repository and its submodules is MIT ([LICENSE](LICENSE)), with these exceptions and credits:

- **LGPL-3.0:** `MultiEssentiaJar.layers()` and the beam pitch/yaw lines of `BeamFormer.beam()` in
  `BlueMap/gtnh-render/.../mods/addons/GtnlTesrs.kt` are adapted from GT: Not Leisure and remain available under
  the LGPL-3.0 (see [GT: Not Leisure](#gt-not-leisure-lgpl-30-parts)).
- **MIT, other copyright holder:** `MyCtm.indices()` is adapted from MyCTMLib; its notice is reproduced in
  [MyCTMLib licence](#myctmlib-licence).
- **Mojang:** a few functions re-implement Minecraft behaviour in Kotlin and are credited below.
- The BlueMap fork keeps BlueMap's upstream copyright. The server mod jar shades libraries under their own licences.

## Code adapted from other projects

Bare file names are renderer files under `BlueMap/gtnh-render/src/main/kotlin/de/bluecolored/bluemap/gtnh/render/mods/`
or, for `Vanilla*.kt`, files in `BlueMap/legacy/src/main/kotlin/de/bluecolored/bluemap/gtnh/legacy/`.

| Source | Copyright / author | Licence | What we used | Where |
|---|---|---|---|---|
| [BlueMap](https://github.com/BlueMap-Minecraft/BlueMap) 5.29 | Copyright (c) Blue (Lukas Rieger) and contributors | MIT | Code: the `BlueMap` submodule is a fork. Upstream copyright and licence are kept in `BlueMap/LICENSE` and in every source header. | `BlueMap/` |
| [GT: Not Leisure](https://github.com/ABKQPO/GT-Not-Leisure) (GTNL) 0.2.7-rc2 | HFstudio, ABKQPO and contributors (per its `mcmod.info` and repository) | LGPL-3.0 (its `LICENSE.txt` at tag 0.2.7-rc2) | Code adapted: the liquid layer split of `MultiEssentiaJarRenderer` and the beam pitch/yaw formulas of `BeamFormerRenderHelper`. Other GTNL facts used (model names, NBT keys, sizes) are data. | `GtnlTesrs.kt`: `MultiEssentiaJar.layers()`, `BeamFormer.beam()` |
| [MyCTMLib](https://github.com/ABKQPO/MyCTMLib) | Copyright (c) 2024 初夏同学 | MIT | Code adapted: `MyCtm.indices()` is adapted from `Textures.buildConnect`. The `.mcmeta` `myctmlib` section format is read as data. | `BlueMap/gtnh-render/.../mods/ctm/MyCtm.kt`; `gtnh-exporter` `TextureExporter.recordCtm` (format only) |
| Minecraft 1.7.10 and 1.13 | Minecraft (c) Mojang AB / Microsoft | All rights reserved | Behaviour re-implemented in Kotlin, closely following the vanilla logic: the `ModelBox` box builder, the 1.13 stairs shape and redstone wire side rules, and 1.13 block face shapes. Credited to Mojang. | `EntityModel.box()`; `VanillaFixers.kt` `stairsShape()`, `redstoneWire()`; `VanillaBlockShapes.kt` |
| [Applied Energistics 2 Unofficial](https://github.com/GTNewHorizons/Applied-Energistics-2-Unofficial) API (`AEColor`) | Copyright (c) 2013 AlgorithmX2 | MIT | Data: the 17 cable colours (dark, medium and bright variants). | `Ae2CableBusRenderer.kt` `AE_COLORS`, `GtnlTesrs.kt` `BeamFormer.COLORS` |
| [GTNewHorizons/ExampleMod1.7.10](https://github.com/GTNewHorizons/ExampleMod1.7.10) | Copyright (c) 2021 Johann Bernhardt | MIT | Template: build layout of the three Forge mods (`gradle.properties` keys, `settings.gradle.kts`, `.gitignore`). Its notice is in those repositories' `LICENSE` files. | `gtnh-exporter`, `harness`, `BlueMap/implementations/gtnh` |
| [Gradle wrapper](https://github.com/gradle/gradle) | Copyright the original authors (Gradle) | Apache-2.0 | Code, unchanged: `gradlew`, `gradlew.bat`, `gradle/wrapper/` with their original headers. | all Gradle projects |
| [PrismarineJS/minecraft-data](https://github.com/PrismarineJS/minecraft-data) `legacy.json` | PrismarineJS contributors | MIT | Data: input of the generated vanilla flattening table (pinned commit, see `gen_flattening_table.py`). | `BlueMap/legacy/.../flattening_1_7_10.tsv` |
| [agentdid127/ResourcePackConverter](https://github.com/agentdid127/ResourcePackConverter) `blocks.json` | Copyright (c) 2024 agentdid127 | MIT | Data: 212 texture renames (pinned commit, see `modernity/README.md`). | `modernity/data/renames-1.7.10-to-1.13.json` |

### GT: Not Leisure (LGPL-3.0 parts)

`MultiEssentiaJar.layers()` in `GtnlTesrs.kt` is adapted from GTNL's `MultiEssentiaJarRenderer`, and the two
pitch/yaw lines of `BeamFormer.beam()` from GTNL's `BeamFormerRenderHelper` (GTNL 0.2.7-rc2, licensed LGPL-3.0 at that
tag; later GTNL releases moved to GPL-3.0). These parts remain available under the
[GNU Lesser General Public License v3.0](https://www.gnu.org/licenses/lgpl-3.0.html): you may use, change and
redistribute them under its terms. Their source is the file itself. The rest of `GtnlTesrs.kt` is MIT.

### MyCTMLib licence

`MyCtm.indices()` is adapted from `Textures.buildConnect` of MyCTMLib, which carries this notice:

```text
MIT License

Copyright (c) 2024 初夏同学

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Mods used as references

The renderers in `BlueMap/gtnh-render` draw these mods' blocks from the mods' own textures and models, which are read
at run time from the user's installed jars. To draw them the same way, we studied each mod and reused the facts its
blocks need: texture-sheet layouts, model and texture names, NBT keys, metadata bit layouts, box coordinates and
placement numbers. Apart from the code listed above, the implementations are our own. No textures, models or language
files of these mods are committed. `mods/` and `gregtech/` are under
`BlueMap/gtnh-render/src/main/kotlin/de/bluecolored/bluemap/gtnh/render/`.

| Mod | Copyright / author | Licence | What we used | Where |
|---|---|---|---|---|
| [Chisel](https://github.com/GTNewHorizons/Chisel) (GTNH) | tterrag, Drullkus, minecreatr and contributors | GPL-2.0 | Texture layouts followed: the CTM sheet quadrants and the column, horizontal and vertical layouts, and how variants are picked. Implementation written independently from a description of the behaviour. | `mods/chisel/` |
| [Applied Energistics 2 Unofficial](https://github.com/GTNewHorizons/Applied-Energistics-2-Unofficial) | Copyright (c) 2013-2015 AlgorithmX2 and GTNH contributors | LGPL-3.0 (code) | Geometry facts: about 25 cable-bus part boxes, and how cables connect. | `mods/ae2/` |
| [BiblioCraft](http://www.bibliocraftmod.com) 1.11.7 (closed source) | Joseph "Nuchaz" Sinclair | All rights reserved | Placement data needed to draw BiblioCraft's own OBJ models: rotation and shift tables, label positions, NBT keys and tile-entity ids. | `mods/bibliocraft/` |
| [Iron Chests](https://github.com/GTNewHorizons/ironchest) (GTNH) | cpw; GTNH fork Copyright (c) 2016-2021 Alkalus | GPL-3.0 | Behaviour reference: chest model placement and the chest type table. | `mods/ironchest/` |
| [EnderIO](https://github.com/GTNewHorizons/EnderIO) (GTNH) | CrazyPants, tterrag and contributors | Original code Unlicense (public domain); GTNH changes LGPL-3.0 | Geometry facts: the conduit offset table and conduit box sizes. | `mods/enderio/` |
| [GT5-Unofficial](https://github.com/GTNewHorizons/GT5-Unofficial) | GregoriusT, GTNH team and contributors | LGPL-3.0 | Behaviour reference: texture flipping, pipe and machine metadata, ore blocks. The exporter and harness compile against it (see below). | `gregtech/`, `mods/addons/GtLaserBeacon.kt`; `gtnh-exporter` `exporter/gt/`; `harness` `GtCompat.kt` |
| [Twist Space Technology](https://github.com/Nxer/Twist-Space-Technology-Mod) (TST) | Nxer and contributors | GPL-3.0 | Behaviour reference: TESR placement and sizes. | `mods/addons/TstTesrs.kt`, `mods/addons/GtLaserBeacon.kt` |
| [Box++](https://github.com/luomolhx/BoxPlusPlus) (luomolhx fork) | SilverMoon, luomolhx and contributors | LGPL-3.0 | Behaviour reference: the ring renderer. | `mods/addons/BoxTesrs.kt` |
| [123Technology](https://github.com/CallmeSHaobe/123Technology) | NewMaa, CallmeSHaobe and contributors | GPL-3.0 | Behaviour reference: rocket, assembler and figure renderers. | `mods/addons/OthTesrs.kt` |
| [GTNH-Web-Map](https://github.com/GTNewHorizons/GTNH-Web-Map) (Dynmap fork) | GTNH team and Dynmap contributors | Apache-2.0 | Interoperability reference: 1.7.10 chunk and biome NBT layout. | `BlueMap/legacy` `LegacyChunkLoader.kt`, `Chunk_1_7.kt`, `LegacyBiomeMapper.kt` |
| [Hodgepodge](https://github.com/GTNewHorizons/Hodgepodge) | mitchej123 and the GTNH team | LGPL-3.0 | Behaviour reference: RCON threading and chunk generation throttling. `harness` looks up its scheduler by reflection. | `BlueMap/implementations/gtnh` `CommandWait.kt`, `GtnhWorld.kt`; `harness` `ServerThread.kt`, `WorldOps.kt` |
| [GTNHLib](https://github.com/GTNewHorizons/GTNHLib) | mitchej123 and the GTNH team | LGPL-3.0 | Behaviour reference for running tasks on the server thread; the exporter compiles against it (see below). | `harness` `ServerThread.kt`; `gtnh-exporter` `BlockExporter.kt` (quad capture) |
| [StructureLib](https://github.com/GTNewHorizons/StructureLib) | glee8e and the TecTech authors | LGPL-3.0 | Data: the `Rotation` and `Flip` ordinals of GregTech multiblock facings. `harness` compiles against it for multiblock auto-construction (see below). | `gregtech/GtGeometry.kt`, `gregtech/GtTileEntity.kt`; `harness` `GtCompat.kt` |
| [Prism Launcher](https://github.com/PrismLauncher/PrismLauncher) | Prism Launcher contributors | GPL-3.0 | Behaviour reference: the client launcher re-implements in Python the instance format rules it names (library rules, natives, class path order). | `gtnh-exporter/launcher/src/gtnh_client/profile.py` |

Supported addons that are only rendered from the exported pack, with no code or data taken from their sources:
[NH Utilities](https://github.com/Keriils/NH-Utilities) (GPL-3.0) and
[Programmable Hatches](https://github.com/reobf/Programmable-Hatches-Mod) (MIT, Copyright (c) 2024 reobf).

Cross-checks against [ViaVersion/Mappings](https://github.com/ViaVersion/Mappings) and PaperMC DataConverter were
informational only; nothing was copied from them.

## Libraries in the server mod jar

`bluemap-<version>-gtnh.<n>.jar` shades BlueMap's libraries, relocated under `de.bluecolored.shadow`. Each keeps its
own licence.

| Library | Version | Copyright / author | Licence |
|---|---|---|---|
| [Caffeine](https://github.com/ben-manes/caffeine) | 3.3.1 | Ben Manes | Apache-2.0 |
| [Configurate](https://github.com/SpongePowered/Configurate) (core, HOCON, Gson), with [Typesafe Config](https://github.com/lightbend/config) (Lightbend) embedded in Configurate HOCON | 4.2.0 | SpongePowered | Apache-2.0 |
| [GeAnTyRef](https://github.com/leangen/geantyref) | 1.3.16 | leangen | Apache-2.0 |
| [Adventure](https://github.com/KyoriPowered/adventure) (api, key), [examination](https://github.com/KyoriPowered/examination), [option](https://github.com/KyoriPowered/option) | 4.26.1, 1.3.0, 1.1.0 | KyoriPowered | MIT |
| [Gson](https://github.com/google/gson) | 2.8.9 | Google | Apache-2.0 |
| [Apache Commons DBCP 2](https://commons.apache.org/proper/commons-dbcp/), [Pool 2](https://commons.apache.org/proper/commons-pool/), [Logging](https://commons.apache.org/proper/commons-logging/) | 2.14.0, 2.13.0, 1.3.5 | The Apache Software Foundation | Apache-2.0 |
| [aircompressor](https://github.com/airlift/aircompressor) | 2.0.3 | airlift | Apache-2.0 |
| [lz4-java](https://github.com/yawkat/lz4-java) (with native libraries) | 1.10.1 | the lz4-java authors | Apache-2.0 |
| [Error Prone annotations](https://github.com/google/error-prone) | 2.50.0 | Google | Apache-2.0 |
| [flow-math](https://github.com/SpongePowered/math) | 1.0.3 | Flow Powered | MIT |
| [BlueNBT](https://github.com/BlueMap-Minecraft/BlueNBT) | 3.5.1 | Copyright (c) Blue | MIT |
| [BlueCommands](https://github.com/TBlueF/BlueCommands) | 1.3.4 | Blue | MIT |

BlueMap's web app (`webapp.zip` in the jar) bundles [three.js](https://github.com/mrdoob/three.js),
[Vue](https://github.com/vuejs/core), [vue-i18n](https://github.com/intlify/vue-i18n) and
[hammer.js](https://github.com/hammerjs/hammer.js) (all MIT), [hocon-parser](https://www.npmjs.com/package/hocon-parser)
(ISC) and the [Quicksand](https://github.com/andrew-paglinawan/QuicksandFamily) font (Copyright 2011 The Quicksand
Project Authors, SIL Open Font License 1.1), as upstream BlueMap does.

The Kotlin runtime is not shaded; Forgelin provides it in the pack.

## Things the mods are compiled against (not redistributed)

The Forge mods are built against these libraries and call them at run time inside the GT New Horizons pack. None of
them is included in any jar this project publishes; the pack provides them.

| Library | Licence | Used by |
|---|---|---|
| Minecraft 1.7.10 and Minecraft Forge | Mojang EULA / Forge licence | all three mods |
| [Forgelin](https://github.com/GTNewHorizons/Forgelin) (Kotlin runtime) | LGPL-3.0 | all three mods |
| [GT5-Unofficial](https://github.com/GTNewHorizons/GT5-Unofficial) (GregTech) | LGPL-3.0 | `gtnh-exporter` (GregTech dump), `harness` (machine placement) |
| [GTNHLib](https://github.com/GTNewHorizons/GTNHLib) | LGPL-3.0 | `gtnh-exporter` (quad capture); `harness` development runs (needed by GT5-Unofficial) |
| [StructureLib](https://github.com/GTNewHorizons/StructureLib) | LGPL-3.0 | `harness` (multiblock auto-construction in test scenes) |
| [EndlessIDs](https://github.com/FalsePattern/EndlessIDs), [ChunkAPI](https://github.com/FalsePattern/ChunkAPI) | see their repositories | development runs only |
| [GTNHGradle](https://github.com/GTNewHorizons/GTNHGradle), [lwjgl3ify](https://github.com/GTNewHorizons/lwjgl3ify) | LGPL-2.1 / LGPL-3.0 | build tooling / Java 25 runtime of the pack |

The world reader and the renderers do not link any mod. They read world files and the data the exporter writes.

## Minecraft, mods and textures

- Minecraft is a trademark of Mojang Synergies AB / Microsoft. Minecraft assets are Mojang's. BlueMap downloads the
  vanilla client jar from Mojang on the server only after the operator sets `accept-download: true`, which means
  accepting the [Minecraft EULA](https://www.minecraft.net/eula).
- Mod names, block names and textures belong to their respective authors and are under those mods' own licences.
- **Release assets never include an exported resource pack.** The exporter builds the pack on the user's own machine
  from the user's own copy of the pack, because the result contains other authors' textures.
- [Modernity-GTNH](https://github.com/ModernityGTNH/Modernity-GTNH) is licensed CC BY-NC-SA 4.0. Its files are never
  committed or redistributed here. The `modernity` tool only converts a release the user downloaded, and the packs it
  writes carry a licence notice: non-commercial use only, share alike.
- The screenshots in `docs/images/` and the approved e2e baselines in `e2e/baselines/` are renders of test worlds.
  They contain textures from Minecraft, from GT New Horizons mods and, in the Modernity comparison, from
  Modernity-GTNH. They are shown only to demonstrate and test the renderer, and remain the property of their
  authors.
