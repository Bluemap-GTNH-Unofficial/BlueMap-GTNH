import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import { h } from "vue";
import DemoCompare from "./components/DemoCompare.vue";
import DemoEndgame from "./components/DemoEndgame.vue";
import DemoGallery from "./components/DemoGallery.vue";
import DemoMap from "./components/DemoMap.vue";
import DisclaimerBanner from "./components/DisclaimerBanner.vue";
import DisclaimerNote from "./components/DisclaimerNote.vue";
import ResultsTable from "./components/ResultsTable.vue";
import "./custom.css";

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      "layout-top": () => h(DisclaimerBanner),
      "home-hero-after": () => h("div", { class: "home-content home-disclaimer" }, [h(DisclaimerNote)]),
      "doc-footer-before": () => h(DisclaimerNote),
    }),
  enhanceApp({ app }) {
    app.component("DemoMap", DemoMap);
    app.component("DemoEndgame", DemoEndgame);
    app.component("DemoCompare", DemoCompare);
    app.component("DemoGallery", DemoGallery);
    app.component("ResultsTable", ResultsTable);
  },
} satisfies Theme;
