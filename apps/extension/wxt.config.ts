import { defineConfig } from "wxt";

const isDev = process.env.NODE_ENV !== "production";

export default defineConfig({
  modules: [],
  manifest: {
    name: "AlgoVortex Detect",
    description:
      "Find AI site-builder fingerprints and GitHub leftovers on the page you are viewing. Honest about Cursor/Copilot limits.",
    homepage_url: "https://algovortex.co",
    permissions: ["activeTab", "scripting", "storage"],
    host_permissions: isDev
      ? [
          "https://detect.algovortex.co/*",
          "http://localhost:8787/*",
        ]
      : ["https://detect.algovortex.co/*"],
    icons: {
      16: "icon/16.png",
      32: "icon/32.png",
      48: "icon/48.png",
      128: "icon/128.png",
    },
    action: {
      default_title: "AlgoVortex Detect",
      default_icon: {
        16: "icon/16.png",
        32: "icon/32.png",
        48: "icon/48.png",
        128: "icon/128.png",
      },
    },
    externally_connectable: {
      matches: isDev
        ? ["https://detect.algovortex.co/*", "http://localhost:8787/*"]
        : ["https://detect.algovortex.co/*"],
    },
    browser_specific_settings: {
      gecko: {
        id: "detect@algovortex.co",
        strict_min_version: "121.0",
      },
    },
  },
});
