import type {
  ClassContent,
  ClassKey,
  ClassName,
  ContentClassKey,
  FrrSubsetDefinition,
  Requirement,
  RulesDocument,
} from "./types";

/** Each supplied field replaces its entire inherited value, including objects. */
export function resolveClassContent<
  T extends ClassContent & {
    varies_by_class?: Partial<Record<ContentClassKey, ClassContent>>;
  },
>(
  entry: T,
  classKey: ClassKey,
): Omit<T, "varies_by_class" | keyof ClassContent> & ClassContent {
  const { varies_by_class, ...common } = entry;
  const variant = varies_by_class?.[classKey as ContentClassKey];
  const resolved = { ...common, ...variant };
  // Applicability is a selector, never part of effective rule content.
  Reflect.deleteProperty(resolved, "applicable");
  return resolved as Omit<T, "varies_by_class" | keyof ClassContent> &
    ClassContent;
}

export function getRuleSubsets(
  document: RulesDocument,
  location: string,
): FrrSubsetDefinition[] {
  const [, sectionKey, , scopeKey, subsetKey] = location.split(".");
  const info = document.FRR[sectionKey!]!.info;
  return [
    info.subsets?.[subsetKey!],
    scopeKey === "20x" || scopeKey === "rev5"
      ? info[scopeKey]?.subsets?.[subsetKey!]
      : undefined,
  ].filter((entry): entry is FrrSubsetDefinition => entry !== undefined);
}

export function getApplicableClasses(
  requirement: Requirement,
  subsets: FrrSubsetDefinition[],
): Set<ClassName> {
  const classes = new Set(
    subsets.flatMap((entry) => entry.applicability.classes),
  );
  for (const [key, variant] of Object.entries(
    requirement.varies_by_class ?? {},
  )) {
    const name = key.toUpperCase() as ClassName;
    if (variant.applicable === true) classes.add(name);
    if (variant.applicable === false) classes.delete(name);
  }
  return classes;
}
