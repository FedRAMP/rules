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

export function summarizeProfile(rules: ProfileRule[]): string {
  const order = [
    "MUST",
    "MUST NOT",
    "SHOULD",
    "SHOULD NOT",
    "MAY",
    "unspecified",
  ] as const;
  const counts = order
    .map((force) => ({
      force,
      count: rules.filter((rule) => rule.force === force).length,
    }))
    .filter(({ count }) => count > 0);
  return `${rules.length} ${rules.length === 1 ? "rule" : "rules"}${counts.length ? ` (${counts.map(({ force, count }) => `${count} ${force}`).join(", ")})` : ""}`;
}

export function renderProfile(
  rules: ProfileRule[],
  className: ClassName,
): string {
  const parties = [...new Set(rules.flatMap((rule) => rule.affects))].sort();
  const lines = rules.map(
    (rule) =>
      `${rule.id} (${rule.name})${rule.force === "unspecified" ? ` [missing Class ${className} statement variant; force unspecified]` : ""}`,
  );
  if (parties.length) {
    lines.push("", "By affected party:");
    for (const party of parties)
      lines.push(
        `${party}: ${summarizeProfile(rules.filter((rule) => rule.affects.includes(party)))}`,
      );
    if (rules.some((rule) => rule.affects.length > 1))
      lines.push(
        "Party totals overlap: rules affecting multiple parties count under each listed party.",
      );
  }
  lines.push("", summarizeProfile(rules));
  return lines.join("\n").trimStart();
}
