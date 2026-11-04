#!/usr/bin/env bash
# Builds the workspace image and starts the long-lived container `bmgtnh` without VS Code: the checkout bind-mounted at
# /ws, the local state and caches in named volumes (the mounts of devcontainer.json; keep both lists in sync).
# Works with `wslc` (Windows, Git Bash) and `docker`. GTNH clients run on the Windows host (native OpenGL) through the
# launcher's bridge; without it they run here on Xvfb with Mesa llvmpipe. GPU passthrough into the container (Mesa
# d3d12 through WSL's /dev/dxg) was measured 2026-11-03 and dropped: 10x slower state readback than llvmpipe, device
# loss in long runs, run-to-run different captures (site/development/building.md, Container).
#
#   .devcontainer/run.sh                 # build bmgtnh-dev:latest, create the volumes, (re)start bmgtnh
#   wslc exec -it -w /ws bmgtnh bash     # a shell in it (MSYS_NO_PATHCONV=1 in Git Bash)
#   wslc exec -w /ws bmgtnh mise run plan
set -euo pipefail
export MSYS_NO_PATHCONV=1

CLI=${CONTAINER_CLI:-$(command -v wslc || command -v wslc.exe || command -v docker)}
NAME=${CONTAINER_NAME:-bmgtnh}
IMAGE=bmgtnh-dev:latest
here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/.." && pwd)
case "$CLI" in # wslc takes the checkout as a Windows path, from Git Bash and from a WSL shell alike
  *wslc*) if command -v cygpath >/dev/null; then root=$(cygpath -w "$root"); elif command -v wslpath >/dev/null; then root=$(wslpath -w "$root"); fi ;;
esac
echo "container CLI: $CLI"

# Named volumes on the Linux file system for what only the container reads and writes: the servers, regression
# baselines, locks of container tasks, sources, Node modules, the BlueMap side of the oracle and e2e, tool caches.
# BlueMap/common's Node.js download and the webapp's node_modules (about 9,600 files): Gradle cannot watch the bind
# mount, so every BlueMap build re-reads them (:common:nodeSetup and :common:npmInstall up-to-date checks took 25 s of a
# 48 s no-op build on the bind mount; reading those files: 21.4 s there, 0.2 s in the container).
# What the GTNH clients on the Windows host read or write stays on the bind mount (Windows file system): clients/,
# downloads/, worlds-2.9.0/ and out/ (reference captures in out/oracle-ref/, packs in out/exporter*/ and out/modernity/,
# scene dumps in out/scenes-2.9.0/).
volumes=(
  servers:/ws/servers baselines:/ws/baselines-2.9.0 locks:/ws/locks sources:/ws/sources
  oracle:/ws/out/oracle-2.9.0 e2e-out:/ws/out/e2e-2.9.0 e2e-cache:/ws/out/e2e
  site-modules:/ws/site/node_modules webapp-modules:/ws/BlueMap/common/webapp/node_modules
  webapp-node:/ws/BlueMap/common/.gradle gradle:/root/.gradle cache:/root/.cache state:/root/.local/state
)

(cd "$here" && "$CLI" build -t "$IMAGE" .)
args=()
for v in "${volumes[@]}"; do
  "$CLI" volume inspect "bmgtnh-${v%%:*}" >/dev/null 2>&1 || "$CLI" volume create "bmgtnh-${v%%:*}" >/dev/null
  args+=(-v "bmgtnh-${v%%:*}:${v#*:}")
done
# GTNH clients run natively on the Windows host (`gtnh-client serve`, gtnh-exporter/launcher/README.md); the container's
# `gtnh-client` forwards to it. Unset BMGTNH_CLIENT_HOST (BMGTNH_CLIENT_HOST= .devcontainer/run.sh) to run clients in
# the container on Xvfb + llvmpipe instead.
args+=(-e "BMGTNH_CLIENT_HOST=${BMGTNH_CLIENT_HOST-http://host.wslc.internal:8390}")
"$CLI" rm -f "$NAME" >/dev/null 2>&1 || true
"$CLI" run -d --name "$NAME" --shm-size 2G -v "$root:/ws" "${args[@]}" \
  -p 8100-8112:8100-8112 -p 8200-8215:8200-8215 -p 4173:4173 "$IMAGE"
echo "started $NAME; shell: $CLI exec -it -w /ws $NAME bash"
