<script setup lang="ts">
// A table of the results snapshot (tables() in data/numbers.ts), e.g. <ResultsTable name="oracle-worlds" />.
import { data } from "../../../data/results.data.ts";

const props = defineProps<{ name: string }>();
const table = data.tables[props.name];

// The cells are inline markdown: `code` and **bold**.
function inline(cell: string): string {
  return cell
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}
</script>

<template>
  <table>
    <thead>
      <tr><th v-for="(cell, i) in table.header" :key="i" v-html="inline(cell)" /></tr>
    </thead>
    <tbody>
      <tr v-for="(row, r) in table.rows" :key="r">
        <td v-for="(cell, i) in row" :key="i" v-html="inline(cell)" />
      </tr>
    </tbody>
  </table>
</template>
