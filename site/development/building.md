# Building

All Java builds run with Java 25 from mise. The three Forge mods (server mod, exporter, harness) also need the Java 8
toolchain, passed to Gradle as an extra installation path. The first build of each Forge mod decompiles Minecraft and
takes about 12 minutes; later builds take seconds.

## Forge mods

::: code-group

```sh [server mod]
cd BlueMap/implementations/gtnh
mise exec java@temurin-25.0.5+8.0.LTS -- ./gradlew \
  -Porg.gradle.java.installations.paths=$(mise where java@zulu-8.98.0.107)/Contents/Home,$(mise where java@temurin-25.0.5+8.0.LTS)/Contents/Home \
  build
# -> build/libs/bluemap-<version>.jar (reobfuscated, the one to install)
```

```sh [exporter]
cd gtnh-exporter
mise exec java@temurin-25.0.5+8.0.LTS -- ./gradlew \
  -Porg.gradle.java.installations.paths=$(mise where java@zulu-8.98.0.107)/Contents/Home,$(mise where java@temurin-25.0.5+8.0.LTS)/Contents/Home \
  build
# -> build/libs/bluemap-gtnh-exporter-<version>.jar
```

```sh [harness]
cd harness
mise exec java@temurin-25.0.5+8.0.LTS -- ./gradlew \
  -Porg.gradle.java.installations.paths=$(mise where java@zulu-8.98.0.107)/Contents/Home,$(mise where java@temurin-25.0.5+8.0.LTS)/Contents/Home \
  build
# -> build/libs/bmh-<version>.jar
```

:::

- The server mod pulls BlueMap's `:common`, `:legacy` and `:gtnh-render` from the enclosing BlueMap build through a
  composite build (`includeBuild("../..")`). The webapp has to be built in the BlueMap build (`:common:buildWebapp`,
  which runs automatically unless excluded).
- The exporter compiles the reader's `legacy/.../ResourceKeys.kt` from the sibling `BlueMap/` checkout verbatim and
  fails without it.
- Versions: `<bluemapUpstreamVersion>-gtnh.<gtnhRevision>` from BlueMap's root `gradle.properties` (for example
  `5.29-gtnh.2`), shared by the mod jar, `mcmod.info` and BlueMap itself.

## BlueMap: CLI and addon jars

The `e2e` suite and the site demo render with the BlueMap CLI plus the `legacy` and `gtnh-render` addon jars:

```sh
cd BlueMap
mise exec -- ./gradlew :cli:shadowJar :legacy:addonJar :gtnh-render:addonJar
# -> implementations/cli/build/libs/cli-<version>-shadow.jar
# -> legacy/build/libs/legacy-<version>-addon.jar, gtnh-render/build/libs/gtnh-render-<version>-addon.jar
```

> [!WARNING] Keep the webapp in the CLI jar
> Building with `-x :common:buildWebapp` produces a CLI that fails with "Failed to open bundled webapp". `e2e` and
> `pnpm demo` refuse such a jar.

## Python tools

```sh
cd gtnh-exporter/launcher && uv run gtnh-client --help
cd orchestrator && uv run orch --help
cd e2e && uv sync --group dev && uv run playwright install chromium
cd modernity && uv sync --group dev
```

## This site

::: code-group

```sh [develop]
cd site
pnpm install
pnpm dev            # http://localhost:5173/BlueMap-GTNH/
```

```sh [build and preview]
cd site
pnpm build          # -> .vitepress/dist
pnpm preview        # static server on http://localhost:4173/BlueMap-GTNH/
```

```sh [root base path]
cd site
SITE_BASE=/ pnpm build    # for hosting at the root of a domain
```

:::

The optional local demo map and screenshot gallery are built with `pnpm demo`; see
[tests & scenes](/development/testing#site-demo).
