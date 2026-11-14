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

test("excluded classes need no variant and reject a remaining variant, even if also added", () => {
  const document = fixture();
  const rule = document.FRR.ABC!.data.all!.CSO!["ABC-CSO-AAA"]!;
  (rule.applicability ??= {}).add = { classes: ["A", "D"] };
  (rule.applicability ??= {}).exclude = { classes: ["A", "B"] };
  expect(collectFrrClassVariantApplicabilityIssues(document)).toEqual([
    {
      location: `${location}.varies_by_class.a`,
      message:
        "Class A is excluded by applicability.exclude.classes but has a class variant. Applicable classes: C, D.",
    },
    {
      location: `${location}.varies_by_class.b`,
      message:
        "Class B is excluded by applicability.exclude.classes but has a class variant. Applicable classes: C, D.",
    },
  ]);
  delete rule.varies_by_class!.a;
  Reflect.deleteProperty(rule.varies_by_class!, "b");
  expect(collectFrrClassVariantApplicabilityIssues(document)).toEqual([]);
  delete rule.varies_by_class!.d;
  expect(
    collectFrrClassVariantApplicabilityIssues(document).map(
      (issue) => issue.location,
    ),
  ).toEqual([`${location}.varies_by_class.d`]);
});

test("class variants require every applicable subset class", () => {
  const document = fixture();
  const section = document.FRR.ABC!;
  section.info.subsets!.CSO!.applicability.classes = ["A", "B", "C", "D"];
  const variants = section.data.all!.CSO!["ABC-CSO-AAA"]!.varies_by_class!;
  delete variants.a;
  expect(collectFrrClassVariantApplicabilityIssues(document)).toEqual([
    {
      location: `${location}.varies_by_class.a`,
      message:
        "Missing class variant: Class A applies to this rule through subset applicability or applicability.add.classes.",
    },
  ]);
});

test("class variants require additional applicability classes and report all missing variants", () => {
  const document = fixture();
  const rule = document.FRR.ABC!.data.all!.CSO!["ABC-CSO-AAA"]!;
  (rule.applicability ??= {}).add = { classes: ["A", "D"] };
  delete rule.varies_by_class!.a;
  delete rule.varies_by_class!.d;
  expect(
    collectFrrClassVariantApplicabilityIssues(document).map(
      (issue) => issue.location,
    ),
  ).toEqual([`${location}.varies_by_class.a`, `${location}.varies_by_class.d`]);
});

test("missing variants use only common and matching framework applicability", () => {
  const document = fixture();
  const section = document.FRR.ABC!;
  const requirements = section.data.all!.CSO!;
  delete requirements["ABC-CSO-AAA"]!.varies_by_class!.a;
  delete requirements["ABC-CSO-AAA"]!.varies_by_class!.d;
  section.data["20x"] = { CSO: requirements };
  section.data.rev5 = { CSO: requirements };
  section.info["20x"] = {
    subsets: { CSO: { applicability: { classes: ["A"] } } },
  } as unknown as NonNullable<(typeof section.info)["20x"]>;
  expect(collectFrrClassVariantApplicabilityIssues(document)).toEqual([
    {
      location: "FRR.ABC.data.20x.CSO.ABC-CSO-AAA.varies_by_class.a",
      message:
        "Missing class variant: Class A applies to this rule through subset applicability or applicability.add.classes.",
    },
  ]);
});

test("class variants reject every class outside subset and additional applicability", () => {
  const document = fixture();
  expect(collectFrrClassVariantApplicabilityIssues(document)).toEqual([
    {
      location: `${location}.varies_by_class.a`,
      message:
        "Class A does not apply to this rule through subset applicability or applicability.add.classes. Applicable classes: B, C.",
    },
    {
      location: `${location}.varies_by_class.d`,
      message:
        "Class D does not apply to this rule through subset applicability or applicability.add.classes. Applicable classes: B, C.",
    },
  ]);
  (document.FRR.ABC!.data.all!.CSO!["ABC-CSO-AAA"]!.applicability ??= {}).add =
    {
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
  delete rule.applicability?.add;
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
      "Class A does not apply to this rule through subset applicability or applicability.add.classes. Applicable classes: B, C, D.",
  });
  expect(formatConsistencyReport(checks)).toContain(
    "FRR class-variant applicability",
  );
  expect(formatConsistencyReport(checks)).toContain(
    "FRR.MAS.data.all.CSO.MAS-CSO-IIR.varies_by_class.b: Missing class variant: Class B",
  );
});
