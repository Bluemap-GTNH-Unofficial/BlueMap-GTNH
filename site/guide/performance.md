# Performance

Measured on one machine (MacBook, Apple silicon, 18 cores, 64 GB) with GTNH 2.9.0. Your numbers will differ.

## Full render of a fresh world

Not yet re-measured on 2.9.0. The test world is a fresh GTNH world (Realistic World Gen, seed 1710) with
256 × 256 = **65,536 chunks** pre-generated. The whole overworld is rendered on the running server, with `-Xmx12G`,
once with the default 3 render threads and once with 8, recording time, throughput, server TPS and mean tick time,
and heap after GC.

**Recommendation:** keep the default 3 threads for normal operation. For the first full render of a large world you
can raise `render-thread-count` in `config/bluemap/core.conf` temporarily and lower it again afterwards; watch the
server's TPS while it renders.

```properties
# config/bluemap/core.conf
render-thread-count: 8
```

## Server start

| | Measurement |
|---|---|
| BlueMap loaded after the server is ready | about 10 s on the server with the [community addons](/guide/addons) and their exported pack |
| `/bluemap reload` over RCON | replies after at most 1 s, finishes in the background |

## Export

| Step | Measurement |
|---|---|
| `gtnh-client export` (client start, export, exit) | about 51 s; the export itself about 5 s |
| `prepare --clean` with an empty download cache | 172.5 MB of libraries and assets to download |
| Later boots of the client, to the main menu | about 31-44 s |

## Small scenes

The test scenes are small superflat worlds; the CLI renders one in seconds. The three maps of this site's
[demo](/showcase) (the 305 × 456-block end-game plaza with Modernity-GTNH and with default textures, and
`gt-multiblocks` with Modernity-GTNH; 1,120 tiles) render in about 19 s with 16 threads, in two CLI runs of 10.7 s and
7.8 s.
