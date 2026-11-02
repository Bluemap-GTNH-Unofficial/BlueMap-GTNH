<script setup lang="ts">
import { useData, withBase } from "vitepress";
import { computed } from "vue";

const { lang } = useData();
const zh = computed(() => lang.value === "zh-CN");
</script>

<template>
  <div class="disclaimer-banner" role="note">
    <span class="badge">{{ zh ? "非官方" : "Unofficial" }}</span>
    <span v-if="zh" class="text">
      AI 辅助编写（vibe coded），不提供任何质量保证。与 BlueMap 及 GT New Horizons 无关。安装前请备份存档。
    </span>
    <span v-else class="text">
      Vibe coded, no warranty, not affiliated with BlueMap or GT New Horizons. Back up your world first.
    </span>
    <a :href="withBase(zh ? '/zh/#免责声明' : '/status')">{{ zh ? "详情" : "Details" }}</a>
  </div>
</template>
