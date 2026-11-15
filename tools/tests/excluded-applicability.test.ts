import { expect, test } from "bun:test";
import { loadRulesDocument } from "../src/rules";
import { validateSchema } from "../src/schema-validation";
import { collectFrrClassVariantApplicabilityIssues } from "../src/consistency";

test("exclusion-only variants require no effective statement or force", () => {
  const document = loadRulesDocument();
  const section = document.FRR.MAS!;
  const rule = section.data.all!.CSO!["MAS-CSO-IIR"]!;
  section.info.subsets!.CSO!.applicability.classes = ["A", "B", "C"];
  delete rule.statement;
  delete rule.force;
  rule.varies_by_class = {
    a: { statement: "Providers MUST document resources.", force: "MUST" },
    b: { applicable: false },
    c: { applicable: false },
  };
  expect(validateSchema(document).valid).toBe(true);
  expect(
    collectFrrClassVariantApplicabilityIssues(document).filter((i) =>
      i.location.includes("MAS-CSO-IIR"),
    ),
  ).toEqual([]);
  delete rule.varies_by_class.c;
  expect(validateSchema(document).valid).toBe(false);
});
