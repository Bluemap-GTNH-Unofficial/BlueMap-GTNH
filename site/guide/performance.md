# Performance

Measured on one machine (MacBook, Apple silicon, 18 cores, 64 GB) with GTNH 2.9.0-RC-2. Your numbers will differ.

## Full render of a fresh world

The test world is a fresh GTNH world (Realistic World Gen, seed 1710) with 256 × 256 = **65,536 chunks**
pre-generated (82 region files, 647 MB; the pre-generation took 368 s). The whole overworld was rendered on the
running server, with `-Xmx12G`:

| | 3 render threads (default) | 8 render threads |
|---|---|---|
| Time | **941 s** | **556 s** |
| Throughput | about 70 chunks/s | about 118 chunks/s |
| Server TPS / mean tick while rendering | 20 / 0.51 ms | 20 / 0.53 ms |
| Heap after GC | 2.3-2.7 GB | 3.1-5.0 GB |

The render produced 16,129 hires tiles, 1,550.6 MiB.

**Recommendation:** keep the default 3 threads for normal operation. For the first full render of a large world you
can raise `render-thread-count` in `config/bluemap/core.conf` temporarily (8 threads did not affect TPS on our
machine) and lower it again afterwards.

```properties
# config/bluemap/core.conf
render-thread-count: 8
```

## Server start and live updates

| | Measurement |
|---|---|
| Server start without / with the mod | 26-27 s / 26-30 s (within noise) |
| BlueMap loaded after the server is ready | about 1.3 s; about 11 s with the exported resource pack |
| Tile update after a world save | changed tiles re-rendered within 25 s of `save-all` |
| `/bluemap reload` over RCON | replies after at most 1 s, finishes in the background |

## Export

| Step | Time |
|---|---|
| `gtnh-client export` (client start, export, exit) | about 59 s; the export itself about 5 s |
| `prepare --clean` with an empty download cache | 16 s (172.5 MB downloaded) |
| First boot of a freshly unpacked client, to the main menu | about 96 s |
| Later boots | about 33 s |

## Small scenes

The test scenes are small superflat worlds; the CLI renders one in seconds. The two scenes of this site's
[demo](/showcase) (`gt-multiblocks` and `gtnh-zoo`, 562 tiles) render in under 10 s with 16 threads.
