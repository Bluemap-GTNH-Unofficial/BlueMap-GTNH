// VitePress data loader of the results snapshot (results-<pack version>.json, written by scripts/numbers.ts). A page
// imports it as `n` and quotes `{{ n.states.default.rate }}`; <ResultsTable name="..."> renders its tables.
import fs from "node:fs";
import { defineLoader } from "vitepress";
import { tables, values } from "./numbers.ts";
import type { Snapshot, Table } from "./numbers.ts";

const file = `results-${process.env.BMGTNH_PACK_VERSION ?? "2.9.0"}.json`;

/** values() of data/numbers.ts by path, and the tables by name. */
export type Data = Record<string, unknown> & { tables: Record<string, Table> };

declare const data: Data;
export { data };

export default defineLoader({
  watch: ["./results-*.json"],
  load(watchedFiles: string[]): Data {
    const snapshot = watchedFiles.find((f) => f.endsWith(`/${file}`));
    if (!snapshot) throw new Error(`site/data/${file} is missing: run \`mise run docs:numbers\``);
    const s: Snapshot = JSON.parse(fs.readFileSync(snapshot, "utf8"));
    return { ...values(s), tables: tables(s) };
  },
});
