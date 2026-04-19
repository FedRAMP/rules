import { expect, test } from "bun:test";

import { collectPropertyOrderIssues, fixPropertyOrder } from "../src/property-order";
import { loadRulesDocument, loadSchemaDocument } from "../src/rules";
import type { RulesDocument } from "../src/types";

test("the consolidated rules document follows the schema-defined property order", () => {
  const issues = collectPropertyOrderIssues(loadRulesDocument(), loadSchemaDocument());
  expect(issues).toEqual([]);
});

test("property order fixes use schema property order as the source of truth", () => {
  const schema = {
    type: "object",
    properties: {
      FRD: {
        type: "object",
        properties: {
          data: {
            type: "object",
            patternProperties: {
              "^[a-z]+$": {
                type: "object",
                patternProperties: {
                  "^FRD-[A-Z]{3}$": {
                    $ref: "#/$defs/frd_definition",
                  },
                },
              },
            },
          },
        },
      },
    },
    $defs: {
      frd_definition: {
        type: "object",
        properties: {
          term: { type: "string" },
          alts: { type: "array" },
          definition: { type: "string" },
          note: { type: "string" },
          updated: { type: "array" },
        },
      },
    },
  };

  const document = {
    FRD: {
      data: {
        both: {
          "FRD-TST": {
            definition: "Test definition",
            term: "Test Term",
            updated: [],
            note: "Test note",
            alts: ["test"],
          },
        },
      },
    },
  } as unknown as RulesDocument;

  const checkIssues = collectPropertyOrderIssues(document, schema);
  expect(checkIssues).toEqual([
    {
      path: "FRD.data.both.FRD-TST",
      actualOrder: ["definition", "term", "updated", "note", "alts"],
      expectedOrder: ["term", "alts", "definition", "note", "updated"],
    },
  ]);

  const fixed = fixPropertyOrder(document, schema);
  expect(fixed.fixedCount).toBe(1);
  expect(Object.keys(fixed.document.FRD.data.both["FRD-TST"])).toEqual([
    "term",
    "alts",
    "definition",
    "note",
    "updated",
  ]);
});
