# Performance

One measurement on one machine; your numbers will differ.

## Full render of a fresh world

A fresh GTNH 2.9.0 world (Realistic World Gen, seed 1710) with 256 × 256 = **65,536 chunks** pre-generated around
spawn, rendered from empty on the running server with `render-thread-count: 16`:

| | |
|---|---|
| Wall time | **5 min 45 s** (345 s) |
| Server TPS during the render | min **20.0**, median **20.0** (sampled every 10 s) |
| Heap after GC | 3.3–4.1 GB (collections from 97 s on; earlier ones were not logged) |
| Hires tiles | 16,384 |
| Output size | 1.5 GiB (1,537 MiB, gzip file storage) |

Environment: Mac17,8 (Apple M5 Pro), 18 CPU cores (6 performance + 12 efficiency), 64 GB RAM, macOS 26.7.1;
Temurin 25.0.5 with `-Xms6G -Xmx12G` and ZGC; the server mod `5.29-gtnh.1` with the exported 2.9.0 pack. BlueMap
logged no warnings or errors.
