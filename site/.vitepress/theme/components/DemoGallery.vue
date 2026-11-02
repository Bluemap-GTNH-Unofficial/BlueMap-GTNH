<script setup lang="ts">
import { withBase } from "vitepress";
import { onMounted, ref } from "vue";
import { demoHash, loadJson, type GalleryImage } from "../demo";

const images = ref<GalleryImage[] | null>(null);
const loaded = ref(false);

onMounted(async () => {
  const gallery = await loadJson("/generated/gallery.json", (value): value is { images: GalleryImage[] } =>
    typeof value === "object" && value !== null && "images" in value && Array.isArray(value.images),
  );
  images.value = gallery?.images ?? null;
  loaded.value = true;
});

function showInMap(image: GalleryImage): void {
  demoHash.value = image.hash;
  document.querySelector(".demo-map")?.scrollIntoView({ behavior: "smooth", block: "center" });
}
</script>

<template>
  <div v-if="images" class="demo-gallery">
    <figure v-for="image in images" :key="image.file">
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
        <button type="button" @click="showInMap(image)">Show in the live map</button>
      </figcaption>
    </figure>
  </div>
  <div v-else-if="loaded" class="demo-placeholder">
    <p class="title">No screenshots in this build</p>
    <p>
      Screenshots are renders of test worlds with Minecraft and mod textures, so they are not committed either.
      <code>pnpm demo</code> takes them from the local demo map with Playwright.
    </p>
  </div>
</template>
