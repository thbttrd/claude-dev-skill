import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
process.env.SPECS_DIR = fileURLToPath(new URL("../../../scripts/fixtures/specs/", import.meta.url));
const g = await import("./gherkin.mjs");

test("parseFeature: tags, background, rule, scenario with data table, outline with examples", () => {
  const f = g.parseFeature(`@US-000 @F-001
Feature: Greeting
  Visitors get a hello.

  Background:
    Given the app is running

  Rule: Visitors are greeted

    @happy-path
    Scenario: Greeting a visitor
      Given a visitor
      When they arrive
      Then they see:
        | text  |
        | Hello |

    Scenario Outline: Greeting by name
      Given a visitor named "<name>"
      Then they see "Hello <name>"
      Examples:
        | name |
        | Ada  |
        | Bob  |
`, "F-001.feature");
  assert.equal(f.error, null);
  assert.deepEqual(f.tags, ["@US-000", "@F-001"]);
  assert.equal(f.description, "Visitors get a hello.");
  assert.equal(f.children[0].kind, "background");
  const rule = f.children[1];
  assert.equal(rule.kind, "rule");
  assert.equal(rule.children[0].kind, "scenario");
  assert.deepEqual(rule.children[0].tags, ["@happy-path"]);
  assert.deepEqual(rule.children[0].steps[2], { keyword: "Then", text: "they see:", table: [["text"], ["Hello"]], docString: null });
  assert.equal(rule.children[1].kind, "outline");
  assert.deepEqual(rule.children[1].examples[0], { name: "", tags: [], header: ["name"], rows: [["Ada"], ["Bob"]] });
});

test("parseFeature: a syntax error is returned, not thrown", () => {
  const f = g.parseFeature("Feature: Broken\n  Scenario: x\n    Given a table\n      | a | b |\n      | 1 |\n", "broken.feature");
  assert.match(f.error, /\(5:7\): inconsistent cell count/);
  assert.equal(f.name, undefined);
});

test("readFeatures reads every .feature under the story's features/ dir, sorted, errors in place", () => {
  const all = g.readFeatures("story-000-foundation");
  assert.deepEqual(all.map((f) => [f.path, f.error === null]), [
    ["story-000-foundation/features/F-001-greeting.feature", true],
    ["story-000-foundation/features/broken.feature", false],
  ]);
  assert.deepEqual(g.readFeatures("story-001-farewell"), []);
});
