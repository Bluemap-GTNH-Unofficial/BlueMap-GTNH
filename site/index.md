---
layout: home
title: BlueMap GTNH
titleTemplate: Unofficial BlueMap port for GT New Horizons

hero:
  name: BlueMap GTNH
  text: The 3D web map, for GT New Horizons
  tagline: An unofficial port of BlueMap 5.29 to Minecraft 1.7.10 and the GTNH 2.9.0 modpack (2.9.0-RC-2 is tested too). A Forge server mod that reads your world and renders vanilla terrain, GregTech machines and the pack's mods into a browser map.
  image:
    src: /logo.svg
    alt: BlueMap GTNH
  actions:
    - theme: brand
      text: Get started
      link: /guide/
    - theme: alt
      text: Live demo
      link: /showcase
    - theme: alt
      text: Status
      link: /status
    - theme: alt
      text: GitHub
      link: https://github.com/Bluemap-GTNH-Unofficial/BlueMap-GTNH

features:
  - title: Reads 1.7.10 worlds
    details: Anvil regions with EndlessIDs / ChunkAPI extended block IDs and 16-bit metadata, block names from the FML registry. Checked block by block against the live server on 12 scenes, 0 mismatches.
    link: /architecture#world-reading
    linkText: How it reads worlds
  - title: Vanilla blocks, flattened
    details: 1.7.10 IDs and metadata become 1.13 block states, including neighbour-dependent shapes. Compared with a real Minecraft 1.13.2 upgrade over 905,216 positions.
    link: /architecture#vanilla-flattening
    linkText: Flattening
  - title: Modded blocks from your client
    details: A one-shot client mod exports how every block state looks (4,092 blocks, 62,476 states from 138 mods) into a resource pack you build yourself and never redistribute.
    link: /guide/export
    linkText: Export the pack
  - title: GregTech, drawn properly
    details: Dedicated renderers for GregTech machines, pipes, cables, ores and frames, formed multiblocks included, plus Chisel CTM, Iron Chests, AE2 cables and EnderIO conduits.
    link: /status#what-works
    linkText: What works
  - title: Community addons
    details: Twist Space Technology, Programmable Hatches, GT Not Leisure, NH Utilities and the Box++ community fork load, export and render; 123Technology on 2.9.0-RC-2 only.
    link: /guide/addons
    linkText: Addon setup
  - title: Lives in your server
    details: A map per dimension with region files, tiles that update after world saves, online players on the map, and /bluemap commands in game and over RCON. 20 TPS while rendering.
    link: /guide/maps
    linkText: Maps and commands
---

<div class="home-content">

## Status

Release **`v5.29-gtnh.1`** (BlueMap 5.29 plus the port). It supports GTNH 2.9.0 and is verified on 2.9.0 and
2.9.0-RC-2. The numbers below were measured on GTNH 2.9.0-RC-2, on one machine.

<div class="status-grid">
  <div class="stat"><span class="value">0</span><span class="label">mismatches between the world reader and the live server, 12 scenes</span></div>
  <div class="stat"><span class="value">91.53%</span><span class="label">of placed modded states in the <code>gtnh-zoo</code> scene render with their own model</span></div>
  <div class="stat"><span class="value">556 s</span><span class="label">to render 65,536 chunks with 8 threads (941 s with the default 3), at 20 TPS</span></div>
  <div class="stat"><span class="value">118 / 118</span><span class="label">browser screenshot checks pass (regression only, see below)</span></div>
</div>

The screenshot checks compare renders with locally approved renders of the same tool: they catch changes, not wrong
output. A reference check against the real GTNH client is in progress. **Modernity-GTNH support is currently broken**
and being reworked. The full list of gaps is on the [status page](/status).

## Where to go next

- **Server owners:** [requirements](/guide/), [install the mod](/guide/install), [export the resource pack](/guide/export).
- **Curious:** the [live demo](/showcase) shows a plaza of GTNH's end-game machines and GregTech multiblocks in your
  browser; the [architecture](/architecture) page shows how a 1.7.10 world becomes a BlueMap map.
- **Developers:** the [workspace and toolchain](/development/), [builds](/development/building) and
  [tests](/development/testing).

</div>
