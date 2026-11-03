<script setup lang="ts">
import { withBase } from "vitepress";
import { computed, onMounted, ref } from "vue";
import { demoHash, loadJson } from "../demo";

const state = ref<"loading" | "ready" | "missing">("loading");
const maps = ref<string[]>([]);
const src = computed(() => `${withBase("/demo/index.html")}#${demoHash.value}`);

onMounted(async () => {
  const settings = await loadJson("/demo/settings.json", (value): value is { maps: string[] } =>
    typeof value === "object" && value !== null && "maps" in value && Array.isArray(value.maps),
  );
  maps.value = settings?.maps ?? [];
  state.value = settings ? "ready" : "missing";
});
</script>

<template>
  <div class="demo-map" :class="state">
    <iframe v-if="state === 'ready'" :src="src" title="Live BlueMap demo (unofficial)" allow="fullscreen" allowfullscreen />
    <div v-else-if="state === 'missing'" class="demo-placeholder">
      <p class="title">The live map is not part of this build</p>
      <p>
        The demo map contains Minecraft and mod textures, so it is never committed. It is generated locally from the
        test scenes with <code>pnpm demo</code> in <code>site/</code>, which renders them with the BlueMap CLI of the fork
        and the 2.9.0 resource pack exported to <code>out/exporter-2.9.0/</code>. For servers, two ready-made 2.9.0 packs
        are attached to the releases for convenience: the base pack for plain 2.9.0 servers and the addon pack for
        servers running the five supported addons. Their textures belong to their authors; they are offered for
        non-commercial use only and are removed on request. See
        <a :href="withBase('/guide/export#ready-made-packs')">Ready-made packs</a> and
        <a :href="withBase('/development/testing#site-demo')">Tests &amp; scenes</a>.
      </p>
    </div>
    <div v-else class="demo-placeholder"><p>Looking for the demo map…</p></div>
  </div>
  <p v-if="state === 'ready'" class="demo-map-links">
    <a :href="src" target="_blank" rel="noopener">Open the map in a new tab</a>
    <span> · maps: {{ maps.join(", ") }}</span>
  </p>
</template>
