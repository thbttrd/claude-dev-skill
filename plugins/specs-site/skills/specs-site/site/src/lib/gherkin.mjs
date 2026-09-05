import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { AstBuilder, GherkinClassicTokenMatcher, Parser } from "@cucumber/gherkin";
import { IdGenerator } from "@cucumber/messages";
import { SPECS_DIR } from "./specs.mjs";

// .feature source → plain data the components render. A syntax error is a
// value (`error` set), never a throw: the page shows it in place.
export function parseFeature(source, path = "") {
  const parser = new Parser(new AstBuilder(IdGenerator.incrementing()), new GherkinClassicTokenMatcher());
  let doc;
  try {
    doc = parser.parse(source);
  } catch (err) {
    return { path, error: String(err.message ?? err) };
  }
  const f = doc.feature;
  if (!f) return { path, error: "empty feature file" };
  return {
    path,
    error: null,
    name: f.name,
    keyword: f.keyword,
    tags: f.tags.map((t) => t.name),
    description: f.description.trim(),
    children: f.children.map(child),
  };
}

function child(c) {
  if (c.background) return { kind: "background", ...scenario(c.background) };
  if (c.rule)
    return {
      kind: "rule",
      name: c.rule.name,
      tags: c.rule.tags.map((t) => t.name),
      description: c.rule.description.trim(),
      children: c.rule.children.map(child),
    };
  return { kind: c.scenario.examples?.length ? "outline" : "scenario", ...scenario(c.scenario) };
}

function scenario(s) {
  return {
    name: s.name,
    keyword: s.keyword,
    tags: (s.tags ?? []).map((t) => t.name),
    description: (s.description ?? "").trim(),
    steps: s.steps.map((st) => ({
      keyword: st.keyword.trim(),
      text: st.text,
      table: st.dataTable ? cells(st.dataTable.rows) : null,
      docString: st.docString?.content ?? null,
    })),
    examples: (s.examples ?? []).map((e) => ({
      name: e.name,
      tags: e.tags.map((t) => t.name),
      header: e.tableHeader ? e.tableHeader.cells.map((c) => c.value) : [],
      rows: cells(e.tableBody),
    })),
  };
}

const cells = (rows) => rows.map((r) => r.cells.map((c) => c.value));

export function readFeatures(dirRel) {
  const dir = join(SPECS_DIR, dirRel, "features");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".feature"))
    .sort()
    .map((f) => parseFeature(readFileSync(join(dir, f), "utf8"), relative(SPECS_DIR, join(dir, f))));
}
