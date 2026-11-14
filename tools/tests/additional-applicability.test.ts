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
  const rule = { additional_applicability: { classes: ["A", "B"] } };
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
        "FRR.ABC.data.all.CSO.ABC-CSO-AAA.additional_applicability.classes[1]",
      message:
        'additional applicability value "B" is redundant with FRR.ABC.info.subsets.CSO.applicability.classes.',
    },
  ]);
});

test("additional applicability checks every dimension and permits new values or an absent field", () => {
  const document = fixture();
  const rule = document.FRR.ABC!.data.all!.CSO!["ABC-CSO-AAA"]!;
  rule.additional_applicability = {
    types: ["20x"],
    paths: ["Program"],
    classes: ["A", "B"],
    affects: ["Providers"],
  };
  expect(
    collectFrrAdditionalApplicabilityIssues(document).map(
      (issue) => issue.location,
    ),
  ).toEqual([
    "FRR.ABC.data.all.CSO.ABC-CSO-AAA.additional_applicability.types[0]",
    "FRR.ABC.data.all.CSO.ABC-CSO-AAA.additional_applicability.paths[0]",
    "FRR.ABC.data.all.CSO.ABC-CSO-AAA.additional_applicability.classes[1]",
    "FRR.ABC.data.all.CSO.ABC-CSO-AAA.additional_applicability.affects[0]",
  ]);
  rule.additional_applicability = {
    types: ["Rev5"],
    paths: ["Agency"],
    classes: ["A"],
    affects: ["Agencies"],
  };
  expect(collectFrrAdditionalApplicabilityIssues(document)).toEqual([]);
  delete rule.additional_applicability;
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
    "FRR.ABC.data.20x.CSO.ABC-CSO-AAA.additional_applicability.classes[1]",
  ]);
  section.info.rev5 = { subsets: { CSO: subset } } as NonNullable<
    typeof section.info.rev5
  >;
  expect(collectFrrAdditionalApplicabilityIssues(document)).toHaveLength(2);
});

test("redundant additional applicability reaches the standard consistency report", () => {
  const document = cloneDocument(loadRulesDocument());
  const section = document.FRR.MAS!;
  section.data.all!.CSO!["MAS-CSO-IIR"]!.additional_applicability = {
    classes: ["A"],
  };
  section.info.subsets!.CSO!.applicability.classes = ["A", "B", "C", "D"];
  const checks = collectConsistencyChecks(document);
  const check = checks.find(
    (check) => check.title === "FRR additional applicability redundancy",
  );
  expect(check?.issues).toContainEqual({
    location:
      "FRR.MAS.data.all.CSO.MAS-CSO-IIR.additional_applicability.classes[0]",
    message:
      'additional applicability value "A" is redundant with FRR.MAS.info.subsets.CSO.applicability.classes.',
  });
  expect(formatConsistencyReport(checks)).toContain(
    "FRR additional applicability redundancy",
  );
});
