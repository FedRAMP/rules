import { expect, test } from "bun:test";
import { loadRulesDocument, loadSchemaDocument } from "../src/rules";
import { validateSchema } from "../src/schema-validation";

test("rule applicability supports add, exclude, both, or no override", () => {
  const document = loadRulesDocument();
  const schema = loadSchemaDocument();
  const rule = document.FRR.MAS!.data.all!.CSO!["MAS-CSO-IIR"]!;
  delete rule.applicability;
  expect(validateSchema(document, schema).valid).toBe(true);
  for (const applicability of [
    { add: { classes: ["A"] } },
    { exclude: { types: ["Rev5"] } },
    {
      add: {
        classes: ["A"],
        types: ["20x"],
        paths: ["Agency"],
        affects: ["Agencies"],
      },
      exclude: {
        classes: ["D"],
        types: ["Rev5"],
        paths: ["Program"],
        affects: ["Providers"],
      },
    },
  ]) {
    Object.assign(rule, { applicability });
    expect(validateSchema(document, schema).valid).toBe(true);
  }
});

test("rule applicability rejects empty, malformed, and legacy shapes", () => {
  const document = loadRulesDocument();
  const schema = loadSchemaDocument();
  const rule = document.FRR.MAS!.data.all!.CSO!["MAS-CSO-IIR"]!;
  for (const applicability of [
    {},
    [],
    null,
    { classes: ["A"] },
    { add: {} },
    { exclude: {} },
    { add: { classes: ["a"] } },
    { add: { classes: [] } },
    { add: { classes: ["A", "A"] } },
    { add: { unknown: ["A"] } },
    { add: { classes: ["A"] }, unknown: {} },
  ]) {
    Object.assign(rule, { applicability });
    expect(validateSchema(document, schema).valid).toBe(false);
  }
  delete rule.applicability;
  for (const key of ["additional_applicability", "excluded_applicability"]) {
    Object.assign(rule, { [key]: { classes: ["A"] } });
    expect(validateSchema(document, schema).valid).toBe(false);
    Reflect.deleteProperty(rule, key);
  }
});
