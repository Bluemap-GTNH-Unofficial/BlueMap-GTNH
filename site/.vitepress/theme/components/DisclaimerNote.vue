<script setup lang="ts">
import { useData } from "vitepress";

const { lang } = useData();
</script>

<template>
  <div class="disclaimer-note custom-block warning" role="note">
    <template v-if="lang === 'zh-CN'">
      <p class="custom-block-title">非官方项目，风险自负</p>
      <p>
        本项目与 BlueMap、GT New Horizons、Mojang 或 Microsoft 均无关联，请勿向他们报告本移植的问题。代码、测试和文档大多由
        AI 编程助手在人工指导下编写（vibe coded），未经审计，不提供任何担保或质量保证，只在一个整合包版本和一台机器上测试过。
        安装前请备份存档。
      </p>
    </template>
    <template v-else>
      <p class="custom-block-title">Unofficial project. Use at your own risk.</p>
      <p>
        Not affiliated with, endorsed by or supported by BlueMap, the GT New Horizons team, Mojang or Microsoft; do not
        report problems with this port to them. Most of the code, tests and documentation were written by an AI coding
        agent under human direction (vibe coded) and have not been audited. There is no warranty and no quality
        guarantee; it has been tested on one pack version and one machine. Back up your world before installing it.
      </p>
    </template>
  </div>
</template>
