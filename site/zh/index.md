---
layout: home
title: BlueMap GTNH
titleTemplate: GT New Horizons 的非官方 BlueMap 移植

hero:
  name: BlueMap GTNH
  text: 为 GT New Horizons 打造的 BlueMap 3D 网页地图
  tagline: BlueMap 5.29 到 Minecraft 1.7.10 与 GTNH 2.9.0 整合包的非官方移植。一个 Forge 服务端模组，读取你的存档，把原版地形、格雷科技机器和整合包里其他模组的方块渲染成浏览器里的地图。
  image:
    src: /logo.svg
    alt: BlueMap GTNH
  actions:
    - theme: brand
      text: 开始使用（英文）
      link: /guide/
    - theme: alt
      text: 在线演示
      link: /showcase
    - theme: alt
      text: 项目状态（英文）
      link: /status
    - theme: alt
      text: GitHub
      link: https://github.com/Bluemap-GTNH-Unofficial/BlueMap-GTNH

features:
  - title: 读取 1.7.10 存档
    details: 支持 EndlessIDs / ChunkAPI 扩展方块 ID 与 16 位 meta，方块名取自 FML 注册表。在 12 个测试场景上与运行中的服务端逐方块对账，0 处不一致。
  - title: 原版方块扁平化
    details: 1.7.10 的 ID 与 meta 转换为 1.13 方块状态，包括依赖相邻方块的形状。与 Minecraft 1.13.2 官方升级结果在 905,216 个位置上逐一对比。
  - title: 从你自己的客户端导出模组方块
    details: 一次性客户端模组导出每个方块状态的外观（138 个模组的 4,087 个方块、61,468 个状态），生成只供你自己使用、不再分发的资源包。
  - title: 格雷科技专用渲染
    details: 为格雷科技机器、管道、线缆、矿石和框架编写的专用渲染器，包括成型的多方块结构；另有连接纹理、铁箱子、AE2 线缆和 EnderIO 导管。
  - title: 社区附属模组
    details: "Twist Space Technology（TST）、Programmable Hatches、GT: Not Leisure（GTNL）、NH Utilities 和 Box++ 社区分支在 GTNH 2.9.0 上均可加载、导出并渲染。"
  - title: 运行在你的服务端里
    details: 每个有区域文件的维度自动生成一张地图，存档保存后瓦片随之更新，在线玩家显示在地图上，/bluemap 命令可在游戏内和 RCON 中使用。
---

<div class="home-content">

## 免责声明

- 本项目是**非官方**移植，与 [BlueMap](https://github.com/BlueMap-Minecraft/BlueMap) 及
  [GT New Horizons](https://github.com/GTNewHorizons) 团队均无关联，未获其认可或支持。请不要向他们报告本移植的问题。
- 本项目是 **vibe coded**：大部分代码、测试和文档由 AI 编程助手在人工指导下编写。它经过测试，但未经审计。
- **不提供任何担保，也不保证质量。**只支持 GTNH 2.9.0，只在这一个整合包版本和一台机器上测试过。
- **安装前请备份存档。**服务端模组不会修改区块数据，但它运行在你的服务端进程里，并会请求服务端保存世界。

## 当前状态

当前源码将作为 **`v5.29-gtnh.2`**（BlueMap 5.29 加上本移植）发布，支持 GTNH 2.9.0。以下数据均在 GTNH 2.9.0 上、在一台机器上测得。

<div class="status-grid">
  <div class="stat"><span class="value">0</span><span class="label">处读取器与运行中服务端的不一致（12 个场景）</span></div>
  <div class="stat"><span class="value">91.52%</span><span class="label"><code>gtnh-zoo</code> 场景中已放置的模组方块状态使用自身模型渲染</span></div>
  <div class="stat"><span class="value">78.5%</span><span class="label">的 61,513 个参与判定的方块状态与真实 GTNH 客户端一致（Modernity-GTNH 为 76.5%）</span></div>
  <div class="stat"><span class="value">77.4%</span><span class="label">的可见方块面与真实客户端一致（7 个场景世界，共 18,437 个参与判定的面）</span></div>
</div>

[客户端对照检查](/development/oracle)（client oracle）把地图与真实 GTNH 客户端的画面逐方块状态、逐可见方块面对比，判定阈值由数据校准，而非手工调整。浏览器截图检查只是把渲染结果与本地人工批准过的旧渲染结果对比：它能发现变化，不能证明渲染正确。可选的 Modernity-GTNH 外观也用同样的方法检查。

其余文档目前只有英文版：[安装要求](/guide/)、[安装服务端模组](/guide/install)、[导出资源包](/guide/export)、
[社区附属模组配置](/guide/addons)、[已知问题](/status#known-gaps)。

</div>
