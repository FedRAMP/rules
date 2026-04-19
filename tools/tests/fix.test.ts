import { expect, test } from "bun:test";

import { applyAutoFixes, collectAutoFixPlan } from "../src/fix";
import { loadRulesDocument, loadSchemaDocument } from "../src/rules";
import type { RulesDocument } from "../src/types";

test("the auto-fix planner reports no work for the current configured dataset", () => {
  const plan = collectAutoFixPlan(loadRulesDocument(), loadSchemaDocument());

  expect(plan).toEqual({
    definitionTermIssueCount: 0,
    termSyncIssueCount: 0,
    idIssueCount: 0,
    propertyOrderIssueCount: 0,
    needsTermsFix: false,
    needsIdsFix: false,
    needsOrderFix: false,
  });
});

test("auto-fix applies ID, term, and property-order fixes in one pass", () => {
  const schema = {
    type: "object",
    properties: {
      info: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          version: { type: "string" },
          last_updated: { type: "string" },
        },
      },
      FRD: {
        type: "object",
        properties: {
          info: { type: "object" },
          data: {
            type: "object",
            properties: {
              both: {
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
      FRR: {
        type: "object",
        properties: {
          MAS: {
            type: "object",
            properties: {
              info: { type: "object" },
              data: {
                type: "object",
                properties: {
                  both: {
                    $ref: "#/$defs/frr_requirements_map",
                  },
                },
              },
            },
          },
        },
      },
      KSI: {
        type: "object",
      },
    },
    $defs: {
      frd_definition: {
        type: "object",
        properties: {
          term: { type: "string" },
          alts: { type: "array" },
          definition: { type: "string" },
          updated: { type: "array" },
        },
      },
      frr_data_label_name: {
        enum: ["CSO"],
      },
      frr_requirements_map: {
        type: "object",
        propertyNames: { $ref: "#/$defs/frr_data_label_name" },
        additionalProperties: { $ref: "#/$defs/frr_requirements_label_group" },
      },
      frr_requirements_label_group: {
        type: "object",
        patternProperties: {
          "^[A-Z]{3}-[A-Z]{3}-[A-Z0-9]{3}$": {
            type: "object",
            properties: {
              name: { type: "string" },
              statement: { type: "string" },
              primary_key_word: { type: "string" },
              affects: { type: "array" },
              terms: { type: "array" },
              updated: { type: "array" },
              fka: { type: "string" },
            },
          },
        },
      },
    },
  };

  const document = {
    info: {
      title: "Test",
      description: "Test",
      version: "1.0.0",
      last_updated: "2026-04-12",
    },
    FRD: {
      info: {},
      data: {
        both: {
          "FRD-AGY": {
            term: "agency",
            alts: ["agency"],
            definition: "Test definition",
            updated: [],
          },
        },
      },
    },
    FRR: {
      MAS: {
        info: {},
        data: {
          both: {
            CSO: {
              "MAS-CSX-TST": {
                primary_key_word: "MUST",
                statement: "Providers MUST notify an agency.",
                affects: ["Providers"],
                name: "Test requirement",
                terms: [],
                updated: [],
              },
            },
          },
        },
      },
    },
    KSI: {},
  } as unknown as RulesDocument;

  const plan = collectAutoFixPlan(document, schema);
  expect(plan).toEqual({
    definitionTermIssueCount: 1,
    termSyncIssueCount: 1,
    idIssueCount: 1,
    propertyOrderIssueCount: 1,
    needsTermsFix: true,
    needsIdsFix: true,
    needsOrderFix: true,
  });

  const result = applyAutoFixes(document, schema, { entryDate: "2026-04-19" });

  expect(result.definitionTermFixedCount).toBe(1);
  expect(result.termSyncFixedCount).toBe(1);
  expect(result.idFixedCount).toBe(1);
  expect(result.idSkippedCount).toBe(0);
  expect(result.propertyOrderFixedCount).toBe(1);
  expect(result.document.info.version).toBe("1.0.1");
  expect(result.document.info.last_updated).toBe("2026-04-19");
  expect(result.document.FRD.data.both["FRD-AGY"].term).toBe("Agency");
  expect(result.document.FRR.MAS.data.both.CSO["MAS-CSO-TST"].terms).toEqual(["Agency"]);
  expect(result.document.FRR.MAS.data.both.CSO["MAS-CSO-TST"].fka).toBe("MAS-CSX-TST");
  expect(Object.keys(result.document.FRR.MAS.data.both.CSO["MAS-CSO-TST"])).toEqual([
    "name",
    "statement",
    "primary_key_word",
    "affects",
    "terms",
    "updated",
    "fka",
  ]);
});
