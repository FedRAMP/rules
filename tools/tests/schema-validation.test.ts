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
