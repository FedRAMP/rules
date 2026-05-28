import type {
  IdAlignmentIssue,
  PropertyOrderIssue,
  RulesDocument,
} from "./types";

import {
  applyFrrSubsetApplicabilityAffectsFixes,
  applyInlineRuleDisplayNameFixes,
  applyRelatedRuleReferenceFixes,
  collectFrrSubsetApplicabilityAffectsFixes,
  collectInlineRuleDisplayNameFixes,
  collectRelatedRuleReferenceFixes,
  type FrrSubsetApplicabilityAffectsFix,
  type InlineRuleDisplayNameFix,
  type RelatedRuleReferenceFix,
} from "./consistency";
import { collectIdAlignmentIssues, fixIdAlignment } from "./id-alignment";
import { collectPropertyOrderIssues, fixPropertyOrder } from "./property-order";
import {
  applyDefinitionTermTitleChanges,
  applyTermSync,
  collectDefinitionTermTitleChanges,
  collectTermSyncChanges,
} from "./terms";

export const FIX_SCOPES = [
  "auto",
  "terms",
  "ids",
  "order",
  "related",
  "display-names",
  "subset-affects",
] as const;
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

export interface RelatedFixPlan {
  issueCount: number;
  needsFix: boolean;
}

export interface RelatedFixResult {
  document: RulesDocument;
  fixes: RelatedRuleReferenceFix[];
  fixedCount: number;
}

export interface DisplayNamesFixPlan {
  issueCount: number;
  needsFix: boolean;
}

export interface DisplayNamesFixResult {
  document: RulesDocument;
  fixes: InlineRuleDisplayNameFix[];
  fixedCount: number;
}

export interface SubsetAffectsFixPlan {
  issueCount: number;
  needsFix: boolean;
}

export interface SubsetAffectsFixResult {
  document: RulesDocument;
  fixes: FrrSubsetApplicabilityAffectsFix[];
  fixedCount: number;
}

export function collectTermsFixPlan(document: RulesDocument): TermsFixPlan {
  const definitionTermIssueCount =
    collectDefinitionTermTitleChanges(document).length;
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
  const definitionTermFixedCount =
    applyDefinitionTermTitleChanges(document).length;
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

export function collectOrderFixPlan(
  document: RulesDocument,
  schemaDocument: unknown,
): OrderFixPlan {
  const issueCount = collectPropertyOrderIssues(
    document,
    schemaDocument,
  ).length;

  return {
    issueCount,
    needsFix: issueCount > 0,
  };
}

export function applyOrderFix(
  document: RulesDocument,
  schemaDocument: unknown,
): OrderFixResult {
  return fixPropertyOrder(document, schemaDocument);
}

export function collectRelatedFixPlan(document: RulesDocument): RelatedFixPlan {
  const issueCount = collectRelatedRuleReferenceFixes(document).reduce(
    (total, fix) => total + fix.added.length,
    0,
  );

  return {
    issueCount,
    needsFix: issueCount > 0,
  };
}

export function applyRelatedFix(document: RulesDocument): RelatedFixResult {
  return applyRelatedRuleReferenceFixes(document);
}

export function collectDisplayNamesFixPlan(
  document: RulesDocument,
): DisplayNamesFixPlan {
  const issueCount = collectInlineRuleDisplayNameFixes(document).reduce(
    (total, fix) => total + fix.fixedIds.length,
    0,
  );

  return {
    issueCount,
    needsFix: issueCount > 0,
  };
}

export function applyDisplayNamesFix(
  document: RulesDocument,
): DisplayNamesFixResult {
  return applyInlineRuleDisplayNameFixes(document);
}

export function collectSubsetAffectsFixPlan(
  document: RulesDocument,
): SubsetAffectsFixPlan {
  const issueCount = collectFrrSubsetApplicabilityAffectsFixes(document).length;

  return {
    issueCount,
    needsFix: issueCount > 0,
  };
}

export function applySubsetAffectsFix(
  document: RulesDocument,
): SubsetAffectsFixResult {
  return applyFrrSubsetApplicabilityAffectsFixes(document);
}

export interface AutoFixPlan {
  definitionTermIssueCount: number;
  termSyncIssueCount: number;
  idIssueCount: number;
  inlineRuleDisplayNameIssueCount: number;
  relatedRuleIssueCount: number;
  subsetApplicabilityAffectsIssueCount: number;
  propertyOrderIssueCount: number;
  needsTermsFix: boolean;
  needsIdsFix: boolean;
  needsDisplayNamesFix: boolean;
  needsRelatedFix: boolean;
  needsSubsetAffectsFix: boolean;
  needsOrderFix: boolean;
}

export interface AutoFixResult {
  document: RulesDocument;
  plan: AutoFixPlan;
  definitionTermFixedCount: number;
  termSyncFixedCount: number;
  idFixedCount: number;
  idSkippedCount: number;
  inlineRuleDisplayNameFixedCount: number;
  relatedRuleFixedCount: number;
  subsetApplicabilityAffectsFixedCount: number;
  propertyOrderFixedCount: number;
}

export function collectAutoFixPlan(
  document: RulesDocument,
  schemaDocument: unknown,
): AutoFixPlan {
  const termsPlan = collectTermsFixPlan(document);
  const idsPlan = collectIdsFixPlan(document);
  const displayNamesPlan = collectDisplayNamesFixPlan(document);
  const relatedPlan = collectRelatedFixPlan(document);
  const subsetAffectsPlan = collectSubsetAffectsFixPlan(document);
  const orderPlan = collectOrderFixPlan(document, schemaDocument);

  return {
    definitionTermIssueCount: termsPlan.definitionTermIssueCount,
    termSyncIssueCount: termsPlan.termSyncIssueCount,
    idIssueCount: idsPlan.issueCount,
    inlineRuleDisplayNameIssueCount: displayNamesPlan.issueCount,
    relatedRuleIssueCount: relatedPlan.issueCount,
    subsetApplicabilityAffectsIssueCount: subsetAffectsPlan.issueCount,
    propertyOrderIssueCount: orderPlan.issueCount,
    needsTermsFix: termsPlan.needsFix,
    needsIdsFix: idsPlan.needsFix,
    needsDisplayNamesFix: displayNamesPlan.needsFix,
    needsRelatedFix: relatedPlan.needsFix,
    needsSubsetAffectsFix: subsetAffectsPlan.needsFix,
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
  let inlineRuleDisplayNameFixedCount = 0;
  let relatedRuleFixedCount = 0;
  let subsetApplicabilityAffectsFixedCount = 0;
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

  if (plan.needsDisplayNamesFix) {
    const displayNamesResult = applyDisplayNamesFix(working);
    inlineRuleDisplayNameFixedCount = displayNamesResult.fixedCount;
  }

  if (plan.needsRelatedFix) {
    const relatedResult = applyRelatedFix(working);
    relatedRuleFixedCount = relatedResult.fixedCount;
  }

  if (plan.needsSubsetAffectsFix) {
    const subsetAffectsResult = applySubsetAffectsFix(working);
    subsetApplicabilityAffectsFixedCount = subsetAffectsResult.fixedCount;
  }

  const orderPlan = collectOrderFixPlan(working, schemaDocument);
  if (orderPlan.needsFix) {
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
    inlineRuleDisplayNameFixedCount,
    relatedRuleFixedCount,
    subsetApplicabilityAffectsFixedCount,
    propertyOrderFixedCount,
  };
}
