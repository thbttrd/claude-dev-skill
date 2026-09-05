import { defineConfig } from "astro/config";
import { resolve } from "node:path";

const SPECS_DIR = resolve(process.env.SPECS_DIR ?? "specs");

// The trackers live outside the project root, so Vite does not watch them.
// Adding the directory makes Astro drop its route cache and the browser
// reload on every change under specs/** — the "live Op workflow" view.
const watchSpecs = {
  name: "watch-specs",
  hooks: {
    "astro:server:setup": ({ server }) => {
      server.watcher.add(SPECS_DIR);
      server.watcher.on("all", (_event, file) => {
        if (file.startsWith(SPECS_DIR)) server.hot.send({ type: "full-reload" });
      });
    },
  },
};

export default defineConfig({
  output: "static",
  server: { host: "127.0.0.1", port: 4321 },
  devToolbar: { enabled: false },
  integrations: [watchSpecs],
});
