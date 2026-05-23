import { expect, test } from "bun:test";

import {
  applyAutoFixes,
  applyDisplayNamesFix,
  applyRelatedFix,
  collectAutoFixPlan,
  collectDisplayNamesFixPlan,
  collectRelatedFixPlan,
} from "../src/fix";
import { loadRulesDocument, loadSchemaDocument } from "../src/rules";
import type { RulesDocument } from "../src/types";

test("the auto-fix planner reflects the current configured dataset", () => {
  const document = loadRulesDocument();
  const plan = collectAutoFixPlan(document, loadSchemaDocument());
  const displayNamesPlan = collectDisplayNamesFixPlan(document);
  const relatedPlan = collectRelatedFixPlan(document);

  expect(plan.definitionTermIssueCount).toBe(0);
  expect(plan.termSyncIssueCount).toBe(0);
  expect(plan.idIssueCount).toBe(0);
  expect(plan.propertyOrderIssueCount).toBe(0);
  expect(plan.needsTermsFix).toBe(false);
  expect(plan.needsIdsFix).toBe(false);
  expect(plan.needsOrderFix).toBe(false);
  expect(plan.inlineRuleDisplayNameIssueCount).toBe(
    displayNamesPlan.issueCount,
  );
  expect(plan.needsDisplayNamesFix).toBe(displayNamesPlan.needsFix);
  expect(plan.relatedRuleIssueCount).toBe(relatedPlan.issueCount);
  expect(plan.needsRelatedFix).toBe(relatedPlan.needsFix);
});

test("auto-fix applies ID, term, related, and property-order fixes in one pass", () => {
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
              all: {
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
                  all: {
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
              related: { type: "array" },
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
        all: {
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
          all: {
            CSO: {
              "MAS-CSX-TST": {
                primary_key_word: "MUST",
                statement:
                  "Providers MUST notify an agency and follow MAS-CSO-REF.",
                related: ["MAS-CSO-OLD"],
                affects: ["Providers"],
                name: "Test requirement",
                terms: [],
                updated: [],
              },
              "MAS-CSO-REF": {
                name: "Referenced requirement",
                statement: "Providers MUST retain the reference.",
                primary_key_word: "MUST",
                affects: ["Providers"],
                terms: [],
                updated: [],
              },
              "MAS-CSO-OLD": {
                name: "Existing related requirement",
                statement: "Providers MUST retain existing related entries.",
                primary_key_word: "MUST",
                affects: ["Providers"],
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
    inlineRuleDisplayNameIssueCount: 1,
    relatedRuleIssueCount: 1,
    propertyOrderIssueCount: 1,
    needsTermsFix: true,
    needsIdsFix: true,
    needsDisplayNamesFix: true,
    needsRelatedFix: true,
    needsOrderFix: true,
  });

  const result = applyAutoFixes(document, schema, { entryDate: "2026-04-19" });

  expect(result.definitionTermFixedCount).toBe(1);
  expect(result.termSyncFixedCount).toBe(1);
  expect(result.idFixedCount).toBe(1);
  expect(result.idSkippedCount).toBe(0);
  expect(result.inlineRuleDisplayNameFixedCount).toBe(1);
  expect(result.relatedRuleFixedCount).toBe(1);
  expect(result.propertyOrderFixedCount).toBe(1);
  expect(result.document.info.version).toBe("1.0.1");
  expect(result.document.info.last_updated).toBe("2026-04-19");
  expect(result.document.FRD.data.all!["FRD-AGY"]!.term).toBe("Agency");
  expect(result.document.FRR.MAS!.data.all!.CSO!["MAS-CSO-TST"]!.terms).toEqual(
    ["Agency"],
  );
  expect(
    result.document.FRR.MAS!.data.all!.CSO!["MAS-CSO-TST"]!.statement,
  ).toBe(
    "Providers MUST notify an agency and follow MAS-CSO-REF (Referenced requirement).",
  );
  expect(
    result.document.FRR.MAS!.data.all!.CSO!["MAS-CSO-TST"]!.related,
  ).toEqual(["MAS-CSO-OLD", "MAS-CSO-REF"]);
  expect(result.document.FRR.MAS!.data.all!.CSO!["MAS-CSO-TST"]!.fka).toBe(
    "MAS-CSX-TST",
  );
  expect(
    Object.keys(result.document.FRR.MAS!.data.all!.CSO!["MAS-CSO-TST"]!),
  ).toEqual([
    "name",
    "statement",
    "related",
    "primary_key_word",
    "affects",
    "terms",
    "updated",
    "fka",
  ]);
});

test("related fix adds detected rules without deleting existing related entries", () => {
  const document = {
    info: {
      title: "Test",
      description: "Test",
      version: "1.0.0",
      last_updated: "2026-04-12",
    },
    FRD: { info: {}, data: { all: {} } },
    FRR: {
      ABC: {
        info: {},
        data: {
          all: {
            CSO: {
              "ABC-CSO-AAA": {
                name: "Source Rule",
                statement: "Providers MUST follow ABC-CSO-BBB.",
                related: ["ABC-CSO-OLD"],
                primary_key_word: "MUST",
                affects: ["Providers"],
              },
              "ABC-CSO-BBB": {
                name: "Detected Rule",
                statement: "Providers MUST do the detected thing.",
                primary_key_word: "MUST",
                affects: ["Providers"],
              },
              "ABC-CSO-OLD": {
                name: "Existing Rule",
                statement: "Providers MUST do the existing thing.",
                primary_key_word: "MUST",
                affects: ["Providers"],
              },
            },
          },
        },
      },
    },
    KSI: {},
  } as unknown as RulesDocument;

  expect(collectRelatedFixPlan(document)).toEqual({
    issueCount: 1,
    needsFix: true,
  });

  const result = applyRelatedFix(document);

  expect(result.fixedCount).toBe(1);
  expect(
    result.document.FRR.ABC!.data.all!.CSO!["ABC-CSO-AAA"]!.related,
  ).toEqual(["ABC-CSO-OLD", "ABC-CSO-BBB"]);
});

test("display names fix adds parenthesized rule names and repairs unparenthesized names", () => {
  const document = {
    info: {
      title: "Test",
      description: "Test",
      version: "1.0.0",
      last_updated: "2026-04-12",
    },
    FRD: { info: {}, data: { all: {} } },
    FRR: {
      ABC: {
        info: {},
        data: {
          all: {
            CSO: {
              "ABC-CSO-AAA": {
                name: "Source Rule",
                statement:
                  "Providers MUST follow ABC-CSO-BBB and ABC-CSO-CCC Target Rule C.",
                note: "ABC-CSO-DDD (Target Rule D) is already formatted.",
                primary_key_word: "MUST",
                affects: ["Providers"],
              },
              "ABC-CSO-BBB": {
                name: "Target Rule B",
                statement: "Providers MUST do the detected thing.",
                primary_key_word: "MUST",
                affects: ["Providers"],
              },
              "ABC-CSO-CCC": {
                name: "Target Rule C",
                statement: "Providers MUST do the repaired thing.",
                primary_key_word: "MUST",
                affects: ["Providers"],
              },
              "ABC-CSO-DDD": {
                name: "Target Rule D",
                statement: "Providers MUST do the formatted thing.",
                primary_key_word: "MUST",
                affects: ["Providers"],
              },
            },
          },
        },
      },
    },
    KSI: {},
  } as unknown as RulesDocument;

  expect(collectDisplayNamesFixPlan(document)).toEqual({
    issueCount: 2,
    needsFix: true,
  });

  const result = applyDisplayNamesFix(document);

  expect(result.fixedCount).toBe(2);
  expect(
    result.document.FRR.ABC!.data.all!.CSO!["ABC-CSO-AAA"]!.statement,
  ).toBe(
    "Providers MUST follow ABC-CSO-BBB (Target Rule B) and ABC-CSO-CCC (Target Rule C).",
  );
  expect(result.document.FRR.ABC!.data.all!.CSO!["ABC-CSO-AAA"]!.note).toBe(
    "ABC-CSO-DDD (Target Rule D) is already formatted.",
  );
});
