# Client oracle

The browser e2e baselines compare BlueMap with BlueMap: they catch changes, not wrong output. The oracle compares the
map with what the **real GTNH client** draws, so a check fails when the map differs from the game, not only when it
differs from an earlier render. It lives in the [`e2e`](https://github.com/Bluemap-GTNH-Unofficial/e2e) repository
(`uv run e2e oracle ...`); its README documents every step in detail. All results on this page were measured on
GTNH 2.9.0; the current numbers per scene are on the [status page](/status#real-client-oracle).

## Two oracles

| | `e2e oracle states` | `e2e oracle world` |
|---|---|---|
| Reference | the real client draws every block state alone, in a single-block world, into an offscreen framebuffer (`gtnh-client states`) | screenshots of the real client in the scene worlds, at cameras taken from the e2e views (`gtnh-client cameras`) |
| BlueMap side | the same state in a synthetic chunk, read by the real 1.7.10 chunk loader, rendered by every BlueMap render pass and rasterised in software | BlueMap's web app in headless Chromium, its camera set to the client's eye and projection matrix |
| Unit judged | two views (from the south-east and north-west) and each block face in them | every visible face of every block in the scene's dump |
| Covers | 62,659 states on 2.9.0: 1,191 vanilla states and every state the exporter knows, GregTech machines included | neighbour-dependent looks (connected textures, pipes, cables, formed multiblocks, stairs, fences) and the web app's own shaders |

Both sides draw under the same conditions: full brightness, no ambient occlusion, Minecraft's flat face shade, no
fog, animated textures at their first frame and no mipmaps. Each region (a view, or one face) is compared with three
metrics: coverage IoU with one pixel of edge tolerance, the mean CIEDE2000 colour difference (ΔE) over pixels both
draw, and the SSIM of the luminance. A state or face passes when every region passes all three.

The world oracle first checks that the two renderings line up (global shift at most 1 px, block-edge reprojection
error median at most 1 px and 90th percentile at most 2 px); faces of a view that fails this are reported but not
judged. Faces hidden by something nearer in the other rendering are not compared, and the colour behind translucent
blocks (glass, ice, water) is judged as its own face.

```sh
cd e2e
uv run e2e oracle states --variant default                # client reference (cached) + BlueMap side, comparison, report
uv run e2e oracle world --variant default --variant modernity --all   # every scene of both variants
uv run e2e oracle world --variant modernity --scene gtnh-zoo --recapture
uv run e2e oracle swap-test                               # detection power of the state thresholds
uv run e2e oracle world-swap-test                         # the same for the world thresholds
```

The client's reference captures are cached by content: the key covers the pack version, the client's mods, resource
packs and the capture settings, the scene's blocks and tile entities, and the cameras (state oracle: the state
list). A run only launches the client for scenes whose key has no capture yet, all of them in one launcher run per
variant; otherwise only the BlueMap side runs. The thresholds are stored with the reference keys they were calibrated
on and reused until those change. Details are in the e2e README ("Reference cache").

Variants: `default` (the exported pack), `modernity` (the Modernity-GTNH packs, against a client running Modernity
and MyCTMLib) and `addons` (the addon export, against a client with the five community addons). Every run writes
`report.json` and a `report.html` with client, BlueMap and difference images per state or face, pass rates per mod
and a first guess at each failure's cause, under `out/oracle-2.9.0/<variant>/`. These outputs contain Minecraft and
mod textures and are never committed.

## Calibration

The pass thresholds are not tuned by hand. BlueMap draws vanilla blocks from the 1.13 client jar, so the oracle
picks, from data, the vanilla states that look the same in 1.7.10 and 1.13: every texture pixel-identical, no random
offset or rotation, a consistent state mapping and no more geometric difference than a plain full cube. On those
states the two renderings should agree, and whatever differences remain are what two correct rasterisers produce. The
thresholds are Tukey's far-out fences (k = 3) over the samples that are not exactly equal. The world oracle calibrates
the same way on the faces of the `vanilla-zoo` scene.

Thresholds on GTNH 2.9.0 (state oracle: regions under 32 pixels are not judged; world oracle: faces under 64 pixels
are not judged):

| Region | IoU at least | ΔE at most | SSIM at least |
|---|---|---|---|
| state oracle, whole view | 1.0 | 1.465 | 0.9913 |
| state oracle, one face | 0.9753 | 2.894 | 0.9867 |
| world oracle, one block face | 1.0 | 2.337 | 0.9323 |

Vanilla states that differ because 1.13 itself differs from 1.7.10 (a changed texture, the random stone rotation, a
state the flattening drops) are listed in `oracle/accepted.yaml` with the reason and reported as `accepted (1.13)`,
neither pass nor failure, and only where the data backs that reason.

## How much it can be trusted

A threshold that passes everything proves nothing, and one that fails correct renders is noise. Two measurements
keep both in check:

- **Detection (swap tests).** `swap-test` and `world-swap-test` judge renders that are known to be wrong: the default
  client's renders against the Modernity client's renders of the same states or cameras, and BlueMap with one look
  against the client with the other. Every compared state or face looks different in the reference, so the share
  flagged is the detection rate.
- **False failures.** The calibration states and faces look the same in both versions, so every one of them that
  fails is a false failure; so is a face the swap test fails although the two clients draw it alike.

Results on 2.9.0:

<ResultsTable name="oracle-trust" />

So a failure is almost always a real difference from the client, while the world oracle can miss small colour
differences. These rates describe the thresholds, not BlueMap: how much of BlueMap passes is on the
[status page](/status#real-client-oracle).

The oracle compares against the client only where the client renders reliably: states the client draws nothing for
in isolation, or whose client render throws, are listed separately and not judged.

## Other reference checks

| Check | Reference | Result |
|---|---|---|
| Reader reconciliation | live server dumps | 0 mismatches on 12 scenes built on 2.9.0 |
| Vanilla flattening oracle | Minecraft 1.13.2's own upgrade of a vanilla 1.7.10 world | all 1,505 of 905,216 positions that differ are deliberate |

See [tests & scenes](/development/testing) for how the scenes are built.
