// Packs the locally built demo (`public/demo/` and `public/generated/`, from `pnpm demo`) into one archive with a
// manifest, for a `demo-*` pre-release of the umbrella repository that the Pages workflow deploys with the site. The
// demo contains Minecraft, mod and Modernity-GTNH textures, so it is never committed; release assets are its only copy.
//
//   pnpm demo:bundle                                  out/site-demo-bundle/{bluemap-gtnh-demo.tar.zst,demo-manifest.json}
//   pnpm demo:publish --tag demo-20261102             print the `gh release create` command for that bundle
//   pnpm demo:publish --tag demo-20261102 --yes       run it (personal gh profile, GH_CONFIG_DIR=~/.config/gh-personal)
//
// Needs `tar` and `zstd`. Environment: BMGTNH_WORKSPACE (default: the parent of site/).

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WS = path.resolve(process.env.BMGTNH_WORKSPACE ?? path.join(SITE, ".."));
const PUBLIC = path.join(SITE, "public");
const DIRS = ["demo", "generated"];
const OUT = path.join(WS, "out", "site-demo-bundle");
const ARCHIVE = "bluemap-gtnh-demo.tar.zst";
const MANIFEST = "demo-manifest.json";
const NOTES = "release-notes.md";
const REPO = "Bluemap-GTNH-Unofficial/BlueMap-GTNH";
const GH_CONFIG = "~/.config/gh-personal";
const PACK_VERSION = "2.9.0"; // build-demo.ts renders the scenes of this GTNH pack version

const { values: args } = parseArgs({
  options: { publish: { type: "boolean" }, tag: { type: "string" }, yes: { type: "boolean" } },
});

function fail(message: string): never {
  console.error(`demo-bundle: ${message}`);
  process.exit(1);
}

function run(cmd: string, argv: string[], cwd = WS): string {
  const r = spawnSync(cmd, argv, { cwd, encoding: "utf8", env: { ...process.env, COPYFILE_DISABLE: "1" } });
  if (r.status !== 0) fail(`${cmd} ${argv.join(" ")} failed: ${r.stderr || r.error}`);
  return r.stdout.trim();
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : e.name === ".DS_Store" || e.name.startsWith("._") ? [] : [p];
  });
}

function sha256(file: string): string {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

const newest = (dir: string, re: RegExp): string | null =>
  fs.existsSync(dir) ? (fs.readdirSync(dir).filter((n) => re.test(n)).sort().at(-1) ?? null) : null;

function provenance(): Record<string, unknown> {
  const settings = JSON.parse(fs.readFileSync(path.join(PUBLIC, "demo", "settings.json"), "utf8"));
  const gallery = path.join(PUBLIC, "generated", "gallery.json");
  const sw = fs.readFileSync(path.join(PUBLIC, "demo", "demo-sw.js"), "utf8");
  const maps = (settings.maps as string[]).map((id) => {
    const cut = id.lastIndexOf("_");
    return { id, scene: id.slice(0, cut).replaceAll("_", "-"), texture: id.slice(cut + 1) };
  });
  // source versions at bundle time: the scenes come from orchestrator + harness, the renderer from BlueMap
  const commit = (dir: string): string | null => {
    const r = spawnSync("git", ["-C", path.join(WS, dir), "rev-parse", "--short=12", "HEAD"], { encoding: "utf8" });
    return r.status === 0 ? r.stdout.trim() : null;
  };
  return {
    rendered: /\(build ([^)]+)\)/.exec(sw)?.[1] ?? null,
    gallery: fs.existsSync(gallery) ? JSON.parse(fs.readFileSync(gallery, "utf8")).generated : null,
    bluemap: settings.version,
    gtnhPack: PACK_VERSION,
    resourcePacks: {
      default: `bluemap-gtnh-resources-${PACK_VERSION}.zip`,
      modernity: [
        newest(path.join(WS, "out", "modernity"), new RegExp(`^modernity-.*-modded-${PACK_VERSION.replaceAll(".", "\\.")}\\.zip$`)),
        newest(path.join(WS, "out", "modernity"), /^modernity-.*-vanilla-1\.13\.zip$/),
      ],
    },
    maps,
    commits: Object.fromEntries(["", "BlueMap", "orchestrator", "harness", "modernity"].map((d) => [d || "umbrella", commit(d)])),
  };
}

function bundle(): void {
  for (const dir of DIRS) {
    if (!fs.existsSync(path.join(PUBLIC, dir))) fail(`public/${dir} missing; run \`pnpm demo\` first`);
  }
  const files = DIRS.flatMap((d) => walk(path.join(PUBLIC, d))).map((f) => path.relative(PUBLIC, f).split(path.sep).join("/")).sort();
  const bytes = files.reduce((sum, f) => sum + fs.statSync(path.join(PUBLIC, f)).size, 0);
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const list = path.join(os.tmpdir(), `demo-files-${process.pid}.txt`);
  fs.writeFileSync(list, files.join("\n") + "\n");
  const tar = path.join(OUT, "bluemap-gtnh-demo.tar");
  // tiles are gzip files and the screenshots JPEGs already, so a fast zstd level loses almost nothing
  run("tar", ["-cf", tar, "--no-xattrs", "-C", PUBLIC, "-T", list]);
  run("zstd", ["-q", "-10", "-T0", "--rm", "-o", path.join(OUT, ARCHIVE), tar]);
  fs.rmSync(list);
  const archive = path.join(OUT, ARCHIVE);
  const manifest = {
    format: 1,
    archive: { name: ARCHIVE, bytes: fs.statSync(archive).size, sha256: sha256(archive) },
    contents: {
      files: files.length,
      bytes,
      dirs: Object.fromEntries(
        DIRS.map((d) => {
          const own = files.filter((f) => f.startsWith(`${d}/`));
          return [d, { files: own.length, bytes: own.reduce((s, f) => s + fs.statSync(path.join(PUBLIC, f)).size, 0) }];
        }),
      ),
    },
    bundled: new Date().toISOString(),
    ...provenance(),
  };
  fs.writeFileSync(path.join(OUT, MANIFEST), JSON.stringify(manifest, null, 2) + "\n");
  const mib = (n: number): string => `${(n / 1024 / 1024).toFixed(1)} MiB`;
  console.log(`demo-bundle: ${files.length} files, ${mib(bytes)} -> ${path.relative(WS, archive)} ${mib(manifest.archive.bytes)}`);
  console.log(`demo-bundle: sha256 ${manifest.archive.sha256}`);
}

function publish(): void {
  const tag = args.tag ?? fail("--tag demo-<yyyymmdd>[-<n>] is required");
  // a numeric suffix allows a second demo on the same day; the workflow picks the newest by publish date
  if (!/^demo-\d{8}(-\d+)?$/.test(tag)) fail(`tag must look like demo-<yyyymmdd>[-<n>], got ${tag}`);
  const manifestFile = path.join(OUT, MANIFEST);
  const archive = path.join(OUT, ARCHIVE);
  if (!fs.existsSync(manifestFile) || !fs.existsSync(archive)) fail("no bundle; run `pnpm demo:bundle` first");
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  if (sha256(archive) !== manifest.archive.sha256) fail("archive does not match its manifest; run `pnpm demo:bundle` again");
  const day = `${tag.slice(5, 9)}-${tag.slice(9, 11)}-${tag.slice(11, 13)}`;
  fs.writeFileSync(
    path.join(OUT, NOTES),
    `Pre-rendered BlueMap demo for the project site (not a software release): ${manifest.contents.files} files, ` +
      `maps ${manifest.maps.map((m: { id: string }) => `\`${m.id}\``).join(", ")}. The Pages workflow deploys the newest ` +
      "`demo-*` release with the site.\n\n" +
      "The tiles and screenshots show textures from Minecraft (Mojang), the GT New Horizons mods and " +
      "[Modernity-GTNH](https://github.com/ModernityGTNH/Modernity-GTNH) " +
      "([CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/); rendered into map tiles and " +
      "screenshots, which are shared under the same licence). Non-commercial. Rights holders who want something " +
      `removed: [open a takedown issue](https://github.com/${REPO}/issues/new?template=takedown.yml).\n`,
  );
  const rel = (f: string): string => path.relative(WS, path.join(OUT, f));
  const ghArgs = ["release", "create", tag, "--repo", REPO, "--prerelease", "--title", `Site demo ${day}`,
    "--notes-file", rel(NOTES), rel(ARCHIVE), rel(MANIFEST)];
  console.log(`cd ${WS}`);
  console.log(`GH_CONFIG_DIR=${GH_CONFIG} gh ${ghArgs.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(" ")}`);
  if (!args.yes) {
    console.log("demo-bundle: dry run; add --yes to create the release");
    return;
  }
  const r = spawnSync("gh", ghArgs, {
    cwd: WS,
    stdio: "inherit",
    env: { ...process.env, GH_CONFIG_DIR: path.join(os.homedir(), ".config", "gh-personal") },
  });
  if (r.status !== 0) fail("gh release create failed");
  console.log(`demo-bundle: published; deploy it with: GH_CONFIG_DIR=${GH_CONFIG} gh workflow run pages.yml --repo ${REPO}`);
}

if (args.publish) publish();
else bundle();
