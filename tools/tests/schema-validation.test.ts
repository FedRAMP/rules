import { expect, test } from "bun:test";
import type { ErrorObject } from "ajv";

import { formatSchemaErrors } from "../src/schema-validation";

test("schema errors include the full document location", () => {
  const errors: ErrorObject[] = [
    {
      instancePath: "/FRR/MAS/info",
      schemaPath: "#/$defs/frr_document_info/required",
      keyword: "required",
      params: { missingProperty: "subsets" },
      message: "must have required property 'subsets'",
    },
  ];

  expect(formatSchemaErrors(errors, {})).toEqual([
    "FRR.MAS.info is missing required property subsets.",
  ]);
});

test("root schema errors still identify the full document", () => {
  const errors: ErrorObject[] = [
    {
      instancePath: "",
      schemaPath: "#/required",
      keyword: "required",
      params: { missingProperty: "FRR" },
      message: "must have required property 'FRR'",
    },
  ];

  expect(formatSchemaErrors(errors, {})).toEqual([
    "Document is missing required property FRR.",
  ]);
});

test("property name errors identify the invalid keys and allowed names", () => {
  const errors: ErrorObject[] = [
    {
      instancePath: "/FRR/FRC/info/subsets",
      schemaPath: "#/$defs/frr_data_subset_name/enum",
      keyword: "enum",
      params: { allowedValues: ["FRP", "CSO", "TRF"] },
      message: "must be equal to one of the allowed values",
    },
    {
      instancePath: "/FRR/FRC/info/subsets",
      schemaPath: "#/anyOf",
      keyword: "anyOf",
      params: {},
      message: "must match a schema in anyOf",
    },
    {
      instancePath: "/FRR/FRC/info/subsets",
      schemaPath: "#/properties/subsets/propertyNames",
      keyword: "propertyNames",
      params: { propertyName: "CLA" },
      message: "property name must be valid",
    },
    {
      instancePath: "/FRR/FRC/info/subsets",
      schemaPath: "#/$defs/frr_data_subset_name/enum",
      keyword: "enum",
      params: { allowedValues: ["FRP", "CSO", "TRF"] },
      message: "must be equal to one of the allowed values",
    },
    {
      instancePath: "/FRR/FRC/info/subsets",
      schemaPath: "#/properties/subsets/propertyNames",
      keyword: "propertyNames",
      params: { propertyName: "APP" },
      message: "property name must be valid",
    },
  ];

  expect(formatSchemaErrors(errors, {})).toEqual([
    "FRR.FRC.info.subsets has invalid property names: CLA, APP. Allowed names are: FRP, CSO, TRF.",
  ]);
});

test("notes array with fewer than 2 entries in FRD definition fails validation", () => {
  const errors: ErrorObject[] = [
    {
      instancePath: "/FRD/data/all/FRD-ACV/notes",
      schemaPath: "#/$defs/frd_definition/properties/notes/minItems",
      keyword: "minItems",
      params: { limit: 2 },
      message: "must have at least 2 items",
    },
  ];

  expect(formatSchemaErrors(errors, {})).toEqual([
    "FRD.data.all.FRD-ACV.notes must have at least 2 items.",
  ]);
});

test("notes array with fewer than 2 entries in FRR requirement fails validation", () => {
  const errors: ErrorObject[] = [
    {
      instancePath: "/FRR/MAS/data/all/MAS-CSO-CNT-010/notes",
      schemaPath: "#/$defs/frr_requirement/properties/notes/minItems",
      keyword: "minItems",
      params: { limit: 2 },
      message: "must have at least 2 items",
    },
  ];

  expect(formatSchemaErrors(errors, {})).toEqual([
    "FRR.MAS.data.all.MAS-CSO-CNT-010.notes must have at least 2 items.",
  ]);
});
