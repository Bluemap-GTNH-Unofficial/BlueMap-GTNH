import fs from "node:fs";
import path from "node:path";
import { defineConfig, type DefaultTheme } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";

// GitHub Pages serves the umbrella repository under /BlueMap-GTNH/; `SITE_BASE=/ pnpm build` for a root deployment.
const base = process.env.SITE_BASE ?? "/BlueMap-GTNH/";
const siteUrl = process.env.SITE_URL ?? "https://bluemap-gtnh-unofficial.github.io/BlueMap-GTNH/";
const org = "https://github.com/Bluemap-GTNH-Unofficial";
const umbrella = `${org}/BlueMap-GTNH`;

// GitHub-style heading ids, so anchors written for GitHub (NOTICE.md, READMEs) keep working on the site.
function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

// Relative links of files included from the repository root (NOTICE.md) point at files that are not site pages.
const ROOT_FILES: Record<string, string> = {
  LICENSE: `${umbrella}/blob/main/LICENSE`,
  "NOTICE.md": `${umbrella}/blob/main/NOTICE.md`,
  "README.md": `${umbrella}/blob/main/README.md`,
};

// One sidebar for every page, so the groups and their order never change while navigating.
const sidebar: DefaultTheme.SidebarItem[] = [
  {
    text: "Guide",
    collapsed: false,
    items: [
      { text: "Requirements", link: "/guide/" },
      { text: "Install the server mod", link: "/guide/install" },
      { text: "Export the resource pack", link: "/guide/export" },
      { text: "Community addons", link: "/guide/addons" },
      { text: "Maps, commands, config", link: "/guide/maps" },
      { text: "Performance", link: "/guide/performance" },
      { text: "Troubleshooting", link: "/guide/troubleshooting" },
    ],
  },
  {
    text: "Project",
    collapsed: false,
    items: [
      { text: "Demo", link: "/showcase" },
      { text: "Status", link: "/status" },
      { text: "Architecture", link: "/architecture" },
      { text: "Credits & licence", link: "/credits" },
    ],
  },
  {
    text: "Development",
    collapsed: false,
    items: [
      { text: "Workspace & toolchain", link: "/development/" },
      { text: "Building", link: "/development/building" },
      { text: "Tests & scenes", link: "/development/testing" },
      { text: "Client oracle", link: "/development/oracle" },
    ],
  },
];

export default withMermaid(
  defineConfig({
    title: "BlueMap GTNH",
    description:
      "Unofficial port of BlueMap, the 3D web map for Minecraft, to Minecraft 1.7.10 and GT New Horizons 2.9.0-RC-2.",
    base,
    cleanUrls: true,
    lastUpdated: true,
    srcExclude: ["README.md", "scripts/**"],
    // last-updated comes from git; pages not committed yet fall back to the file's modification time
    transformPageData(pageData, { siteConfig }) {
      if (!pageData.lastUpdated) {
        pageData.lastUpdated = fs.statSync(path.join(siteConfig.srcDir, pageData.filePath)).mtimeMs;
      }
    },
    sitemap: { hostname: siteUrl },
    head: [
      ["link", { rel: "icon", type: "image/svg+xml", href: `${base}logo.svg` }],
      ["meta", { name: "theme-color", content: "#2f6fd6" }],
      ["meta", { property: "og:title", content: "BlueMap GTNH (unofficial)" }],
      ["meta", { property: "og:description", content: "BlueMap's 3D web map for GT New Horizons 2.9 on Minecraft 1.7.10." }],
    ],
    markdown: {
      anchor: { slugify },
      config(md) {
        md.core.ruler.push("root-file-links", (state) => {
          for (const block of state.tokens) {
            for (const token of block.children ?? []) {
              const href = token.type === "link_open" ? token.attrGet("href") : null;
              if (href && href in ROOT_FILES) token.attrSet("href", ROOT_FILES[href]);
            }
          }
        });
      },
    },
    locales: {
      root: {
        label: "English",
        lang: "en-US",
        themeConfig: {
          nav: [
            { text: "Guide", link: "/guide/", activeMatch: "^/guide/" },
            { text: "Status", link: "/status" },
            { text: "Architecture", link: "/architecture" },
            { text: "Development", link: "/development/", activeMatch: "^/development/" },
            { text: "Demo", link: "/showcase" },
            {
              text: "Repositories",
              items: [
                { text: "BlueMap-GTNH (umbrella, releases)", link: umbrella },
                { text: "BlueMap fork + server mod", link: `${org}/BlueMap` },
                { text: "gtnh-exporter", link: `${org}/gtnh-exporter` },
                { text: "modernity", link: `${org}/modernity` },
                { text: "harness", link: `${org}/harness` },
                { text: "orchestrator", link: `${org}/orchestrator` },
                { text: "e2e", link: `${org}/e2e` },
              ],
            },
          ],
        },
      },
      zh: {
        label: "简体中文",
        lang: "zh-CN",
        link: "/zh/",
        title: "BlueMap GTNH",
        description: "BlueMap 3D 网页地图的非官方移植：Minecraft 1.7.10 与 GT New Horizons 2.9.0-RC-2。",
        themeConfig: {
          nav: [
            { text: "指南（英文）", link: "/guide/" },
            { text: "状态（英文）", link: "/status" },
            { text: "演示", link: "/showcase" },
          ],
          editLink: { pattern: `${umbrella}/edit/main/site/:path`, text: "在 GitHub 上编辑此页" },
          lastUpdated: { text: "最后更新" },
          docFooter: { prev: "上一页", next: "下一页" },
          outline: { label: "本页目录", level: [2, 3] },
          darkModeSwitchLabel: "外观",
          sidebarMenuLabel: "菜单",
          returnToTopLabel: "回到顶部",
          langMenuLabel: "语言",
        },
      },
    },
    themeConfig: {
      logo: "/logo.svg",
      sidebar,
      search: {
        provider: "local",
        options: {
          locales: {
            zh: {
              translations: {
                button: { buttonText: "搜索", buttonAriaLabel: "搜索" },
                modal: {
                  noResultsText: "没有结果",
                  resetButtonTitle: "清除",
                  footer: { selectText: "选择", navigateText: "切换", closeText: "关闭" },
                },
              },
            },
          },
        },
      },
      editLink: { pattern: `${umbrella}/edit/main/site/:path`, text: "Edit this page on GitHub" },
      lastUpdated: { formatOptions: { dateStyle: "medium" } },
      outline: { level: [2, 3] },
      socialLinks: [{ icon: "github", link: umbrella }],
      footer: {
        message:
          "Unofficial and vibe coded. Not affiliated with BlueMap, GT New Horizons, Mojang or Microsoft. No warranty.",
        copyright: "MIT licence, except where NOTICE.md says otherwise.",
      },
    },
    mermaid: {},
    mermaidPlugin: { class: "mermaid" },
  }),
);
