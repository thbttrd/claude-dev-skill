import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { SPECS_DIR } from "./lib/specs.mjs";

// Every markdown document the site renders. Trackers (json/jsonl) are read
// per request in src/lib/specs.mjs; only markdown needs Astro's pipeline.
const docs = defineCollection({
  loader: glob({
    pattern: ["*.md", "story-*/*.md", "story-*/ui/*.md", "story-*/verification/*.md", "!legacy/**", "!.site/**"],
    base: SPECS_DIR,
    generateId: ({ entry }) => entry.replace(/\.md$/, ""),
  }),
});

export const collections = { docs };
