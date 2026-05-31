import { expect, test } from "bun:test";

import { validateSchema } from "../src/schema-validation";
import {
  cloneDocument,
  loadRulesDocument,
  loadSchemaDocument,
} from "../src/rules";
import { visitIndicators, visitRequirements } from "../src/traversal";
import type { RulesDocument } from "../src/types";

type MutableRuleEntity = Record<string, unknown> & {
  statement?: string;
  force?: string;
  varies_by_class?: Record<string, unknown>;
};

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

function subsetDefinition(overrides: Record<string, unknown> = {}) {
  return {
    name: "Common",
    description: "Common subset.",
    applicability: {
      types: ["20x", "Rev5"],
      paths: ["Program", "Agency"],
      classes: ["A", "B", "C", "D"],
      affects: ["Providers"],
    },
    ...overrides,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasSingleRequirementStatement(entity: MutableRuleEntity): boolean {
  return (
    typeof entity.statement === "string" &&
    typeof entity.force === "string" &&
    !isRecord(entity.varies_by_class)
  );
}

function hasSingleIndicatorStatement(entity: MutableRuleEntity): boolean {
  return (
    typeof entity.statement === "string" && !isRecord(entity.varies_by_class)
  );
}

function hasClassSpecificStatement(entity: MutableRuleEntity): boolean {
  return (
    isRecord(entity.varies_by_class) && typeof entity.statement !== "string"
  );
}

function findFrrRequirement(
  document: RulesDocument,
  predicate: (entity: MutableRuleEntity) => boolean,
  description: string,
): MutableRuleEntity {
  let match: MutableRuleEntity | undefined;

  visitRequirements(document, ({ requirement }) => {
    const entity = requirement as unknown as MutableRuleEntity;
    if (!match && predicate(entity)) {
      match = entity;
    }
  });

  if (!match) {
    throw new Error(`Expected the rules document to contain ${description}.`);
  }

  return match;
}

function findKsiIndicator(
  document: RulesDocument,
  predicate: (entity: MutableRuleEntity) => boolean,
  description: string,
): MutableRuleEntity {
  let match: MutableRuleEntity | undefined;

  visitIndicators(document, ({ indicator }) => {
    const entity = indicator as unknown as MutableRuleEntity;
    if (!match && predicate(entity)) {
      match = entity;
    }
  });

  if (!match) {
    throw new Error(`Expected the rules document to contain ${description}.`);
  }

  return match;
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

test("the schema accepts common FRR info with certification-specific subsets and flows", () => {
  const document = minimalRulesDocument();
  (document as any).FRR.ABC.info.subsets = {
    CSO: subsetDefinition(),
  };
  (document as any).FRR.ABC.info.flows = ["Common flow"];
  (document as any).FRR.ABC.info["20x"] = {
    subsets: {
      CSX: subsetDefinition({
        name: "20x",
        description: "20x subset.",
        applicability: {
          types: ["20x"],
          paths: ["Program"],
          classes: ["A", "B", "C", "D"],
          affects: ["Providers"],
        },
      }),
    },
    flows: ["20x flow"],
  };
  (document as any).FRR.ABC.info.rev5 = {
    subsets: {
      CSF: subsetDefinition({
        name: "Rev5",
        description: "Rev5 subset.",
        applicability: {
          types: ["Rev5"],
          paths: ["Program", "Agency"],
          classes: ["A", "B", "C", "D"],
          affects: ["Providers"],
        },
      }),
    },
    flows: ["Rev5 flow"],
  };

  expectSchemaAccepts(
    "FRR certification-specific subsets and flows overlay common info",
    document,
  );
});

test("the schema requires FRR subset applicability fields", () => {
  const missingApplicabilityDocument = minimalRulesDocument();
  (missingApplicabilityDocument as any).FRR.ABC.info.subsets = {
    CSO: { name: "Common", description: "Common subset." },
  };

  expectSchemaRejects(
    "FRR subset without applicability metadata",
    missingApplicabilityDocument,
  );

  const missingFieldDocument = minimalRulesDocument();
  (missingFieldDocument as any).FRR.ABC.info.subsets = {
    CSO: subsetDefinition({
      applicability: {
        types: ["20x", "Rev5"],
        paths: ["Program", "Agency"],
        affects: ["Providers"],
      },
    }),
  };

  expectSchemaRejects(
    "FRR subset applicability without classes",
    missingFieldDocument,
  );
});

test("the schema permits empty type, path, and class applicability arrays", () => {
  const document = minimalRulesDocument();
  (document as any).FRR.ABC.info.subsets = {
    IAS: subsetDefinition({
      name: "Independent Assessors",
      description: "Non-certification subset.",
      applicability: {
        types: [],
        paths: [],
        classes: [],
        affects: ["Assessors"],
      },
    }),
  };

  expectSchemaAccepts(
    "FRR subset applicability with empty non-affects arrays",
    document,
  );
});

test("the schema rejects unsupported FRR subset applicability values", () => {
  const document = minimalRulesDocument();
  (document as any).FRR.ABC.info.subsets = {
    CSO: subsetDefinition({
      applicability: {
        types: ["Rev4"],
        paths: ["Program"],
        classes: ["A"],
        affects: ["Providers"],
      },
    }),
  };

  expectSchemaRejects("FRR subset applicability with unknown type", document);
});

test("the schema requires FRR subset applicability affects to be populated", () => {
  const document = minimalRulesDocument();
  (document as any).FRR.ABC.info.subsets = {
    CSO: subsetDefinition({
      applicability: {
        types: ["20x", "Rev5"],
        paths: ["Program", "Agency"],
        classes: ["A", "B", "C", "D"],
        affects: [],
      },
    }),
  };

  expectSchemaRejects("FRR subset applicability without affects", document);
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
  const singleStatementRequirement = findFrrRequirement(
    singleStatementDocument,
    hasSingleRequirementStatement,
    "an FRR requirement with a top-level statement",
  );
  singleStatementRequirement.varies_by_class = {
    b: {
      statement: singleStatementRequirement.statement,
      force: singleStatementRequirement.force,
    },
    c: {
      statement: singleStatementRequirement.statement,
      force: singleStatementRequirement.force,
    },
  };

  expectSchemaRejects(
    "FRR branch guard for single-statement requirement with varies_by_class",
    singleStatementDocument,
  );

  const classSpecificDocument = cloneDocument(loadRulesDocument());
  findFrrRequirement(
    classSpecificDocument,
    hasClassSpecificStatement,
    "an FRR requirement with class-specific statements",
  ).statement =
    "This invalid top-level statement should not be allowed next to varies_by_class.";

  expectSchemaRejects(
    "FRR branch guard for class-specific requirement with top-level statement",
    classSpecificDocument,
  );
});

test("the schema rejects KSI indicators that mix top-level and class-specific statements", () => {
  const singleStatementDocument = cloneDocument(loadRulesDocument());
  findKsiIndicator(
    singleStatementDocument,
    hasSingleIndicatorStatement,
    "a KSI indicator with a top-level statement",
  ).varies_by_class = {
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
  findKsiIndicator(
    classSpecificDocument,
    hasClassSpecificStatement,
    "a KSI indicator with class-specific statements",
  ).statement =
    "This invalid top-level statement should not be allowed next to varies_by_class.";

  expectSchemaRejects(
    "KSI branch guard for class-specific indicator with top-level statement",
    classSpecificDocument,
  );
});
