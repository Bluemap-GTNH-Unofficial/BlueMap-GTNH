<script setup lang="ts">
import { withBase } from "vitepress";
import { onMounted, reactive, ref } from "vue";
import { loadGallery, showInMap, type Comparison } from "../demo";

// Modernity-GTNH and default textures of one machine, same camera; the slider moves the border between them.
const comparisons = ref<Comparison[] | null>(null);
const loaded = ref(false);
const split = reactive<Record<string, number>>({});

onMounted(async () => {
  const list = (await loadGallery())?.compare ?? [];
  for (const comparison of list) split[comparison.key] = 50;
  comparisons.value = list.length > 0 ? list : null;
  loaded.value = true;
});
</script>

<template>
  <div v-if="comparisons" class="demo-compare-list">
    <figure v-for="c in comparisons" :key="c.key" class="demo-compare">
      <div class="frame" :style="{ '--split': `${split[c.key]}%`, aspectRatio: `${c.width} / ${c.height}` }">
        <img :src="withBase(`/generated/${c.default}`)" :alt="`${c.title}, default textures`" />
        <img class="modernity" :src="withBase(`/generated/${c.modernity}`)" :alt="`${c.title}, Modernity-GTNH textures`" />
        <div class="divider" aria-hidden="true" />
        <span class="label left" aria-hidden="true">Modernity-GTNH</span>
        <span class="label right" aria-hidden="true">Default</span>
        <input
          v-model.number="split[c.key]"
          type="range"
          min="0"
          max="100"
          step="1"
          :aria-label="`${c.title}: share of the view in Modernity-GTNH textures (the rest in default textures)`"
        />
      </div>
      <figcaption>
        <strong>{{ c.title }}</strong>
        <span>Left of the line: the Modernity-GTNH map; right: the default-texture map, from the same camera.</span>
        <button type="button" @click="showInMap(c.hash)">Show in the live map</button>
      </figcaption>
    </figure>
  </div>
  <div v-else-if="loaded" class="demo-placeholder">
    <p class="title">No comparison in this build</p>
    <p>
      <code>pnpm demo</code> takes each comparison twice, from the Modernity-GTNH and the default-texture end-game
      maps.
    </p>
  </div>
</template>
