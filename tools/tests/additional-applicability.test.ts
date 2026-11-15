import { expect, test } from "bun:test";
import {
  collectConsistencyChecks,
  collectFrrAdditionalApplicabilityIssues,
  formatConsistencyReport,
} from "../src/consistency";
import { cloneDocument, loadRulesDocument } from "../src/rules";
import type { RulesDocument } from "../src/types";

function fixture() {
  const subset = {
    name: "Providers",
    description: "Provider rules",
    applicability: {
      types: ["20x"],
      paths: ["Program"],
      classes: ["B", "C", "D"],
      affects: ["Providers"],
    },
  };
  const rule = {
    varies_by_class: {
      a: { applicable: true },
      b: { applicable: true },
    },
  };
  return {
    FRR: {
      ABC: {
        info: { subsets: { CSO: subset } },
        data: { all: { CSO: { "ABC-CSO-AAA": rule } } },
      },
    },
  } as unknown as RulesDocument;
}

test("additional applicability reports overlapping values even alongside new values", () => {
  expect(collectFrrAdditionalApplicabilityIssues(fixture())).toEqual([
    {
      location:
        "FRR.ABC.data.all.CSO.ABC-CSO-AAA.varies_by_class.b.applicable",
      message: "Class B is already included by subset applicability.",
    },
  ]);
});

test("class additions permit new values or no override", () => {
  const document = fixture();
  const rule = document.FRR.ABC!.data.all!.CSO!["ABC-CSO-AAA"]!;
  rule.varies_by_class = { a: { applicable: true } };
  expect(collectFrrAdditionalApplicabilityIssues(document)).toEqual([]);
  delete rule.varies_by_class;
  expect(collectFrrAdditionalApplicabilityIssues(document)).toEqual([]);
});

test("additional applicability uses common and matching framework subsets only", () => {
  const document = fixture();
  const section = document.FRR.ABC!;
  const subset = section.info.subsets!.CSO!;
  const requirements = section.data.all!.CSO!;
  section.data = {
    all: { CSO: requirements },
    "20x": { CSO: requirements },
    rev5: { CSO: requirements },
  };
  expect(collectFrrAdditionalApplicabilityIssues(document)).toHaveLength(3);
  delete section.info.subsets;
  section.info["20x"] = { subsets: { CSO: subset } } as NonNullable<
    (typeof section.info)["20x"]
  >;
  expect(
    collectFrrAdditionalApplicabilityIssues(document).map(
      (issue) => issue.location,
    ),
  ).toEqual([
    "FRR.ABC.data.20x.CSO.ABC-CSO-AAA.varies_by_class.b.applicable",
  ]);
  section.info.rev5 = { subsets: { CSO: subset } } as NonNullable<
    typeof section.info.rev5
  >;
  expect(collectFrrAdditionalApplicabilityIssues(document)).toHaveLength(2);
});

test("redundant additional applicability reaches the standard consistency report", () => {
  const document = cloneDocument(loadRulesDocument());
  const section = document.FRR.MAS!;
  section.data.all!.CSO!["MAS-CSO-IIR"]!.varies_by_class = {
    a: { applicable: true },
  };
  section.info.subsets!.CSO!.applicability.classes = ["A", "B", "C", "D"];
  const checks = collectConsistencyChecks(document);
  const check = checks.find(
    (check) => check.title === "FRR additional applicability redundancy",
  );
  expect(check?.issues).toContainEqual({
    location:
      "FRR.MAS.data.all.CSO.MAS-CSO-IIR.varies_by_class.a.applicable",
    message: "Class A is already included by subset applicability.",
  });
  expect(formatConsistencyReport(checks)).toContain(
    "FRR additional applicability redundancy",
  );
});
