import { visitRequirements } from "./traversal";
import type { RulesDocument, ValidationIssue } from "./types";

const KEYWORDS = ["MUST NOT", "SHOULD NOT", "MUST", "SHOULD", "MAY"] as const;
const KEYWORD_REGEX = new RegExp(`\\b(${KEYWORDS.join("|")})\\b`);

function validateRequirementObject(
  obj: { statement?: string; primary_key_word?: string } | undefined,
  id: string,
  location: string,
): ValidationIssue[] {
  if (!obj?.statement || !obj.primary_key_word) {
    return [];
  }

  const match = obj.statement.match(KEYWORD_REGEX);
  const extracted = match?.[0] ?? "NO KEYWORD FOUND";

  if (extracted === obj.primary_key_word) {
    return [];
  }

  return [
    {
      id,
      location,
      message: `statement keyword is "${extracted}" but primary_key_word is "${obj.primary_key_word}"`,
    },
  ];
}

export function findPrimaryKeywordIssues(document: RulesDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  visitRequirements(document, ({ id, location, requirement }) => {
    issues.push(...validateRequirementObject(requirement, id, location));

    for (const level of ["low", "moderate", "high"] as const) {
      issues.push(
        ...validateRequirementObject(
          requirement.varies_by_level?.[level],
          id,
          `${location}.varies_by_level.${level}`,
        ),
      );
    }
  });

  return issues;
}
