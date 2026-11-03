<script setup lang="ts">
import { withBase } from "vitepress";
import { onMounted, ref } from "vue";
import { loadGallery, showInMap, type GalleryImage } from "../demo";

// The end-game screenshots: the plaza overview first, then one per machine.
const images = ref<GalleryImage[] | null>(null);
const loaded = ref(false);

onMounted(async () => {
  const shots = (await loadGallery())?.images.filter((image) => image.group === "endgame") ?? [];
  images.value = shots.length > 0 ? shots : null;
  loaded.value = true;
});
</script>

<template>
  <div v-if="images" class="demo-gallery demo-endgame">
    <figure v-for="(image, index) in images" :key="image.file" :class="{ wide: index === 0 }">
      <a :href="withBase(`/generated/${image.file}`)" target="_blank" rel="noopener">
        <img
          :src="withBase(`/generated/${image.file}`)"
          :alt="image.title"
          :width="image.width"
          :height="image.height"
          loading="lazy"
        />
      </a>
      <figcaption>
        <strong>{{ image.title }}</strong>
        <span>{{ image.caption }}</span>
        <button type="button" @click="showInMap(image.hash)">Show in the live map</button>
      </figcaption>
    </figure>
  </div>
  <div v-else-if="loaded" class="demo-placeholder">
    <p class="title">No end-game screenshots in this build</p>
    <p>
      They are taken from the local end-game map, which contains Minecraft, mod and Modernity-GTNH textures and is
      never committed: build the <code>endgame</code> scene with the orchestrator, then run <code>pnpm demo</code>.
    </p>
  </div>
</template>
