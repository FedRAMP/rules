import { expect, test } from "bun:test";
import {
  collectConsistencyChecks,
  collectFrrClassVariantApplicabilityIssues,
  formatConsistencyReport,
} from "../src/consistency";
import { cloneDocument, loadRulesDocument } from "../src/rules";
import type { RulesDocument } from "../src/types";

function fixture() {
  return {
    FRR: {
      ABC: {
        info: { subsets: { CSO: { applicability: { classes: ["B", "C"] } } } },
        data: {
          all: {
            CSO: {
              "ABC-CSO-AAA": {
                varies_by_class: { a: {}, b: {}, c: {}, d: {} },
              },
            },
          },
        },
      },
    },
  } as unknown as RulesDocument;
}

const location = "FRR.ABC.data.all.CSO.ABC-CSO-AAA";

test("class variants reject every class outside subset and additional applicability", () => {
  const document = fixture();
  expect(collectFrrClassVariantApplicabilityIssues(document)).toEqual([
    {
      location: `${location}.varies_by_class.a`,
      message:
        "Class A does not apply to this rule through subset applicability or additional_applicability.classes. Applicable classes: B, C.",
    },
    {
      location: `${location}.varies_by_class.d`,
      message:
        "Class D does not apply to this rule through subset applicability or additional_applicability.classes. Applicable classes: B, C.",
    },
  ]);
  document.FRR.ABC!.data.all!.CSO!["ABC-CSO-AAA"]!.additional_applicability = {
    classes: ["A", "D"],
  };
  expect(collectFrrClassVariantApplicabilityIssues(document)).toEqual([]);
});

test("class variants combine common and matching framework subsets only", () => {
  const document = fixture();
  const section = document.FRR.ABC!;
  const requirements = section.data.all!.CSO!;
  section.data["20x"] = { CSO: requirements };
  section.data.rev5 = { CSO: requirements };
  section.info["20x"] = {
    subsets: { CSO: { applicability: { classes: ["A", "D"] } } },
  } as unknown as NonNullable<(typeof section.info)["20x"]>;
  expect(
    collectFrrClassVariantApplicabilityIssues(document).map(
      (issue) => issue.location,
    ),
  ).toEqual([
    `${location}.varies_by_class.a`,
    `${location}.varies_by_class.d`,
    "FRR.ABC.data.rev5.CSO.ABC-CSO-AAA.varies_by_class.a",
    "FRR.ABC.data.rev5.CSO.ABC-CSO-AAA.varies_by_class.d",
  ]);
});

test("empty class applicability rejects variants and rules without variants are ignored", () => {
  const document = fixture();
  document.FRR.ABC!.info.subsets!.CSO!.applicability.classes = [];
  expect(collectFrrClassVariantApplicabilityIssues(document)).toHaveLength(4);
  delete document.FRR.ABC!.data.all!.CSO!["ABC-CSO-AAA"]!.varies_by_class;
  expect(collectFrrClassVariantApplicabilityIssues(document)).toEqual([]);
});

test("class-variant applicability failures reach the standard consistency report", () => {
  const document = cloneDocument(loadRulesDocument());
  const section = document.FRR.MAS!;
  const rule = section.data.all!.CSO!["MAS-CSO-IIR"]!;
  delete rule.additional_applicability;
  section.info.subsets!.CSO!.applicability.classes = ["B", "C", "D"];
  Object.assign(rule, {
    varies_by_class: {
      a: { statement: "Providers MUST document resources.", force: "MUST" },
    },
  });
  const checks = collectConsistencyChecks(document);
  expect(
    checks.find((check) => check.title === "FRR class-variant applicability")
      ?.issues,
  ).toContainEqual({
    location: "FRR.MAS.data.all.CSO.MAS-CSO-IIR.varies_by_class.a",
    message:
      "Class A does not apply to this rule through subset applicability or additional_applicability.classes. Applicable classes: B, C, D.",
  });
  expect(formatConsistencyReport(checks)).toContain(
    "FRR class-variant applicability",
  );
});
