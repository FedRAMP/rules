import { visitIndicators, visitRequirements } from "../traversal";
import type { RulesDocument } from "../types";

export function collectOverall(document: RulesDocument) {
  let subsets = 0;
  let rules = 0;
  let ksis = 0;
  for (const section of Object.values(document.FRR)) {
    for (const scope of Object.values(section.data)) {
      subsets += Object.values(scope).filter(
        (bucket) => Object.keys(bucket).length > 0,
      ).length;
    }
  }
  visitRequirements(document, () => rules++);
  visitIndicators(document, () => ksis++);
  return {
    rulesets: Object.keys(document.FRR).length,
    subsets,
    rules,
    ksis,
    controls: Object.values(document.CTL ?? {}).reduce(
      (total, family) => total + Object.keys(family).length,
      0,
    ),
  };
}

export function renderOverall(
  result: ReturnType<typeof collectOverall>,
): string {
  return [
    `Rulesets: ${result.rulesets}`,
    `Subsets: ${result.subsets}`,
    `Rules: ${result.rules}`,
    `KSIs: ${result.ksis}`,
    `Controls: ${result.controls}`,
  ].join("\n");
}
