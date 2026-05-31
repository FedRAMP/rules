import { visitRequirements } from "./traversal";
import type { RulesDocument, ValidationIssue } from "./types";

const KEYWORDS = ["MUST NOT", "SHOULD NOT", "MUST", "SHOULD", "MAY"] as const;
const KEYWORD_REGEX = new RegExp(`\\b(${KEYWORDS.join("|")})\\b`);
const CLASS_KEYS = ["a", "b", "c", "d"] as const;

function validateRequirementObject(
  obj: { statement?: string; force?: string } | undefined,
  id: string,
  location: string,
): ValidationIssue[] {
  if (!obj?.statement || !obj.force) {
    return [];
  }

  const match = obj.statement.match(KEYWORD_REGEX);
  const extracted = match?.[0] ?? "NO KEYWORD FOUND";

  if (extracted === obj.force) {
    return [];
  }

  return [
    {
      id,
      location,
      message: `statement keyword is "${extracted}" but force is "${obj.force}"`,
    },
  ];
}

export function findForceIssues(document: RulesDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  visitRequirements(document, ({ id, location, requirement }) => {
    issues.push(...validateRequirementObject(requirement, id, location));

    for (const classKey of CLASS_KEYS) {
      issues.push(
        ...validateRequirementObject(
          requirement.varies_by_class?.[classKey],
          id,
          `${location}.varies_by_class.${classKey}`,
        ),
      );
    }
  });

  return issues;
}
