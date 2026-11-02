# Client oracle

> [!NOTE] In progress
> The real-client oracle is being built in the [`e2e`](https://github.com/Bluemap-GTNH-Unofficial/e2e) repository
> (`uv run e2e oracle ...`). This page will describe it once it lands; until then the
> [e2e README](https://github.com/Bluemap-GTNH-Unofficial/e2e#readme) is the source of truth.

## Why it is needed

The browser e2e baselines compare BlueMap with BlueMap: they catch changes, not wrong output. The oracle closes that
gap by comparing the map with what the **real GTNH client** shows for the same scene, so a check fails when the map
differs from the game, not only when it differs from an earlier render.

## What exists today

| Check | Reference | Status |
|---|---|---|
| Reader reconciliation | live server dumps | done: 0 mismatches on 12 scenes |
| Vanilla flattening oracle | Minecraft 1.13.2's own world upgrade | done: all 1,505 of 905,216 positions that differ are deliberate |
| GregTech face selection | GregTech's own texture dump | done: identical face by face |
| Rendered map vs the real client | GTNH client screenshots | **in progress** |

See [tests & scenes](/development/testing) for the checks that run today.
