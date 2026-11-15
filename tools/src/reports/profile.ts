import { getApplicableClasses, resolveClassContent } from "../class-content";
import { visitRequirements } from "../traversal";
import type {
  AffectedParty,
  CertificationType,
  ClassKey,
  ClassName,
  Force,
  RulesDocument,
} from "../types";

export interface ProfileRule {
  id: string;
  name: string;
  force: Force | "unspecified";
  affects: AffectedParty[];
}

export function collectProfile(
  document: RulesDocument,
  type: CertificationType,
  className: ClassName,
): ProfileRule[] {
  const framework = type === "Rev5" ? "rev5" : "20x";
  const classKey = className.toLowerCase() as ClassKey;
  const seen = new Set<string>();
  const results: ProfileRule[] = [];
  visitRequirements(document, ({ id, location, requirement }) => {
    if (seen.has(id))
      throw new Error(`Duplicate rule ID ${id} at ${location}.`);
    seen.add(id);
    if (!requirement.affects.includes("Providers")) return;
    const [, sectionKey, , scopeKey, subsetKey] = location.split(".");
    if (scopeKey !== "all" && scopeKey !== framework) return;
    const info = document.FRR[sectionKey!]!.info;
    const declarations = [
      info.subsets?.[subsetKey!],
      scopeKey === framework
        ? info[framework]?.subsets?.[subsetKey!]
        : undefined,
    ].filter((entry) => entry !== undefined);
    if (!declarations.length)
      throw new Error(`Unresolved subset declaration for ${location}.`);
    const types = new Set(
      declarations.flatMap((entry) => entry.applicability.types),
    );
    const classes = getApplicableClasses(requirement, declarations);
    if (!types.has(type) || !classes.has(className)) return;
    const force =
      resolveClassContent(requirement, classKey).force ?? "unspecified";
    results.push({
      id,
      name: requirement.name,
      force,
      affects: [...requirement.affects],
    });
  });
  return results;
}

const FORCE_ORDER = [
  "MUST",
  "MUST NOT",
  "SHOULD",
  "SHOULD NOT",
  "MAY",
  "unspecified",
] as const;

export function renderProfile(
  rules: ProfileRule[],
  className: ClassName,
): string {
  if (!rules.length) return "0 rules";
  const lines: string[] = [];
  for (const force of FORCE_ORDER) {
    const group = rules.filter((rule) => rule.force === force);
    if (!group.length) continue;
    if (lines.length) lines.push("");
    lines.push(
      `${force === "unspecified" ? "Unspecified" : force} (${group.length}):`,
      "",
    );
    lines.push(
      ...group.map(
        (rule) =>
          `${rule.id} (${rule.name})${rule.force === "unspecified" ? ` [missing effective Class ${className} force; force unspecified]` : ""}`,
      ),
    );
  }
  return lines.join("\n");
}
