import { expect, test } from "bun:test";
import { loadRulesDocument, loadSchemaDocument } from "../src/rules";
import { validateSchema } from "../src/schema-validation";
import { collectFrrClassVariantApplicabilityIssues } from "../src/consistency";

test("FRR variants can omit excluded B and C classes while retaining an applicable variant", () => {
  const document = loadRulesDocument();
  const schema = loadSchemaDocument();
  const section = document.FRR.MAS!;
  const rule = section.data.all!.CSO!["MAS-CSO-IIR"]!;
  section.info.subsets!.CSO!.applicability.classes = ["A", "B", "C"];
  delete rule.statement;
  delete rule.force;
  delete rule.applicability?.add;
  (rule.applicability ??= {}).exclude = { classes: ["B", "C"] };
  rule.varies_by_class = {
    a: { statement: "Providers MUST document resources.", force: "MUST" },
  };
  expect(validateSchema(document, schema).valid).toBe(true);
  expect(
    collectFrrClassVariantApplicabilityIssues(document).filter((issue) =>
      issue.location.includes("MAS-CSO-IIR"),
    ),
  ).toEqual([]);
  Object.assign(rule, { varies_by_class: {} });
  expect(validateSchema(document, schema).valid).toBe(false);
});

test("excluded applicability accepts controlled values and rejects malformed exclusions", () => {
  const document = loadRulesDocument();
  const schema = loadSchemaDocument();
  const rule = document.FRR.MAS!.data.all!.CSO!["MAS-CSO-IIR"]!;
  for (const value of [
    { types: ["20x"] },
    { paths: ["Agency"] },
    { classes: ["A"] },
    { affects: ["Providers"] },
    {
      types: ["Rev5"],
      paths: ["Program"],
      classes: ["D"],
      affects: ["Agencies"],
    },
  ]) {
    Object.assign(rule, { applicability: { exclude: value } });
    expect(validateSchema(document, schema).valid).toBe(true);
  }
  for (const value of [
    {},
    { unknown: ["A"] },
    { classes: "A" },
    ...["types", "paths", "classes", "affects"].flatMap((key) => [
      { [key]: [] },
      { [key]: ["invalid"] },
    ]),
    { classes: ["A", "A"] },
  ]) {
    Object.assign(rule, { applicability: { exclude: value } });
    expect(validateSchema(document, schema).valid).toBe(false);
  }
});
