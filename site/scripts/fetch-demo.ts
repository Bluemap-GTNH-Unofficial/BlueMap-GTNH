// Downloads the newest `demo-*` release of the umbrella repository (see bundle-demo.ts), checks the archive against
// its manifest and unpacks it into `public/`, so `pnpm build` deploys the demo with the site. Without a demo release
// it exits 0 and the site builds with the demo placeholders. The Pages workflow runs it; needs `gh`, `tar`, `zstd`.
//
//   pnpm demo:fetch                           newest demo-* release of $GITHUB_REPOSITORY (or the umbrella)
//   pnpm demo:fetch --from <dir> --dest <dir> local release dir (archive + manifest) into another dir, for dry runs

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARCHIVE = "bluemap-gtnh-demo.tar.zst";
const MANIFEST = "demo-manifest.json";
const DIRS = ["demo", "generated"];

const { values: args } = parseArgs({
  options: { from: { type: "string" }, dest: { type: "string" }, repo: { type: "string" } },
});
const dest = path.resolve(args.dest ?? path.join(SITE, "public"));
const repo = args.repo ?? process.env.GITHUB_REPOSITORY ?? "Bluemap-GTNH-Unofficial/BlueMap-GTNH";

function fail(message: string): never {
  console.error(`demo-fetch: ${message}`);
  process.exit(1);
}

function run(cmd: string, argv: string[]): string {
  const r = spawnSync(cmd, argv, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) fail(`${cmd} ${argv.join(" ")} failed: ${r.stderr || r.error}`);
  return r.stdout;
}

let dir = args.from && path.resolve(args.from);
if (!dir) {
  const releases: { tagName: string; publishedAt: string; isDraft: boolean }[] = JSON.parse(
    run("gh", ["release", "list", "--repo", repo, "--limit", "200", "--json", "tagName,publishedAt,isDraft"]),
  );
  const tag = releases
    .filter((r) => !r.isDraft && r.tagName.startsWith("demo-"))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0]?.tagName;
  if (!tag) {
    console.log(`demo-fetch: no demo-* release in ${repo}; building the site without the demo`);
    process.exit(0);
  }
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "demo-release-"));
  run("gh", ["release", "download", tag, "--repo", repo, "--dir", dir, "--pattern", ARCHIVE, "--pattern", MANIFEST]);
  console.log(`demo-fetch: downloaded ${tag}`);
}

if (!fs.existsSync(path.join(dir, MANIFEST))) {
  console.log(`demo-fetch: no ${MANIFEST} in ${dir}; building the site without the demo`);
  process.exit(0);
}
const manifest = JSON.parse(fs.readFileSync(path.join(dir, MANIFEST), "utf8"));
const archive = path.join(dir, manifest.archive.name);
if (!fs.existsSync(archive)) fail(`${manifest.archive.name} missing next to ${MANIFEST}`);
const digest = createHash("sha256").update(fs.readFileSync(archive)).digest("hex");
if (digest !== manifest.archive.sha256) fail(`sha256 mismatch: ${digest}, manifest says ${manifest.archive.sha256}`);

// only plain files under demo/ and generated/
const entries = spawnSync("bash", ["-o", "pipefail", "-c", 'zstd -dc "$1" | tar -tf -', "sh", archive], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
if (entries.status !== 0) fail(`cannot list ${archive}: ${entries.stderr}`);
const names = entries.stdout.split("\n").filter(Boolean);
const bad = names.filter((n) => !DIRS.some((d) => n.startsWith(`${d}/`)) || n.split("/").includes(".."));
if (bad.length) fail(`unexpected archive entries: ${bad.slice(0, 5).join(", ")}`);
for (const d of DIRS) {
  if (fs.existsSync(path.join(dest, d))) fail(`${path.join(dest, d)} exists; refusing to overwrite`);
}
fs.mkdirSync(dest, { recursive: true });
const x = spawnSync("bash", ["-o", "pipefail", "-c", 'zstd -dc "$1" | tar -xf - -C "$2"', "sh", archive, dest], { encoding: "utf8" });
if (x.status !== 0) fail(`extracting failed: ${x.stderr}`);

const files = DIRS.flatMap((d) => (fs.readdirSync(path.join(dest, d), { recursive: true, withFileTypes: true }) as fs.Dirent[])
  .filter((e) => e.isFile())
  .map((e) => path.join(e.parentPath, e.name)));
const bytes = files.reduce((s, f) => s + fs.statSync(f).size, 0);
if (files.length !== manifest.contents.files || bytes !== manifest.contents.bytes) {
  fail(`unpacked ${files.length} files / ${bytes} bytes, manifest says ${manifest.contents.files} / ${manifest.contents.bytes}`);
}
console.log(`demo-fetch: ${files.length} files (${(bytes / 1024 / 1024).toFixed(1)} MiB) into ${dest}, rendered ${manifest.rendered}`);
