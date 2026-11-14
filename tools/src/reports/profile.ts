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
    const classes = new Set(
      declarations.flatMap((entry) => entry.applicability.classes),
    );
    for (const value of requirement.applicability?.add?.types ?? [])
      types.add(value);
    for (const value of requirement.applicability?.add?.classes ?? [])
      classes.add(value);
    for (const value of requirement.applicability?.exclude?.types ?? [])
      types.delete(value);
    for (const value of requirement.applicability?.exclude?.classes ?? [])
      classes.delete(value);
    if (!types.has(type) || !classes.has(className)) return;
    const force = requirement.varies_by_class
      ? (requirement.varies_by_class[
          classKey as keyof typeof requirement.varies_by_class
        ]?.force ?? "unspecified")
      : requirement.force;
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
          `${rule.id} (${rule.name})${rule.force === "unspecified" ? ` [missing Class ${className} statement variant; force unspecified]` : ""}`,
      ),
    );
  }
  return lines.join("\n");
}
