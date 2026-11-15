import { expect, test } from "bun:test";
import {
  collectConsistencyChecks,
  collectFrrClassVariantApplicabilityIssues,
  formatConsistencyReport,
} from "../src/consistency";
import { loadRulesDocument } from "../src/rules";
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
                statement: "Providers MUST act.",
                force: "MUST",
                varies_by_class: { b: { note: "B note" } },
              },
            },
          },
        },
      },
    },
  } as unknown as RulesDocument;
}
const location = "FRR.ABC.data.all.CSO.ABC-CSO-AAA";

test("partial and absent variants inherit common statement and force", () => {
  expect(collectFrrClassVariantApplicabilityIssues(fixture())).toEqual([]);
});

test("missing effective content is reported for every applicable class", () => {
  const d = fixture();
  const r = d.FRR.ABC!.data.all!.CSO!["ABC-CSO-AAA"]!;
  delete r.statement;
  r.varies_by_class = {
    b: { statement: "B" },
    a: { applicable: true },
  };
  expect(
    collectFrrClassVariantApplicabilityIssues(d)
      .map((i) => i.location)
      .sort(),
  ).toEqual([`${location}.varies_by_class.a`, `${location}.varies_by_class.c`]);
  r.varies_by_class.c = { applicable: false };
  expect(
    collectFrrClassVariantApplicabilityIssues(d).map((i) => i.location),
  ).toEqual([`${location}.varies_by_class.a`]);
});

test("common and matching framework subsets determine required effective content", () => {
  const d = fixture();
  const section = d.FRR.ABC!;
  const rules = section.data.all!.CSO!;
  section.data["20x"] = { CSO: rules };
  section.data.rev5 = { CSO: rules };
  section.info["20x"] = {
    subsets: { CSO: { applicability: { classes: ["A"] } } },
  } as any;
  delete rules["ABC-CSO-AAA"]!.statement;
  rules["ABC-CSO-AAA"]!.varies_by_class = {
    b: { statement: "B" },
    c: { statement: "C" },
  };
  expect(
    collectFrrClassVariantApplicabilityIssues(d).map((i) => i.location),
  ).toEqual(["FRR.ABC.data.20x.CSO.ABC-CSO-AAA.varies_by_class.a"]);
});

test("excluded and inapplicable content is retained without requiring a complete variant", () => {
  const d = fixture();
  const r = d.FRR.ABC!.data.all!.CSO!["ABC-CSO-AAA"]!;
  delete r.statement;
  delete r.force;
  r.varies_by_class = {
    a: { note: "Retained" },
    b: { applicable: false },
    c: { applicable: false },
  };
  expect(collectFrrClassVariantApplicabilityIssues(d)).toEqual([]);
});

test("effective content failures reach the consistency report", () => {
  const d = loadRulesDocument();
  const r = d.FRR.MAS!.data.all!.CSO!["MAS-CSO-IIR"]!;
  delete r.statement;
  delete r.varies_by_class;
  const checks = collectConsistencyChecks(d);
  expect(formatConsistencyReport(checks)).toContain(
    "has no effective statement after inheritance",
  );
});
