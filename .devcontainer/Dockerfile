# Workspace image: every build, test, scene, export and oracle step of the pipeline (`mise run ...`) on Linux x64.
# GTNH clients normally run on the Windows host through the launcher's bridge (BMGTNH_CLIENT_HOST); in the container
# they run headless on a private Xvfb display each (the launcher starts it), rendered by Mesa llvmpipe on the CPU.
# Build and run: .devcontainer/run.sh, or VS Code Dev Containers (devcontainer.json).
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    MISE_DATA_DIR=/opt/mise \
    MISE_CACHE_DIR=/opt/mise/cache \
    MISE_TRUSTED_CONFIG_PATHS=/ws \
    MISE_YES=1 \
    UV_LINK_MODE=copy \
    PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright \
    npm_config_store_dir=/root/.cache/pnpm-store \
    PATH=/opt/mise/shims:/root/.local/bin:$PATH

# Tools the pipeline calls, the X11/GL/audio libraries LWJGL 3 and SDL load in a GTNH client, Xvfb with Mesa's
# software GL (llvmpipe), procps for the launcher's memory sampling, tini as PID 1 (reaps the exited Chromium and
# client processes that would otherwise pile up as zombies), libatomic1 for the Node "lts" site/mise.toml selects
# when a command runs inside site/ (Node 26 links it; the global Node 24 does not).
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl git openssh-client gnupg gh unzip zip zstd xz-utils procps less tini \
      xvfb xauth x11-utils mesa-utils libgl1 libegl1 libgl1-mesa-dri libglu1-mesa \
      libx11-6 libxext6 libxrender1 libxtst6 libxi6 libxrandr2 libxcursor1 libxxf86vm1 libxinerama1 libxss1 \
      libasound2t64 libpulse0 fonts-dejavu-core libatomic1 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:0.13.4 /uv /uvx /usr/local/bin/
RUN curl -fsSL https://mise.run | MISE_INSTALL_PATH=/usr/local/bin/mise sh

# Java 25 runs every build, server and client; Java 8 is the GTNHGradle toolchain for the 1.7.10 mods
# (pipeline/gradlew). Python 3.13 for the pipeline scripts (pipeline/check.py), Node and pnpm for the site.
RUN mise use -g java@temurin-25.0.5+8.0.LTS java@zulu-8.98.0.107 python@3.13 node@24 pnpm@12 \
    && mise reshim \
    && java -version && python3 --version && node --version && pnpm --version

# Chromium for the Playwright version e2e (uv.lock) and the site (package.json) pin, with its system libraries.
RUN uvx --from playwright==1.64.1 playwright install --with-deps chromium && rm -rf /var/lib/apt/lists/*

# The workspace is a Windows bind mount: its owner differs from root.
RUN git config --system safe.directory '*'

WORKDIR /ws
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sleep", "infinity"]
