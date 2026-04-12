import { getDefinitionEntries, getSearchableTextParts, visitIndicators, visitRequirements } from "./traversal";
import type { KsiIndicator, Requirement, RequirementLike, RulesDocument } from "./types";

export interface TermSyncChange {
  id: string;
  location: string;
  kind: "requirement" | "indicator";
  currentTerms: string[];
  nextTerms: string[];
}

const TERM_UPDATE_COMMENT = "Updated the related terms.";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function collectMatches(
  entity: Requirement | KsiIndicator,
  termLookup: Map<string, string>,
): string[] {
  const haystack = getSearchableTextParts(entity).join(" ").toLowerCase();
  const matches = new Set<string>();

  for (const [candidate, term] of termLookup.entries()) {
    const regex = new RegExp(`\\b${escapeRegExp(candidate)}\\b`, "g");
    if (regex.test(haystack)) {
      matches.add(term);
    }
  }

  return [...matches].sort();
}

function buildTermLookup(document: RulesDocument): Map<string, string> {
  const lookup = new Map<string, string>();

  for (const { definition } of getDefinitionEntries(document)) {
    lookup.set(definition.term.toLowerCase(), definition.term);

    for (const alt of definition.alts ?? []) {
      lookup.set(alt.toLowerCase(), definition.term);
    }
  }

  return lookup;
}

export function collectTermSyncChanges(document: RulesDocument): TermSyncChange[] {
  const lookup = buildTermLookup(document);
  const changes: TermSyncChange[] = [];

  visitRequirements(document, ({ id, location, requirement }) => {
    const nextTerms = collectMatches(requirement, lookup);
    const currentTerms = requirement.terms ?? [];
    if (!arraysEqual(currentTerms, nextTerms)) {
      changes.push({
        id,
        location,
        kind: "requirement",
        currentTerms,
        nextTerms,
      });
    }
  });

  visitIndicators(document, ({ id, location, indicator }) => {
    const nextTerms = collectMatches(indicator, lookup);
    const currentTerms = indicator.terms ?? [];
    if (!arraysEqual(currentTerms, nextTerms)) {
      changes.push({
        id,
        location,
        kind: "indicator",
        currentTerms,
        nextTerms,
      });
    }
  });

  return changes;
}

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function appendTermUpdateComment(existingComment: string): string {
  if (!existingComment) {
    return TERM_UPDATE_COMMENT;
  }

  if (existingComment.includes(TERM_UPDATE_COMMENT)) {
    return existingComment;
  }

  return `${existingComment} ${TERM_UPDATE_COMMENT}`;
}

function recordTermUpdate(entity: RequirementLike, entryDate: string): void {
  const updated = entity.updated ?? [];
  const existingEntry = updated.find((entry) => entry.date === entryDate);

  if (existingEntry) {
    existingEntry.comment = appendTermUpdateComment(existingEntry.comment);
    entity.updated = updated;
    return;
  }

  entity.updated = [
    {
      date: entryDate,
      comment: TERM_UPDATE_COMMENT,
    },
    ...updated,
  ];
}

export function applyTermSync(
  document: RulesDocument,
  options?: {
    entryDate?: string;
  },
): TermSyncChange[] {
  const changes = collectTermSyncChanges(document);
  const entryDate = options?.entryDate ?? getTodayDate();

  visitRequirements(document, ({ location, requirement }) => {
    const match = changes.find((change) => change.location === location);
    if (match) {
      requirement.terms = match.nextTerms;
      recordTermUpdate(requirement, entryDate);
    }
  });

  visitIndicators(document, ({ location, indicator }) => {
    const match = changes.find((change) => change.location === location);
    if (match) {
      indicator.terms = match.nextTerms;
      recordTermUpdate(indicator, entryDate);
    }
  });

  return changes;
}
