import type { IdAlignmentIssue, PropertyOrderIssue, RulesDocument } from "./types";

import { collectIdAlignmentIssues, fixIdAlignment } from "./id-alignment";
import { collectPropertyOrderIssues, fixPropertyOrder } from "./property-order";
import {
  applyDefinitionTermTitleChanges,
  applyTermSync,
  collectDefinitionTermTitleChanges,
  collectTermSyncChanges,
} from "./terms";

export const FIX_SCOPES = ["auto", "terms", "ids", "order"] as const;
export type FixScope = (typeof FIX_SCOPES)[number];

export function isFixScope(value: string): value is FixScope {
  return (FIX_SCOPES as readonly string[]).includes(value);
}

export interface TermsFixPlan {
  definitionTermIssueCount: number;
  termSyncIssueCount: number;
  needsFix: boolean;
}

export interface TermsFixResult {
  document: RulesDocument;
  definitionTermFixedCount: number;
  termSyncFixedCount: number;
}

export interface IdsFixPlan {
  issueCount: number;
  needsFix: boolean;
}

export interface IdsFixResult {
  document: RulesDocument;
  issues: IdAlignmentIssue[];
  fixedCount: number;
  skippedCount: number;
}

export interface OrderFixPlan {
  issueCount: number;
  needsFix: boolean;
}

export interface OrderFixResult {
  document: RulesDocument;
  issues: PropertyOrderIssue[];
  fixedCount: number;
}

export function collectTermsFixPlan(document: RulesDocument): TermsFixPlan {
  const definitionTermIssueCount = collectDefinitionTermTitleChanges(document).length;
  const termSyncIssueCount = collectTermSyncChanges(document).length;

  return {
    definitionTermIssueCount,
    termSyncIssueCount,
    needsFix: definitionTermIssueCount > 0 || termSyncIssueCount > 0,
  };
}

export function applyTermsFix(
  document: RulesDocument,
  options?: {
    addComment?: boolean;
    entryDate?: string;
  },
): TermsFixResult {
  const definitionTermFixedCount = applyDefinitionTermTitleChanges(document).length;
  const termSyncFixedCount = applyTermSync(document, {
    addComment: options?.addComment,
    entryDate: options?.entryDate,
  }).length;

  return {
    document,
    definitionTermFixedCount,
    termSyncFixedCount,
  };
}

export function collectIdsFixPlan(document: RulesDocument): IdsFixPlan {
  const issueCount = collectIdAlignmentIssues(document).length;

  return {
    issueCount,
    needsFix: issueCount > 0,
  };
}

export function applyIdsFix(
  document: RulesDocument,
  options: {
    entryDate: string;
  },
): IdsFixResult {
  const result = fixIdAlignment(document, {
    entryDate: options.entryDate,
    updateDocument: true,
  });

  return {
    document,
    issues: result.issues,
    fixedCount: result.fixedCount,
    skippedCount: result.skippedCount,
  };
}

export function collectOrderFixPlan(document: RulesDocument, schemaDocument: unknown): OrderFixPlan {
  const issueCount = collectPropertyOrderIssues(document, schemaDocument).length;

  return {
    issueCount,
    needsFix: issueCount > 0,
  };
}

export function applyOrderFix(document: RulesDocument, schemaDocument: unknown): OrderFixResult {
  return fixPropertyOrder(document, schemaDocument);
}

export interface AutoFixPlan {
  definitionTermIssueCount: number;
  termSyncIssueCount: number;
  idIssueCount: number;
  propertyOrderIssueCount: number;
  needsTermsFix: boolean;
  needsIdsFix: boolean;
  needsOrderFix: boolean;
}

export interface AutoFixResult {
  document: RulesDocument;
  plan: AutoFixPlan;
  definitionTermFixedCount: number;
  termSyncFixedCount: number;
  idFixedCount: number;
  idSkippedCount: number;
  propertyOrderFixedCount: number;
}

export function collectAutoFixPlan(document: RulesDocument, schemaDocument: unknown): AutoFixPlan {
  const termsPlan = collectTermsFixPlan(document);
  const idsPlan = collectIdsFixPlan(document);
  const orderPlan = collectOrderFixPlan(document, schemaDocument);

  return {
    definitionTermIssueCount: termsPlan.definitionTermIssueCount,
    termSyncIssueCount: termsPlan.termSyncIssueCount,
    idIssueCount: idsPlan.issueCount,
    propertyOrderIssueCount: orderPlan.issueCount,
    needsTermsFix: termsPlan.needsFix,
    needsIdsFix: idsPlan.needsFix,
    needsOrderFix: orderPlan.needsFix,
  };
}

export function applyAutoFixes(
  document: RulesDocument,
  schemaDocument: unknown,
  options?: {
    addTermComments?: boolean;
    entryDate?: string;
  },
): AutoFixResult {
  const plan = collectAutoFixPlan(document, schemaDocument);
  const entryDate = options?.entryDate ?? document.info.last_updated;
  const addTermComments = options?.addTermComments ?? false;

  let working = document;
  let definitionTermFixedCount = 0;
  let termSyncFixedCount = 0;
  let idFixedCount = 0;
  let idSkippedCount = 0;
  let propertyOrderFixedCount = 0;

  if (plan.needsIdsFix) {
    const idResult = applyIdsFix(working, {
      entryDate,
    });
    idFixedCount = idResult.fixedCount;
    idSkippedCount = idResult.skippedCount;
  }

  if (plan.needsTermsFix) {
    const termsResult = applyTermsFix(working, {
      addComment: addTermComments,
      entryDate,
    });
    definitionTermFixedCount = termsResult.definitionTermFixedCount;
    termSyncFixedCount = termsResult.termSyncFixedCount;
  }

  if (plan.needsOrderFix) {
    const propertyOrderResult = applyOrderFix(working, schemaDocument);
    working = propertyOrderResult.document;
    propertyOrderFixedCount = propertyOrderResult.fixedCount;
  }

  return {
    document: working,
    plan,
    definitionTermFixedCount,
    termSyncFixedCount,
    idFixedCount,
    idSkippedCount,
    propertyOrderFixedCount,
  };
}
