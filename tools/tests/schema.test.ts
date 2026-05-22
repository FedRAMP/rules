import { expect, test } from "bun:test";

import { validateSchema } from "../src/schema-validation";
import {
  cloneDocument,
  loadRulesDocument,
  loadSchemaDocument,
} from "../src/rules";
import type { RulesDocument } from "../src/types";

function effectiveEntry() {
  return {
    is: "required",
    current_status: "Test status",
    date: {
      obtain: "2026-01-01",
      maintain: "2026-01-01",
      grace_ends: "2026-07-01",
    },
  };
}

function minimalRulesDocument(): RulesDocument {
  return {
    info: {
      title: "Test Rules",
      description: "Minimal schema fixture.",
      version: "2026.01.01-test",
      last_updated: "2026-01-01",
    },
    FRD: {
      info: {
        name: "FedRAMP Definitions",
        short_name: "FRD",
        web_name: "definitions",
        purpose: "Define terms.",
        status: "stable",
        effective: effectiveEntry(),
      },
      data: {
        all: {},
      },
    },
    FRR: {
      ABC: {
        info: {
          name: "Example Rules",
          short_name: "ABC",
          web_name: "example-rules",
          purpose: "Exercise schema rules.",
          status: "stable",
          effective: effectiveEntry(),
        },
        data: {},
      },
    },
    KSI: {},
  } as RulesDocument;
}

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

function expectSchemaAccepts(title: string, document: RulesDocument): void {
  const result = validateSchema(document, loadSchemaDocument());

  if (!result.valid) {
    throw new Error(
      [
        `${title}: schema rejected a valid document.`,
        ...result.humanReadableErrors.map((error) => `- ${error}`),
      ].join("\n"),
    );
  }

  expect(result.valid).toBe(true);
}

function expectSchemaRejects(
  title: string,
  document: RulesDocument,
  details = "schema accepted an invalid document.",
): void {
  const result = validateSchema(document, loadSchemaDocument());

  if (result.valid) {
    throw new Error(`${title}: ${details}`);
  }

  expect(result.valid).toBe(false);
}

test("the schema accepts common FRR info with certification-specific labels and flows", () => {
  const document = minimalRulesDocument();
  (document as any).FRR.ABC.info.labels = {
    CSO: { name: "Common", description: "Common label." },
  };
  (document as any).FRR.ABC.info.flows = ["Common flow"];
  (document as any).FRR.ABC.info["20x"] = {
    labels: {
      CSX: { name: "20x", description: "20x label." },
    },
    flows: ["20x flow"],
  };
  (document as any).FRR.ABC.info.rev5 = {
    labels: {
      CSF: { name: "Rev5", description: "Rev5 label." },
    },
    flows: ["Rev5 flow"],
  };

  expectSchemaAccepts(
    "FRR certification-specific labels and flows overlay common info",
    document,
  );
});

test("the schema requires certification-specific effective entries to be paired", () => {
  const document = minimalRulesDocument();
  delete (document as any).FRR.ABC.info.effective;
  (document as any).FRR.ABC.info["20x"] = {
    effective: effectiveEntry(),
  };

  expectSchemaRejects(
    "FRR certification-specific effective without rev5 counterpart",
    document,
  );
});

test("the schema rejects mixed common and certification-specific effective entries", () => {
  const document = minimalRulesDocument();
  (document as any).FRR.ABC.info["20x"] = {
    effective: effectiveEntry(),
  };
  (document as any).FRR.ABC.info.rev5 = {
    effective: effectiveEntry(),
  };

  expectSchemaRejects(
    "FRR common effective mixed with certification-specific effective",
    document,
  );
});

test("the schema keeps common-only info properties out of certification blocks", () => {
  const document = minimalRulesDocument();
  (document as any).FRR.ABC.info["20x"] = {
    status: "stable",
  };

  expectSchemaRejects(
    "FRR certification block with common-only status",
    document,
  );
});

test("the schema rejects FRR requirements that mix top-level and class-specific statements", () => {
  const singleStatementDocument = cloneDocument(loadRulesDocument());
  const singleStatementRequirement = (singleStatementDocument as any).FRR.MAS
    .data.all.CSO["MAS-CSO-FLO"];
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
  (classSpecificDocument as any).FRR.FRC.data["20x"].CSX[
    "FRC-CSX-PMV"
  ].statement =
    "This invalid top-level statement should not be allowed next to varies_by_class.";

  expectSchemaRejects(
    "FRR branch guard for class-specific requirement with top-level statement",
    classSpecificDocument,
  );
});

test("the schema rejects KSI indicators that mix top-level and class-specific statements", () => {
  const singleStatementDocument = cloneDocument(loadRulesDocument());
  (singleStatementDocument as any).KSI.CMT.indicators[
    "KSI-CMT-LMC"
  ].varies_by_class = {
    b: {
      statement:
        "This invalid class-specific statement should not be allowed next to a top-level statement.",
    },
    c: {
      statement:
        "This invalid class-specific statement should not be allowed next to a top-level statement.",
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
