// Smoke check of the built site, served by `vitepress preview` (a plain static server) on a free port and driven with
// Playwright: home page, local search, mermaid diagrams, dark mode and the demo page (live map tiles, end-game gallery,
// Modernity vs default slider and gallery links when `pnpm demo` ran, the placeholders otherwise). Fails on any HTTP
// error or page error. Screenshots go to <workspace>/out/site-check/.
//
//   pnpm build && pnpm check
//
// It serves the build itself, so an already running `pnpm preview` (which keeps the file list it started with) is
// never checked instead.

import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { chromium, type Frame, type Page } from "playwright";

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WS = path.resolve(process.env.BMGTNH_WORKSPACE ?? path.join(SITE, ".."));
const DIST = path.join(SITE, ".vitepress", "dist");
const OUT = path.join(WS, "out", "site-check");
const BASE = process.env.SITE_BASE ?? "/BlueMap-GTNH/";

const failures: string[] = [];
function check(ok: boolean, message: string): void {
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
  if (!ok) failures.push(message);
}

async function freePort(): Promise<number> {
  const server = net.createServer();
  const { promise, resolve, reject } = Promise.withResolvers<number>();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    server.close(() => resolve(port));
  });
  return promise;
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not listening yet
    }
    await sleep(250);
  }
  throw new Error(`${url} did not answer within ${timeoutMs} ms`);
}

// The parts of BlueMap's webapp state (`window.bluemap`) the checks read.
interface TileManager {
  unloaded: boolean;
  currentlyLoading: number;
  tiles: Map<string, { loading: boolean }>;
}

interface BlueMapMap {
  data: { id: string };
  isLoaded: boolean;
  hiresTileManager: TileManager;
  lowresTileManager: TileManager[];
}

declare global {
  interface Window {
    bluemap?: { mapViewer?: { map?: BlueMapMap; controlsManager?: { position: { x: number; y: number; z: number } } } };
  }
}

// Same idea as e2e's TILES_SETTLED_JS: the map is loaded and no tile manager has anything in flight.
async function mapSettled(frame: Frame): Promise<void> {
  await frame.waitForFunction(
    () => {
      const map = window.bluemap?.mapViewer?.map;
      if (!map || !map.isLoaded) return false;
      return [map.hiresTileManager, ...map.lowresTileManager].every((m) => !m.unloaded && m.currentlyLoading === 0);
    },
    undefined,
    { timeout: 180_000, polling: 250 },
  );
}

async function settleMap(frame: Frame): Promise<void> {
  try {
    await mapSettled(frame);
    await sleep(2000);
    await mapSettled(frame);
  } catch (error) {
    check(false, `demo: map did not settle (${error instanceof Error ? error.message : error})`);
  }
}

async function shot(page: Page, name: string): Promise<void> {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file });
  console.log(`     screenshot ${path.relative(WS, file)}`);
}

interface GalleryEntry {
  file: string;
  hash: string;
  map: string;
  group?: string;
}

async function main(): Promise<void> {
  if (!fs.existsSync(path.join(DIST, "index.html"))) throw new Error(`no build in ${DIST}; run \`pnpm build\` first`);
  const withDemo = fs.existsSync(path.join(DIST, "demo", "settings.json"));
  const galleryFile = path.join(DIST, "generated", "gallery.json");
  const gallery: GalleryEntry[] = fs.existsSync(galleryFile)
    ? (JSON.parse(fs.readFileSync(galleryFile, "utf8")) as { images: GalleryEntry[] }).images
    : [];
  fs.mkdirSync(OUT, { recursive: true });

  const port = await freePort();
  const root = `http://localhost:${port}${BASE}`;
  const preview = spawn("pnpm", ["exec", "vitepress", "preview", "--port", String(port)], {
    cwd: SITE,
    stdio: "ignore",
    detached: true,
  });
  const browser = await chromium.launch({
    // software WebGL for the embedded map, as in e2e
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  try {
    await waitForServer(root, 30_000);
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });
    const httpErrors: string[] = [];
    const pageErrors: string[] = [];
    let tileResponses = 0;
    context.on("response", (response) => {
      // without the demo build, the demo page's probes for the generated files are expected to miss
      const probe = /\/(demo\/settings|generated\/gallery)\.json$/.test(response.url());
      if (response.status() >= 400 && !(probe && !withDemo)) httpErrors.push(`${response.status()} ${response.url()}`);
      if (/\/demo\/maps\/[^/]+\/tiles\//.test(response.url()) && response.status() === 200) tileResponses++;
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(error.message));

    // home
    await page.goto(root);
    await page.locator(".VPHero .name").waitFor();
    check((await page.locator(".VPHero .name").innerText()).includes("BlueMap GTNH"), "home: hero renders");
    check(await page.locator(".disclaimer-banner").isVisible(), "home: disclaimer banner visible");
    check(await page.locator(".home-disclaimer .disclaimer-note").isVisible(), "home: disclaimer block visible");
    check((await page.locator(".VPFeature").count()) === 6, "home: 6 feature cards");
    await shot(page, "01-home-light.png");

    // local search
    await page.locator(".VPNavBarSearch button").click();
    await page.locator(".VPLocalSearchBox input").fill("crashOnNullRecipeInput");
    const firstResult = page.locator(".VPLocalSearchBox .results li").first();
    await firstResult.waitFor({ timeout: 10_000 });
    const resultText = await page.locator(".VPLocalSearchBox .results").innerText();
    check(resultText.toLowerCase().includes("addons"), "search: finds the community addons page");
    await shot(page, "02-search.png");
    await page.keyboard.press("Escape");

    // dark mode + mermaid
    await page.goto(`${root}architecture`);
    const appearance = page.locator(".VPNavBarAppearance .VPSwitchAppearance");
    await appearance.click();
    check(await page.evaluate(() => document.documentElement.classList.contains("dark")), "dark mode: toggles on");
    await page.waitForFunction(() => document.querySelectorAll(".vp-doc .mermaid svg").length >= 3, undefined, {
      timeout: 30_000,
    });
    const diagrams = await page.locator(".vp-doc .mermaid svg").count();
    check(diagrams === 3, `mermaid: ${diagrams} diagrams rendered as SVG`);
    await page.locator(".vp-doc .mermaid").first().scrollIntoViewIfNeeded();
    await shot(page, "03-architecture-mermaid-dark.png");
    await appearance.click();
    check(!(await page.evaluate(() => document.documentElement.classList.contains("dark"))), "dark mode: toggles off");

    // demo page
    await page.goto(`${root}showcase`);
    if (withDemo) {
      const iframe = page.locator(".demo-map iframe");
      await iframe.waitFor({ timeout: 30_000 });
      // Chromium throttles rendering of off-screen iframes, and the webapp loads tiles from its render loop
      await page.locator(".demo-map").scrollIntoViewIfNeeded();
      const frame = await (await iframe.elementHandle())?.contentFrame();
      if (!frame) throw new Error("demo iframe has no frame");
      await settleMap(frame);
      const opened = await frame.evaluate(() => window.bluemap?.mapViewer?.map?.data.id);
      const loadedTiles = await frame.evaluate(() => {
        const map = window.bluemap?.mapViewer?.map;
        if (!map) return 0;
        return [map.hiresTileManager, ...map.lowresTileManager].reduce((sum, m) => sum + m.tiles.size, 0);
      });
      check(loadedTiles > 0 && tileResponses > 0, `demo: map shows tiles (${loadedTiles} tiles, ${tileResponses} tile responses)`);
      check(opened === "endgame_modernity", `demo: the live map opens on the end-game plaza (${opened})`);
      await shot(page, "04-demo.png");
      await page.evaluate(() => window.scrollTo(0, 0));
      await shot(page, "endgame-1-live-map.png");

      // end-game gallery: one card per machine plus the overview
      const endgame = gallery.filter((image) => image.group === "endgame");
      const cards = page.locator(".demo-endgame figure");
      await cards.first().waitFor({ timeout: 30_000 });
      check(
        endgame.length > 1 && (await cards.count()) === endgame.length,
        `demo: end-game gallery shows ${await cards.count()} of ${endgame.length} screenshots`,
      );
      await page.locator(".demo-endgame").scrollIntoViewIfNeeded();
      await page.evaluate(() => document.querySelector("#end-game-machines")?.scrollIntoView());
      await sleep(500);
      await shot(page, "endgame-2-gallery.png");

      // Modernity vs default: the slider moves the border between the two shots
      const compare = page.locator(".demo-compare").first();
      await compare.scrollIntoViewIfNeeded();
      const modernityShot = compare.locator("img.modernity");
      const before = await modernityShot.evaluate((img) => getComputedStyle(img).clipPath);
      await compare.locator("input[type=range]").fill("25");
      const after = await modernityShot.evaluate((img) => getComputedStyle(img).clipPath);
      check(before !== after, `demo: comparison slider moves the border (${before} -> ${after})`);
      await compare.locator("input[type=range]").fill("50");
      await page.evaluate(() => document.querySelector("#modernity-gtnh-or-default-textures")?.scrollIntoView());
      await sleep(500);
      await shot(page, "endgame-3-compare.png");

      // "Show in the live map" on a machine card flies the live map to it
      const machine = endgame[endgame.length - 1];
      const [, mx, , mz] = machine.hash.split(":").map(Number);
      await cards.last().locator("button").click();
      try {
        await frame.waitForFunction(
          ([x, z]) => {
            const p = window.bluemap?.mapViewer?.controlsManager?.position;
            return !!p && Math.abs(p.x - x) < 1 && Math.abs(p.z - z) < 1;
          },
          [mx, mz],
          { timeout: 30_000 },
        );
        check(true, `demo: "Show in the live map" flies to ${machine.file}`);
      } catch {
        check(false, `demo: "Show in the live map" did not fly to ${machine.file}`);
      }
      await settleMap(frame);
      await shot(page, "endgame-4-live-machine.png");

      // a gallery button switches the live map to that screenshot's map
      const figure = page.locator(".demo-gallery:not(.demo-endgame) figure").first();
      const target = gallery.find((image) => (image.group ?? "gallery") === "gallery");
      if (target) {
        await figure.locator("button").click();
        try {
          await frame.waitForFunction((id) => window.bluemap?.mapViewer?.map?.data.id === id, target.map, {
            timeout: 30_000,
          });
          check(true, `demo: "Show in the live map" switches to the map of ${target.file} (${target.map})`);
        } catch {
          check(false, `demo: "Show in the live map" did not switch to ${target.map}`);
        }
      } else {
        check(false, "demo: no gallery screenshot besides the end-game ones");
      }
    } else {
      await page.locator(".demo-placeholder .title").first().waitFor();
      check((await page.locator(".demo-placeholder").count()) === 4, "demo: placeholders without the demo build");
      await shot(page, "04-demo-placeholder.png");
    }

    check(httpErrors.length === 0, `no HTTP errors${httpErrors.length ? `:\n  ${httpErrors.join("\n  ")}` : ""}`);
    check(pageErrors.length === 0, `no page errors${pageErrors.length ? `:\n  ${pageErrors.join("\n  ")}` : ""}`);
  } finally {
    await browser.close();
    if (preview.pid) process.kill(-preview.pid, "SIGTERM");
  }
  if (failures.length > 0) {
    console.error(`${failures.length} check(s) failed`);
    process.exit(1);
  }
}

await main();
