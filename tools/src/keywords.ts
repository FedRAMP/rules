import { visitRequirements } from "./traversal";
import { loadSchemaDocument } from "./rules";
import { requireStringEnum } from "./schema-metadata";
import type { RulesDocument, ValidationIssue } from "./types";

const SCHEMA_DOCUMENT = loadSchemaDocument();
const KEYWORDS = requireStringEnum(SCHEMA_DOCUMENT, "#/$defs/force_enum").sort(
  (left, right) => right.length - left.length,
);
const KEYWORD_REGEX = new RegExp(`\\b(${KEYWORDS.join("|")})\\b`);

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

    for (const [classKey, classEntry] of Object.entries(
      requirement.varies_by_class ?? {},
    )) {
      issues.push(
        ...validateRequirementObject(
          classEntry,
          id,
          `${location}.varies_by_class.${classKey}`,
        ),
      );
    }
  });

  return issues;
}
