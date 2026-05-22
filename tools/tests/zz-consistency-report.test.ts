import { expect, test } from "bun:test";

import {
  collectFrrLabelDeclarationIssues,
  collectConsistencyChecks,
  formatConsistencyReport,
} from "../src/consistency";
import { loadRulesDocument } from "../src/rules";
import type { RulesDocument } from "../src/types";

test("consistency validation report", () => {
  const checks = collectConsistencyChecks(loadRulesDocument());

  if (checks.some((check) => check.issues.length > 0)) {
    throw new Error(formatConsistencyReport(checks));
  }
});

test("FRR label declarations include certification-specific info labels", () => {
  const document = {
    FRR: {
      ABC: {
        info: {
          labels: {
            CSO: { name: "Common", description: "Common label." },
          },
          "20x": {
            labels: {
              CSX: { name: "20x", description: "20x label." },
            },
          },
          rev5: {
            labels: {
              CSF: { name: "Rev5", description: "Rev5 label." },
            },
          },
        },
        data: {
          all: {
            CSO: {},
          },
          "20x": {
            CSO: {},
            CSX: {},
          },
          rev5: {
            CSO: {},
            CSF: {},
          },
        },
      },
    },
  } as unknown as RulesDocument;

  expect(collectFrrLabelDeclarationIssues(document)).toEqual([]);
});
