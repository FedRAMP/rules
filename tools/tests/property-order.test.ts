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

test("property order fixes sort FRD shared definitions by term instead of ID", () => {
  const document = {
    FRD: {
      data: {
        both: {
          "FRD-AAA": {
            term: "Zeta Term",
            definition: "Zeta definition",
            alts: [],
            updated: [],
          },
          "FRD-MMM": {
            term: "Middle Term",
            definition: "Middle definition",
            alts: [],
            updated: [],
          },
          "FRD-ZZZ": {
            term: "Alpha Term",
            definition: "Alpha definition",
            alts: [],
            updated: [],
          },
        },
      },
    },
  } as unknown as RulesDocument;

  const schema = loadSchemaDocument();
  const checkIssues = collectPropertyOrderIssues(document, schema);
  expect(checkIssues).toEqual([
    {
      path: "FRD.data.both",
      actualOrder: ["FRD-AAA", "FRD-MMM", "FRD-ZZZ"],
      expectedOrder: ["FRD-ZZZ", "FRD-MMM", "FRD-AAA"],
    },
  ]);

  const fixed = fixPropertyOrder(document, schema);
  expect(fixed.fixedCount).toBe(1);
  expect(Object.keys(fixed.document.FRD.data.both)).toEqual(["FRD-ZZZ", "FRD-MMM", "FRD-AAA"]);
});

test("property order fixes use schema propertyNames enum order for FRR labels and label groups", () => {
  const schema = {
    type: "object",
    properties: {
      FRR: {
        type: "object",
        properties: {
          ABC: {
            type: "object",
            properties: {
              info: {
                type: "object",
                properties: {
                  labels: {
                    type: "object",
                    propertyNames: { $ref: "#/$defs/frr_info_label_name" },
                    additionalProperties: { $ref: "#/$defs/frr_label_definition" },
                  },
                },
              },
              data: {
                type: "object",
                properties: {
                  both: { $ref: "#/$defs/frr_requirements_map" },
                },
              },
            },
          },
        },
      },
    },
    $defs: {
      frr_data_label_name: {
        enum: ["FRP", "CSO", "CSX", "UTC"],
      },
      frr_info_label_name: {
        anyOf: [{ $ref: "#/$defs/frr_data_label_name" }, { const: "IAL" }],
      },
      frr_label_definition: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
        },
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
            },
          },
        },
      },
    },
  };

  const document = {
    FRR: {
      ABC: {
        info: {
          labels: {
            IAL: { name: "IAL", description: "Identity assurance level" },
            CSX: { name: "CSX", description: "Customer experience" },
            FRP: { name: "FRP", description: "FedRAMP prioritization" },
            UTC: { name: "UTC", description: "Timing" },
          },
        },
        data: {
          both: {
            UTC: {
              "ABC-UTC-001": { name: "UTC rule" },
            },
            FRP: {
              "ABC-FRP-001": { name: "FRP rule" },
            },
            CSX: {
              "ABC-CSX-001": { name: "CSX rule" },
            },
          },
        },
      },
    },
  } as unknown as RulesDocument;

  const checkIssues = collectPropertyOrderIssues(document, schema);
  expect(checkIssues).toEqual([
    {
      path: "FRR.ABC.info.labels",
      actualOrder: ["IAL", "CSX", "FRP", "UTC"],
      expectedOrder: ["FRP", "CSX", "UTC", "IAL"],
    },
    {
      path: "FRR.ABC.data.both",
      actualOrder: ["UTC", "FRP", "CSX"],
      expectedOrder: ["FRP", "CSX", "UTC"],
    },
  ]);

  const fixed = fixPropertyOrder(document, schema);
  expect(fixed.fixedCount).toBe(2);
  expect(Object.keys(fixed.document.FRR.ABC.info.labels)).toEqual(["FRP", "CSX", "UTC", "IAL"]);
  expect(Object.keys(fixed.document.FRR.ABC.data.both)).toEqual(["FRP", "CSX", "UTC"]);
});

test("property order fixes follow schema order for referenced data containers", () => {
  const schema = {
    type: "object",
    properties: {
      FRR: {
        type: "object",
        patternProperties: {
          "^[A-Z]{3}$": {
            type: "object",
            properties: {
              info: {
                type: "object",
                properties: {
                  effective: {
                    type: "object",
                    properties: {
                      rev5: { type: "string" },
                      "20x": { type: "string" },
                    },
                  },
                },
              },
              data: { $ref: "#/$defs/data_container_frr" },
            },
          },
        },
      },
    },
    $defs: {
      data_container_frd: {
        type: "object",
        properties: {
          both: { type: "object" },
          "20x": { type: "object" },
          rev5: { type: "object" },
        },
      },
      data_container_frr: {
        type: "object",
        properties: {
          both: { type: "object" },
          "20x": { type: "object" },
          rev5: { type: "object" },
        },
      },
    },
  };

  const document = {
    FRR: {
      ABC: {
        info: {
          effective: {
            rev5: "2024-01-01",
            "20x": "2025-01-01",
          },
        },
        data: {
          rev5: {},
          both: {},
          "20x": {},
        },
      },
    },
  } as unknown as RulesDocument;

  const checkIssues = collectPropertyOrderIssues(document, schema);
  expect(checkIssues).toEqual([
    {
      path: "FRR.ABC.data",
      actualOrder: ["rev5", "both", "20x"],
      expectedOrder: ["both", "20x", "rev5"],
    },
  ]);

  const fixed = fixPropertyOrder(document, schema);
  expect(fixed.fixedCount).toBe(1);
  expect(Object.keys(fixed.document.FRR.ABC.data)).toEqual(["both", "20x", "rev5"]);
  expect(Object.keys(fixed.document.FRR.ABC.info.effective)).toEqual(["rev5", "20x"]);
});
