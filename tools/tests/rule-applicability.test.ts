import { expect, test } from "bun:test";
import { loadRulesDocument } from "../src/rules";
import { validateSchema } from "../src/schema-validation";

test("FRR class applicability accepts optional booleans and rejects malformed or legacy metadata", () => {
  const document = loadRulesDocument();
  const rule = document.FRR.MAS!.data.all!.CSO!["MAS-CSO-IIR"]!;
  rule.statement = "Providers MUST act.";
  rule.force = "MUST";
  for (const applicable of [true, false]) {
    Object.assign(rule, { varies_by_class: { a: { applicable } } });
    expect(validateSchema(document).valid).toBe(true);
  }
  rule.varies_by_class = { a: { note: "Inherit subset applicability" } };
  expect(validateSchema(document).valid).toBe(true);
  for (const applicable of [null, "", "true", "false", 0, 1, {}, [], { add: true }]) {
    Object.assign(rule, { varies_by_class: { a: { applicable } } });
    expect(validateSchema(document).valid).toBe(false);
  }
  for (const applicability of [{ add: true }, { exclude: true }]) {
    Object.assign(rule, { varies_by_class: { a: { applicability } } });
    expect(validateSchema(document).valid).toBe(false);
  }
  delete rule.varies_by_class;
  for (const key of [
    "applicability",
    "additional_applicability",
    "excluded_applicability",
  ]) {
    Object.assign(rule, { [key]: { add: { classes: ["A"] } } });
    expect(validateSchema(document).valid).toBe(false);
    Reflect.deleteProperty(rule, key);
  }
});

test("KSI and CTL do not yet permit class applicability", () => {
  for (const section of ["KSI", "CTL"]) {
    const document = loadRulesDocument();
    const entry =
      section === "KSI"
        ? Object.values(Object.values(document.KSI)[0]!.indicators)[0]!
        : Object.values(Object.values(document.CTL!)[0]!)[0]!;
    Object.assign(entry, {
      varies_by_class: { b: { applicable: false } },
    });
    expect(validateSchema(document).valid).toBe(false);
  }
});
