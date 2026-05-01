import { expect, test } from "bun:test";

import { validateSchema } from "../src/schema-validation";
import { cloneDocument, loadRulesDocument, loadSchemaDocument } from "../src/rules";
import type { RulesDocument } from "../src/types";

test("the consolidated rules document matches the configured schema", () => {
  const result = validateSchema();

  if (!result.valid) {
    throw new Error(
      [
        "The consolidated rules document does not match the schema:",
        ...result.humanReadableErrors.map((error) => `- ${error}`),
      ].join("\n"),
    );
  }

  expect(result.valid).toBe(true);
});

function expectSchemaRejects(title: string, document: RulesDocument): void {
  const result = validateSchema(document, loadSchemaDocument());

  if (result.valid) {
    throw new Error(
      `${title}: schema accepted an invalid document. Entries must use either top-level statement/primary_key_word or varies_by_class, but not both.`,
    );
  }

  expect(result.valid).toBe(false);
}

test("the schema rejects FRR requirements that mix top-level and class-specific statements", () => {
  const singleStatementDocument = cloneDocument(loadRulesDocument());
  const singleStatementRequirement =
    (singleStatementDocument as any).FRR.MAS.data.both.CSO["MAS-CSO-FLO"];
  singleStatementRequirement.varies_by_class = {
    b: {
      statement: singleStatementRequirement.statement,
      primary_key_word: singleStatementRequirement.primary_key_word,
    },
    c: {
      statement: singleStatementRequirement.statement,
      primary_key_word: singleStatementRequirement.primary_key_word,
    },
  };

  expectSchemaRejects(
    "FRR branch guard for single-statement requirement with varies_by_class",
    singleStatementDocument,
  );

  const classSpecificDocument = cloneDocument(loadRulesDocument());
  (classSpecificDocument as any).FRR.FRC.data["20x"].CSX["FRC-CSX-PMV"].statement =
    "This invalid top-level statement should not be allowed next to varies_by_class.";

  expectSchemaRejects(
    "FRR branch guard for class-specific requirement with top-level statement",
    classSpecificDocument,
  );
});

test("the schema rejects KSI indicators that mix top-level and class-specific statements", () => {
  const singleStatementDocument = cloneDocument(loadRulesDocument());
  (singleStatementDocument as any).KSI.CMT.indicators["KSI-CMT-LMC"].varies_by_class = {
    b: {
      statement: "This invalid class-specific statement should not be allowed next to a top-level statement.",
    },
    c: {
      statement: "This invalid class-specific statement should not be allowed next to a top-level statement.",
    },
  };

  expectSchemaRejects(
    "KSI branch guard for single-statement indicator with varies_by_class",
    singleStatementDocument,
  );

  const classSpecificDocument = cloneDocument(loadRulesDocument());
  (classSpecificDocument as any).KSI.CNA.indicators["KSI-CNA-EIS"].statement =
    "This invalid top-level statement should not be allowed next to varies_by_class.";

  expectSchemaRejects(
    "KSI branch guard for class-specific indicator with top-level statement",
    classSpecificDocument,
  );
});
