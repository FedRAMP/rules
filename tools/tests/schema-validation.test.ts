import { expect, test } from "bun:test";
import type { ErrorObject } from "ajv";

import { formatSchemaErrors } from "../src/schema-validation";

test("schema errors include the full document location", () => {
  const errors: ErrorObject[] = [
    {
      instancePath: "/FRR/MAS/info",
      schemaPath: "#/$defs/frr_document_info/required",
      keyword: "required",
      params: { missingProperty: "labels" },
      message: "must have required property 'labels'",
    },
  ];

  expect(formatSchemaErrors(errors, {})).toEqual([
    "FRR.MAS.info is missing required property labels.",
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

test("notes array with fewer than 2 entries in FRD definition fails validation", () => {
  const errors: ErrorObject[] = [
    {
      instancePath: "/FRD/data/both/FRD-ACV/notes",
      schemaPath: "#/$defs/frd_definition/properties/notes/minItems",
      keyword: "minItems",
      params: { limit: 2 },
      message: "must have at least 2 items",
    },
  ];

  expect(formatSchemaErrors(errors, {})).toEqual([
    "FRD.data.both.FRD-ACV.notes must have at least 2 items.",
  ]);
});

test("notes array with fewer than 2 entries in FRR requirement fails validation", () => {
  const errors: ErrorObject[] = [
    {
      instancePath: "/FRR/MAS/data/both/MAS-CSO-CNT-010/notes",
      schemaPath: "#/$defs/frr_requirement/properties/notes/minItems",
      keyword: "minItems",
      params: { limit: 2 },
      message: "must have at least 2 items",
    },
  ];

  expect(formatSchemaErrors(errors, {})).toEqual([
    "FRR.MAS.data.both.MAS-CSO-CNT-010.notes must have at least 2 items.",
  ]);
});
