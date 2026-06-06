import { visitIndicators, visitRequirements } from "./traversal";
import type {
  ClassKey,
  DefinitionEntry,
  FrrSubsetDefinition,
  KsiIndicator,
  Requirement,
  RequirementLike,
  RulesDocument,
  UpdatedEntry,
} from "./types";

export interface ConsistencyIssue {
  location: string;
  message: string;
}

export interface ConsistencyCheck {
  title: string;
  issues: ConsistencyIssue[];
}

type JsonPathSegment = string | number;
type JsonRecord = Record<string, unknown>;

const CLASS_KEYS = ["a", "b", "c", "d"] as const;
const APPLICABILITY_KEYS = ["all", "20x", "rev5"] as const;
type ApplicabilityKey = (typeof APPLICABILITY_KEYS)[number];
const CLASS_NAMES: Record<ClassKey, string> = {
  a: "Class A",
  b: "Class B",
  c: "Class C",
  d: "Class D",
};
const ALLOWED_ARTIFACT_KEYS_BY_PARENT: Record<
  ApplicabilityKey,
  readonly ApplicabilityKey[]
> = {
  all: APPLICABILITY_KEYS,
  "20x": ["20x"],
  rev5: ["rev5"],
};
const FRR_ID_REGEX = /^([A-Z]{3})-([A-Z]{3})-([A-Z0-9]{3})$/;
const KSI_ID_REGEX = /^KSI-([A-Z]{3})-([A-Z0-9]{3})$/;
const CONTROL_ID_REGEX = /^[a-z]{2}-\d+(?:\.\d+)?$/;
const TEXT_CONTROL_CHARACTER_REGEX = /[\u0000-\u001f\u007f]/;
const INLINE_FRR_ID_REGEX = /\b(?!KSI-)([A-Z]{3}-[A-Z]{3}-[A-Z0-9]{3})\b/g;
const INLINE_KSI_ID_REGEX = /\b(KSI-[A-Z]{3}-[A-Z0-9]{3})\b/g;

const ALLOWED_AFFECTS = [
  "Advisors",
  "Agencies",
  "Assessors",
  "FedRAMP",
  "Providers",
] as const;
const ALLOWED_SUBSET_APPLICABILITY_TYPES = ["20x", "Rev5"] as const;
const ALLOWED_SUBSET_APPLICABILITY_PATHS = ["Program", "Agency"] as const;
const ALLOWED_NOTIFICATION_METHODS = ["email", "update", "web"] as const;
const ALLOWED_NOTIFICATION_PARTIES = [
  "FedRAMP",
  "Provider",
  "All Necessary Parties",
  "publicly",
  "Agency Customers",
  "All Affected Parties",
] as const;
const ALLOWED_TIMEFRAME_TYPES = [
  "bizdays",
  "days",
  "hours",
  "weeks",
  "months",
  "years",
] as const;
const FORCE_ORDER = [
  "MUST",
  "MUST NOT",
  "SHOULD",
  "SHOULD NOT",
  "MAY",
] as const;
const FORCE_ORDER_INDEX = new Map<string, number>(
  FORCE_ORDER.map((force, index): [string, number] => [
    force,
    index,
  ]),
);

export function formatConsistencyIssues(
  title: string,
  issues: ConsistencyIssue[],
): string {
  const plural = issues.length === 1 ? "issue" : "issues";
  return [
    `${title} failed with ${issues.length} ${plural}:`,
    ...issues.map((issue) => `- ${issue.location}: ${issue.message}`),
  ].join("\n");
}

export function formatConsistencyReport(checks: ConsistencyCheck[]): string {
  const failedChecks = checks.filter((check) => check.issues.length > 0);
  const issueCount = failedChecks.reduce(
    (total, check) => total + check.issues.length,
    0,
  );
  const issueLabel = issueCount === 1 ? "issue" : "issues";
  const summaryIssues = failedChecks.flatMap((check) =>
    check.issues.map(
      (issue) => `- ${check.title}: ${issue.location}: ${issue.message}`,
    ),
  );
  const summary = [
    `Consistency validation failed with ${issueCount} ${issueLabel}:`,
    ...summaryIssues,
  ].join("\n");
  const checkReports = failedChecks.map((check) =>
    formatConsistencyIssues(check.title, check.issues),
  );

  return [summary, ...checkReports].join("\n\n");
}

export function collectConsistencyChecks(
  document: RulesDocument,
): ConsistencyCheck[] {
  return [
    {
      title: "Unique rule IDs",
      issues: collectDuplicateRuleIdIssues(document),
    },
    {
      title: "Unique rule names",
      issues: collectDuplicateRuleNameIssues(document),
    },
    {
      title: "Full ID alignment",
      issues: collectFullIdAlignmentIssues(document),
    },
    {
      title: "FRR subset declarations",
      issues: collectFrrSubsetDeclarationIssues(document),
    },
    {
      title: "FRR subset applicability affects",
      issues: collectFrrSubsetApplicabilityAffectsIssues(document),
    },
    {
      title: "FRR 20x subset applicability warnings",
      issues: collectFrr20xSubsetApplicabilityWarnings(document),
    },
    {
      title: "Non-empty audit history",
      issues: collectAuditHistoryIssues(document),
    },
    {
      title: "Text hygiene",
      issues: collectTextHygieneIssues(document),
    },
    {
      title: "Class-variant statement sanity",
      issues: collectClassVariantStatementIssues(document),
    },
    {
      title: "Artifact applicability",
      issues: collectArtifactApplicabilityIssues(document),
    },
    {
      title: "Controlled vocabularies",
      issues: collectControlledVocabularyIssues(document),
    },
    {
      title: "FRD term lookup determinism",
      issues: collectFrdTermLookupIssues(document),
    },
    {
      title: "Cross-reference integrity",
      issues: collectCrossReferenceIssues(document),
    },
    {
      title: "Inline rule display names",
      issues: collectInlineRuleDisplayNameIssues(document),
    },
    {
      title: "Related rule references",
      issues: collectRelatedRuleReferenceIssues(document),
    },
  ];
}

function issue(location: string, message: string): ConsistencyIssue {
  return { location, message };
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatPath(path: JsonPathSegment[]): string {
  return path
    .map((segment, index) => {
      if (typeof segment === "number") {
        return `[${segment}]`;
      }

      return index === 0 ? segment : `.${segment}`;
    })
    .join("");
}

function joinAllowed(values: readonly string[]): string {
  return values.join(", ");
}

function isApplicabilityKey(value: unknown): value is ApplicabilityKey {
  return (
    typeof value === "string" &&
    (APPLICABILITY_KEYS as readonly string[]).includes(value)
  );
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function collectDuplicateValues(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }

  return [...duplicates].sort((left, right) => left.localeCompare(right));
}

function collectRequirementEntries(document: RulesDocument): Array<{
  sectionKey: string;
  scopeKey: string;
  subsetKey: string;
  id: string;
  requirement: Requirement;
  location: string;
}> {
  const entries: Array<{
    sectionKey: string;
    scopeKey: string;
    subsetKey: string;
    id: string;
    requirement: Requirement;
    location: string;
  }> = [];

  for (const [sectionKey, section] of Object.entries(document.FRR ?? {})) {
    for (const [scopeKey, scope] of Object.entries(section.data ?? {})) {
      for (const [subsetKey, requirements] of Object.entries(scope ?? {})) {
        for (const [id, requirement] of Object.entries(requirements ?? {})) {
          entries.push({
            sectionKey,
            scopeKey,
            subsetKey,
            id,
            requirement,
            location: `FRR.${sectionKey}.data.${scopeKey}.${subsetKey}.${id}`,
          });
        }
      }
    }
  }

  return entries;
}

function collectIndicatorEntries(document: RulesDocument): Array<{
  themeKey: string;
  id: string;
  indicator: KsiIndicator;
  location: string;
}> {
  const entries: Array<{
    themeKey: string;
    id: string;
    indicator: KsiIndicator;
    location: string;
  }> = [];

  for (const [themeKey, theme] of Object.entries(document.KSI ?? {})) {
    const indicators = Array.isArray(theme.indicators)
      ? Object.fromEntries(
          theme.indicators.map((indicator, index) => [
            `${theme.id}-${index}`,
            indicator,
          ]),
        )
      : theme.indicators;

    for (const [id, indicator] of Object.entries(indicators ?? {})) {
      entries.push({
        themeKey,
        id,
        indicator,
        location: `KSI.${themeKey}.indicators.${id}`,
      });
    }
  }

  return entries;
}

function collectDefinitionEntries(document: RulesDocument): Array<{
  scopeKey: string;
  id: string;
  definition: DefinitionEntry;
  location: string;
}> {
  const entries: Array<{
    scopeKey: string;
    id: string;
    definition: DefinitionEntry;
    location: string;
  }> = [];

  for (const [scopeKey, definitions] of Object.entries(
    document.FRD.data ?? {},
  )) {
    for (const [id, definition] of Object.entries(definitions ?? {})) {
      entries.push({
        scopeKey,
        id,
        definition,
        location: `FRD.data.${scopeKey}.${id}`,
      });
    }
  }

  return entries;
}

function collectDuplicateIdIssues(
  label: string,
  entries: Array<{ id: string; location: string }>,
): ConsistencyIssue[] {
  const locationsById = new Map<string, string[]>();

  for (const entry of entries) {
    locationsById.set(entry.id, [
      ...(locationsById.get(entry.id) ?? []),
      entry.location,
    ]);
  }

  return [...locationsById.entries()]
    .filter(([, locations]) => locations.length > 1)
    .map(([id, locations]) =>
      issue(
        locations[0] ?? label,
        `${label} ID ${id} appears in multiple locations: ${locations.join(", ")}.`,
      ),
    )
    .sort((left, right) => left.message.localeCompare(right.message));
}

export function collectDuplicateRuleIdIssues(
  document: RulesDocument,
): ConsistencyIssue[] {
  return [
    ...collectDuplicateIdIssues(
      "definition",
      collectDefinitionEntries(document),
    ),
    ...collectDuplicateIdIssues(
      "requirement",
      collectRequirementEntries(document),
    ),
    ...collectDuplicateIdIssues("indicator", collectIndicatorEntries(document)),
  ];
}

function collectDuplicateNameIssues(
  label: string,
  entries: Array<{ name: string; location: string }>,
): ConsistencyIssue[] {
  const locationsByName = new Map<string, string[]>();

  for (const entry of entries) {
    locationsByName.set(entry.name, [
      ...(locationsByName.get(entry.name) ?? []),
      entry.location,
    ]);
  }

  return [...locationsByName.entries()]
    .filter(([, locations]) => locations.length > 1)
    .map(([name, locations]) =>
      issue(
        locations[0] ?? label,
        `${label} name "${name}" appears in multiple locations: ${locations.join(", ")}.`,
      ),
    )
    .sort((left, right) => left.message.localeCompare(right.message));
}

export function collectDuplicateRuleNameIssues(
  document: RulesDocument,
): ConsistencyIssue[] {
  return [
    ...collectDuplicateNameIssues(
      "requirement",
      collectRequirementEntries(document).map((entry) => ({
        name: entry.requirement.name,
        location: entry.location,
      })),
    ),
    ...collectDuplicateNameIssues(
      "indicator",
      collectIndicatorEntries(document).map((entry) => ({
        name: entry.indicator.name,
        location: entry.location,
      })),
    ),
  ];
}

function walkJson(
  value: unknown,
  path: JsonPathSegment[],
  visitor: (value: unknown, path: JsonPathSegment[]) => void,
): void {
  visitor(value, path);

  if (Array.isArray(value)) {
    value.forEach((item, index) => walkJson(item, [...path, index], visitor));
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, childValue] of Object.entries(value)) {
    walkJson(childValue, [...path, key], visitor);
  }
}

export function collectFullIdAlignmentIssues(
  document: RulesDocument,
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  if (document.FRD.info.short_name !== "FRD") {
    issues.push(
      issue(
        "FRD.info.short_name",
        `expected short_name to be FRD because this object is stored at FRD, but found ${String(document.FRD.info.short_name)}.`,
      ),
    );
  }

  for (const entry of collectDefinitionEntries(document)) {
    if (!entry.id.startsWith("FRD-")) {
      issues.push(
        issue(
          entry.location,
          `definition ID must start with FRD-, but found ${entry.id}.`,
        ),
      );
    }
  }

  for (const [sectionKey, section] of Object.entries(document.FRR ?? {})) {
    if (section.info.short_name !== sectionKey) {
      issues.push(
        issue(
          `FRR.${sectionKey}.info.short_name`,
          `expected short_name to be ${sectionKey} because this object is stored at FRR.${sectionKey}, but found ${String(section.info.short_name)}.`,
        ),
      );
    }
  }

  for (const entry of collectRequirementEntries(document)) {
    const match = entry.id.match(FRR_ID_REGEX);
    if (!match) {
      issues.push(
        issue(
          entry.location,
          `requirement ID ${entry.id} does not match ABC-LBL-XYZ format.`,
        ),
      );
      continue;
    }

    const [, idSection, idSubset] = match;
    if (idSection !== entry.sectionKey) {
      issues.push(
        issue(
          entry.location,
          `requirement ID first segment is ${idSection}, but the containing FRR document is ${entry.sectionKey}.`,
        ),
      );
    }
    if (idSubset !== entry.subsetKey) {
      issues.push(
        issue(
          entry.location,
          `requirement ID middle segment is ${idSubset}, but the containing subset bucket is ${entry.subsetKey}.`,
        ),
      );
    }
  }

  for (const [themeKey, theme] of Object.entries(document.KSI ?? {})) {
    const expectedId = `KSI-${themeKey}`;
    if (theme.id !== expectedId) {
      issues.push(
        issue(
          `KSI.${themeKey}.id`,
          `expected id to be ${expectedId} because this object is stored at KSI.${themeKey}, but found ${theme.id}.`,
        ),
      );
    }
    if (theme.short_name !== themeKey) {
      issues.push(
        issue(
          `KSI.${themeKey}.short_name`,
          `expected short_name to be ${themeKey} because this object is stored at KSI.${themeKey}, but found ${theme.short_name}.`,
        ),
      );
    }
  }

  for (const entry of collectIndicatorEntries(document)) {
    const match = entry.id.match(KSI_ID_REGEX);
    if (!match) {
      issues.push(
        issue(
          entry.location,
          `indicator ID ${entry.id} does not match KSI-ABC-XYZ format.`,
        ),
      );
      continue;
    }

    const [, idTheme] = match;
    if (idTheme !== entry.themeKey) {
      issues.push(
        issue(
          entry.location,
          `indicator ID theme segment is ${idTheme}, but the containing KSI theme is ${entry.themeKey}.`,
        ),
      );
    }
  }

  return issues;
}

export function collectFrrSubsetDeclarationIssues(
  document: RulesDocument,
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  for (const [sectionKey, section] of Object.entries(document.FRR ?? {})) {
    for (const [scopeKey, scope] of Object.entries(section.data ?? {})) {
      const declaredSubsets = collectDeclaredFrrSubsets(section.info, scopeKey);

      for (const subsetKey of Object.keys(scope ?? {})) {
        if (!declaredSubsets.has(subsetKey)) {
          issues.push(
            issue(
              `FRR.${sectionKey}.data.${scopeKey}.${subsetKey}`,
              `subset bucket ${subsetKey} is used in data but is not declared in FRR.${sectionKey}.info subsets for the ${scopeKey} applicability scope.`,
            ),
          );
        }
      }
    }
  }

  return issues;
}

function collectDeclaredFrrSubsets(
  info: Record<string, unknown>,
  scopeKey: string,
): Set<string> {
  const subsets = new Set(
    Object.keys(getRecordProperty(info, "subsets") ?? {}),
  );

  if (scopeKey === "20x" || scopeKey === "rev5") {
    const certificationInfo = getRecordProperty(info, scopeKey);
    for (const subset of Object.keys(
      getRecordProperty(certificationInfo, "subsets") ?? {},
    )) {
      subsets.add(subset);
    }
  }

  return subsets;
}

function getRecordProperty(
  value: Record<string, unknown> | undefined,
  key: string,
): Record<string, unknown> | undefined {
  if (!value) {
    return undefined;
  }

  const property = value[key];
  return isRecord(property) ? property : undefined;
}

interface FrrSubsetDeclarationEntry {
  sectionKey: string;
  subsetKey: string;
  subset: FrrSubsetDefinition;
  location: string;
  dataScopeKeys: ApplicabilityKey[];
  section: RulesDocument["FRR"][string];
}

interface FrrSubsetApplicabilityAffectsFixTarget {
  location: string;
  subset: FrrSubsetDefinition;
  expectedAffects: string[];
  actualAffects: string[];
}

export interface FrrSubsetApplicabilityAffectsFix {
  location: string;
  oldAffects: string[];
  newAffects: string[];
}

function collectFrrInfoSubsetEntries(
  document: RulesDocument,
): FrrSubsetDeclarationEntry[] {
  const entries: FrrSubsetDeclarationEntry[] = [];

  for (const [sectionKey, section] of Object.entries(document.FRR ?? {})) {
    const allDataScopeKeys = Object.keys(section.data ?? {}).filter(
      isApplicabilityKey,
    );
    const commonSubsets = getRecordProperty(section.info, "subsets");
    if (commonSubsets) {
      for (const [subsetKey, subset] of Object.entries(commonSubsets)) {
        entries.push({
          sectionKey,
          subsetKey,
          subset: subset as FrrSubsetDefinition,
          location: `FRR.${sectionKey}.info.subsets.${subsetKey}`,
          dataScopeKeys: allDataScopeKeys,
          section,
        });
      }
    }

    for (const certificationKey of ["20x", "rev5"] as const) {
      const certificationInfo = getRecordProperty(
        section.info,
        certificationKey,
      );
      const certificationSubsets = getRecordProperty(
        certificationInfo,
        "subsets",
      );
      if (!certificationSubsets) {
        continue;
      }

      for (const [subsetKey, subset] of Object.entries(certificationSubsets)) {
        entries.push({
          sectionKey,
          subsetKey,
          subset: subset as FrrSubsetDefinition,
          location: `FRR.${sectionKey}.info.${certificationKey}.subsets.${subsetKey}`,
          dataScopeKeys: [certificationKey],
          section,
        });
      }
    }
  }

  return entries;
}

function collectFrrSubsetRequirementAffects(entry: FrrSubsetDeclarationEntry): {
  affects: string[];
  requirementLocations: string[];
} {
  const affects: string[] = [];
  const requirementLocations: string[] = [];

  for (const scopeKey of entry.dataScopeKeys) {
    const subsetRequirements =
      entry.section.data?.[scopeKey]?.[entry.subsetKey];
    if (!subsetRequirements) {
      continue;
    }

    for (const [id, requirement] of Object.entries(subsetRequirements)) {
      requirementLocations.push(
        `FRR.${entry.sectionKey}.data.${scopeKey}.${entry.subsetKey}.${id}`,
      );

      for (const affectedParty of requirement.affects ?? []) {
        if (typeof affectedParty === "string") {
          affects.push(affectedParty);
        }
      }
    }
  }

  return { affects, requirementLocations };
}

function orderAffects(values: string[]): string[] {
  const remaining = new Set(values);
  const ordered = (ALLOWED_AFFECTS as readonly string[]).filter((value) => {
    if (!remaining.has(value)) {
      return false;
    }

    remaining.delete(value);
    return true;
  });

  return [
    ...ordered,
    ...[...remaining].sort((left, right) => left.localeCompare(right)),
  ];
}

function getSubsetApplicabilityArray(
  subset: FrrSubsetDefinition,
  key: "types" | "paths" | "classes" | "affects",
): string[] | null {
  const value = subset.applicability?.[key];
  if (!Array.isArray(value)) {
    return null;
  }

  return value.filter((item): item is string => typeof item === "string");
}

function hasSameStringSet(left: string[], right: string[]): boolean {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (leftSet.size !== rightSet.size) {
    return false;
  }

  return [...leftSet].every((value) => rightSet.has(value));
}

function formatValues(values: string[] | null): string {
  if (!values || values.length === 0) {
    return "(none)";
  }

  return values.join(", ");
}

function getForceOrderIndex(force: string): number | null {
  return FORCE_ORDER_INDEX.get(force) ?? null;
}

function compareForces(left: string, right: string): number {
  const leftIndex = getForceOrderIndex(left);
  const rightIndex = getForceOrderIndex(right);

  if (leftIndex === null && rightIndex === null) {
    return left.localeCompare(right);
  }
  if (leftIndex === null) {
    return 1;
  }
  if (rightIndex === null) {
    return -1;
  }

  return leftIndex === rightIndex
    ? left.localeCompare(right)
    : leftIndex - rightIndex;
}

function getRequirementOrderingForce(
  requirement: Requirement,
): string | null {
  if (typeof requirement.force === "string") {
    return requirement.force;
  }

  const classForces = CLASS_KEYS.map(
    (classKey) => requirement.varies_by_class?.[classKey]?.force,
  ).filter((force): force is string => typeof force === "string");

  return classForces.sort(compareForces)[0] ?? null;
}

function getForceRuns(forces: string[]): string[] {
  const runs: string[] = [];

  for (const force of forces) {
    if (runs[runs.length - 1] !== force) {
      runs.push(force);
    }
  }

  return runs;
}

function isForceOrderOutOfOrder(forces: string[]): boolean {
  let highestSeenIndex = -1;

  for (const force of forces) {
    const index = getForceOrderIndex(force);
    if (index === null) {
      continue;
    }

    if (index < highestSeenIndex) {
      return true;
    }

    highestSeenIndex = Math.max(highestSeenIndex, index);
  }

  return false;
}

export function collectFrrSubsetForceOrderWarnings(
  document: RulesDocument,
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const checkedLocations = new Set<string>();

  for (const entry of collectFrrInfoSubsetEntries(document)) {
    for (const scopeKey of entry.dataScopeKeys) {
      const subsetRequirements =
        entry.section.data?.[scopeKey]?.[entry.subsetKey];
      if (!subsetRequirements) {
        continue;
      }

      const location = `FRR.${entry.sectionKey}.data.${scopeKey}.${entry.subsetKey}`;
      if (checkedLocations.has(location)) {
        continue;
      }
      checkedLocations.add(location);

      const forces = Object.values(subsetRequirements)
        .map(getRequirementOrderingForce)
        .filter((force): force is string => typeof force === "string");
      if (forces.length < 2 || !isForceOrderOutOfOrder(forces)) {
        continue;
      }

      issues.push(
        issue(
          location,
          `expected force groups ${joinAllowed(FORCE_ORDER)}; found ${formatValues(getForceRuns(forces))}.`,
        ),
      );
    }
  }

  return issues;
}

function collectFrrSubsetApplicabilityAffectsFixTargets(
  document: RulesDocument,
): FrrSubsetApplicabilityAffectsFixTarget[] {
  const targets: FrrSubsetApplicabilityAffectsFixTarget[] = [];

  for (const entry of collectFrrInfoSubsetEntries(document)) {
    const { affects, requirementLocations } =
      collectFrrSubsetRequirementAffects(entry);
    if (requirementLocations.length === 0) {
      continue;
    }

    const expectedAffects = orderAffects(affects);
    if (expectedAffects.length === 0) {
      continue;
    }

    const actualAffects = getSubsetApplicabilityArray(entry.subset, "affects");
    if (!actualAffects) {
      continue;
    }

    if (!hasSameStringSet(actualAffects, expectedAffects)) {
      targets.push({
        location: `${entry.location}.applicability.affects`,
        subset: entry.subset,
        expectedAffects,
        actualAffects,
      });
    }
  }

  return targets;
}

export function collectFrrSubsetApplicabilityAffectsIssues(
  document: RulesDocument,
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  for (const entry of collectFrrInfoSubsetEntries(document)) {
    const { affects, requirementLocations } =
      collectFrrSubsetRequirementAffects(entry);
    if (requirementLocations.length === 0) {
      continue;
    }

    const expectedAffects = orderAffects(affects);
    if (expectedAffects.length === 0) {
      continue;
    }

    const actualAffects = getSubsetApplicabilityArray(entry.subset, "affects");
    if (!actualAffects || actualAffects.length === 0) {
      issues.push(
        issue(
          `${entry.location}.applicability.affects`,
          `applicability.affects must list every party used by corresponding requirement affects arrays. Expected: ${formatValues(expectedAffects)}.`,
        ),
      );
      continue;
    }

    if (hasSameStringSet(actualAffects, expectedAffects)) {
      continue;
    }

    issues.push(
      issue(
        `${entry.location}.applicability.affects`,
        `applicability.affects must match corresponding requirement affects arrays. Expected: ${formatValues(expectedAffects)}; found: ${formatValues(actualAffects)}.`,
      ),
    );
  }

  return issues;
}

function collectSubsetApplicabilitySetWarnings(
  entry: FrrSubsetDeclarationEntry,
  key: "types" | "paths",
  expected: readonly string[],
): ConsistencyIssue[] {
  const actual = getSubsetApplicabilityArray(entry.subset, key);
  if (actual && hasSameStringSet(actual, [...expected])) {
    return [];
  }

  return [
    issue(
      `${entry.location}.applicability.${key}`,
      `20x-specific subset warning: subset ${entry.subsetKey} ends in X, so applicability.${key} should only include ${formatValues([...expected])}; found: ${formatValues(actual)}.`,
    ),
  ];
}

export function collectFrr20xSubsetApplicabilityWarnings(
  document: RulesDocument,
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  for (const entry of collectFrrInfoSubsetEntries(document)) {
    if (!entry.subsetKey.endsWith("X")) {
      continue;
    }

    issues.push(
      ...collectSubsetApplicabilitySetWarnings(
        entry,
        "types",
        ALLOWED_SUBSET_APPLICABILITY_TYPES.slice(0, 1),
      ),
      ...collectSubsetApplicabilitySetWarnings(
        entry,
        "paths",
        ALLOWED_SUBSET_APPLICABILITY_PATHS.slice(0, 1),
      ),
    );
  }

  return issues;
}

export function collectFrrSubsetApplicabilityAffectsFixes(
  document: RulesDocument,
): FrrSubsetApplicabilityAffectsFix[] {
  return collectFrrSubsetApplicabilityAffectsFixTargets(document).map(
    (target) => ({
      location: target.location,
      oldAffects: target.actualAffects,
      newAffects: target.expectedAffects,
    }),
  );
}

export function applyFrrSubsetApplicabilityAffectsFixes(
  document: RulesDocument,
): {
  document: RulesDocument;
  fixes: FrrSubsetApplicabilityAffectsFix[];
  fixedCount: number;
} {
  const targets = collectFrrSubsetApplicabilityAffectsFixTargets(document);
  const fixes = targets.map((target) => ({
    location: target.location,
    oldAffects: target.actualAffects,
    newAffects: target.expectedAffects,
  }));

  for (const target of targets) {
    if (target.subset.applicability) {
      target.subset.applicability.affects = target.expectedAffects;
    }
  }

  return {
    document,
    fixes,
    fixedCount: fixes.length,
  };
}

function collectUpdatedHistoryIssues(
  location: string,
  updated: UpdatedEntry[] | undefined,
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  if (!Array.isArray(updated) || updated.length === 0) {
    issues.push(issue(location, "updated history must be a non-empty array."));
    return issues;
  }

  const dates = updated.map((entry) => entry.date);
  const duplicateDates = collectDuplicateValues(dates);
  if (duplicateDates.length > 0) {
    issues.push(
      issue(
        `${location}.updated`,
        `updated history contains duplicate date entries: ${duplicateDates.join(", ")}.`,
      ),
    );
  }

  const expectedOrder = [...dates].sort((left, right) =>
    right.localeCompare(left),
  );
  if (dates.some((date, index) => date !== expectedOrder[index])) {
    issues.push(
      issue(
        `${location}.updated`,
        `updated history must be sorted newest-first; found ${dates.join(", ")}.`,
      ),
    );
  }

  return issues;
}

export function collectAuditHistoryIssues(
  document: RulesDocument,
): ConsistencyIssue[] {
  return [
    ...collectDefinitionEntries(document).flatMap((entry) =>
      collectUpdatedHistoryIssues(entry.location, entry.definition.updated),
    ),
    ...collectRequirementEntries(document).flatMap((entry) =>
      collectUpdatedHistoryIssues(entry.location, entry.requirement.updated),
    ),
    ...collectIndicatorEntries(document).flatMap((entry) =>
      collectUpdatedHistoryIssues(entry.location, entry.indicator.updated),
    ),
  ];
}

export function collectTextHygieneIssues(
  document: RulesDocument,
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  walkJson(document, [], (value, path) => {
    if (typeof value !== "string") {
      return;
    }

    const location = formatPath(path);
    if (value.length === 0) {
      issues.push(issue(location, "text value must not be empty."));
    }
    if (value !== value.trim()) {
      issues.push(
        issue(location, "text value has leading or trailing whitespace."),
      );
    }
    if (TEXT_CONTROL_CHARACTER_REGEX.test(value)) {
      issues.push(issue(location, "text value contains a control character."));
    }
  });

  return issues;
}

export function collectClassVariantStatementIssues(
  document: RulesDocument,
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  walkJson(document, [], (value, path) => {
    if (!isRecord(value) || !isRecord(value.varies_by_class)) {
      return;
    }

    for (const classKey of CLASS_KEYS) {
      const classEntry = value.varies_by_class[classKey];
      if (!isRecord(classEntry) || typeof classEntry.statement !== "string") {
        continue;
      }

      const mentionedClasses = sortedUnique(
        [...classEntry.statement.matchAll(/\bClass ([A-D])\b/g)].map(
          (match) => `Class ${match[1]}`,
        ),
      );
      if (mentionedClasses.length === 0) {
        continue;
      }

      const expectedClass = CLASS_NAMES[classKey];
      const unexpectedClasses = mentionedClasses.filter(
        (className) => className !== expectedClass,
      );
      if (unexpectedClasses.length > 0) {
        issues.push(
          issue(
            `${formatPath(path)}.varies_by_class.${classKey}.statement`,
            `this is the ${expectedClass} variant, but the statement mentions ${unexpectedClasses.join(", ")}.`,
          ),
        );
      }
    }
  });

  return issues;
}

function getContainingDataApplicability(
  path: JsonPathSegment[],
): ApplicabilityKey | null {
  for (let index = 0; index < path.length - 1; index += 1) {
    if (path[index] !== "data") {
      continue;
    }

    const candidate = path[index + 1];
    if (isApplicabilityKey(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function collectArtifactApplicabilityIssues(
  document: RulesDocument,
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  walkJson(document, [], (value, path) => {
    if (!isRecord(value) || !isRecord(value.artifacts)) {
      return;
    }

    const parentApplicability = getContainingDataApplicability(path);
    if (!parentApplicability) {
      return;
    }

    const allowedKeys = ALLOWED_ARTIFACT_KEYS_BY_PARENT[parentApplicability];
    const disallowedKeys = Object.keys(value.artifacts).filter(
      (key) => !allowedKeys.includes(key as ApplicabilityKey),
    );
    if (disallowedKeys.length === 0) {
      return;
    }

    issues.push(
      issue(
        `${formatPath(path)}.artifacts`,
        `artifacts is inside data.${parentApplicability}, so it may only use applicability keys: ${joinAllowed(allowedKeys)}. Found disallowed keys: ${disallowedKeys.join(", ")}.`,
      ),
    );
  });

  return issues;
}

function collectAffectsIssues(
  location: string,
  requirement: Requirement,
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const affects = requirement.affects ?? [];

  if (affects.length === 0) {
    issues.push(
      issue(`${location}.affects`, "affects must list at least one party."),
    );
    return issues;
  }

  const duplicateAffects = collectDuplicateValues(affects);
  if (duplicateAffects.length > 0) {
    issues.push(
      issue(
        `${location}.affects`,
        `affects contains duplicate values: ${duplicateAffects.join(", ")}.`,
      ),
    );
  }

  for (const [index, value] of affects.entries()) {
    if (!(ALLOWED_AFFECTS as readonly string[]).includes(value)) {
      issues.push(
        issue(
          `${location}.affects[${index}]`,
          `affects value ${value} is not allowed. Allowed values are: ${joinAllowed(ALLOWED_AFFECTS)}.`,
        ),
      );
    }
  }

  return issues;
}

function collectControlIssues(
  location: string,
  entity: RequirementLike,
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const controls =
    isRecord(entity) && Array.isArray(entity.controls)
      ? entity.controls.filter(
          (control): control is string => typeof control === "string",
        )
      : [];

  const duplicateControls = collectDuplicateValues(controls);
  if (duplicateControls.length > 0) {
    issues.push(
      issue(
        `${location}.controls`,
        `controls contains duplicate IDs: ${duplicateControls.join(", ")}.`,
      ),
    );
  }

  for (const [index, control] of controls.entries()) {
    if (!CONTROL_ID_REGEX.test(control)) {
      issues.push(
        issue(
          `${location}.controls[${index}]`,
          `control ID ${control} must use lowercase family-number format, such as ac-2 or ia-2.1.`,
        ),
      );
    }
  }

  return issues;
}

function collectTimeframeIssues(
  value: unknown,
  path: JsonPathSegment[],
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  walkJson(value, path, (node, nodePath) => {
    if (!isRecord(node)) {
      return;
    }

    const hasType = Object.hasOwn(node, "timeframe_type");
    const hasNum = Object.hasOwn(node, "timeframe_num");
    if (!hasType && !hasNum) {
      return;
    }

    const location = formatPath(nodePath);
    if (hasType !== hasNum) {
      issues.push(
        issue(
          location,
          "timeframe_type and timeframe_num must be provided together.",
        ),
      );
    }

    if (hasType && typeof node.timeframe_type === "string") {
      if (
        !(ALLOWED_TIMEFRAME_TYPES as readonly string[]).includes(
          node.timeframe_type,
        )
      ) {
        issues.push(
          issue(
            `${location}.timeframe_type`,
            `timeframe_type ${node.timeframe_type} is not allowed. Allowed values are: ${joinAllowed(ALLOWED_TIMEFRAME_TYPES)}.`,
          ),
        );
      }
    }

    if (
      hasNum &&
      typeof node.timeframe_num === "number" &&
      node.timeframe_num <= 0
    ) {
      issues.push(
        issue(
          `${location}.timeframe_num`,
          "timeframe_num must be greater than zero.",
        ),
      );
    }
  });

  return issues;
}

function collectNotificationIssues(
  value: unknown,
  path: JsonPathSegment[],
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  walkJson(value, path, (node, nodePath) => {
    if (!isRecord(node) || !Array.isArray(node.notification)) {
      return;
    }

    for (const [index, notification] of node.notification.entries()) {
      if (!isRecord(notification)) {
        continue;
      }

      const location = `${formatPath(nodePath)}.notification[${index}]`;
      if (
        typeof notification.method === "string" &&
        !(ALLOWED_NOTIFICATION_METHODS as readonly string[]).includes(
          notification.method,
        )
      ) {
        issues.push(
          issue(
            `${location}.method`,
            `notification method ${notification.method} is not allowed. Allowed values are: ${joinAllowed(ALLOWED_NOTIFICATION_METHODS)}.`,
          ),
        );
      }

      if (
        typeof notification.party === "string" &&
        !(ALLOWED_NOTIFICATION_PARTIES as readonly string[]).includes(
          notification.party,
        )
      ) {
        issues.push(
          issue(
            `${location}.party`,
            `notification party ${notification.party} is not allowed. Allowed values are: ${joinAllowed(ALLOWED_NOTIFICATION_PARTIES)}.`,
          ),
        );
      }
    }
  });

  return issues;
}

export function collectControlledVocabularyIssues(
  document: RulesDocument,
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  visitRequirements(document, ({ location, requirement }) => {
    issues.push(...collectAffectsIssues(location, requirement));
    issues.push(...collectControlIssues(location, requirement));
  });

  visitIndicators(document, ({ location, indicator }) => {
    issues.push(...collectControlIssues(location, indicator));
  });

  issues.push(...collectTimeframeIssues(document, []));
  issues.push(...collectNotificationIssues(document, []));

  return issues;
}

function normalizeTermCandidate(candidate: string): string {
  return candidate.trim().toLowerCase();
}

export function collectFrdTermLookupIssues(
  document: RulesDocument,
): ConsistencyIssue[] {
  const candidateMap = new Map<
    string,
    Map<string, { id: string; term: string; location: string }>
  >();

  for (const entry of collectDefinitionEntries(document)) {
    const candidates = [
      entry.definition.term,
      ...(entry.definition.alts ?? []),
    ];
    for (const candidate of candidates) {
      const normalized = normalizeTermCandidate(candidate);
      const definitions = candidateMap.get(normalized) ?? new Map();
      definitions.set(entry.id, {
        id: entry.id,
        term: entry.definition.term,
        location: entry.location,
      });
      candidateMap.set(normalized, definitions);
    }
  }

  const issues: ConsistencyIssue[] = [];
  for (const [candidate, definitions] of candidateMap.entries()) {
    if (definitions.size <= 1) {
      continue;
    }

    const definitionList = [...definitions.values()]
      .map((definition) => `${definition.id} (${definition.term})`)
      .sort((left, right) => left.localeCompare(right));
    issues.push(
      issue(
        "FRD.data",
        `term lookup candidate "${candidate}" maps to multiple definitions: ${definitionList.join(", ")}. This makes term extraction order-dependent.`,
      ),
    );
  }

  return issues.sort((left, right) =>
    left.message.localeCompare(right.message),
  );
}

function collectReferenceIds(document: RulesDocument): {
  requirementIds: Set<string>;
  indicatorIds: Set<string>;
  webNames: Set<string>;
} {
  const requirementIds = new Set(
    collectRequirementEntries(document).map((entry) => entry.id),
  );
  const indicatorIds = new Set(
    collectIndicatorEntries(document).map((entry) => entry.id),
  );
  const webNames = new Set<string>();

  for (const section of Object.values(document.FRR ?? {})) {
    if (typeof section.info.web_name === "string") {
      webNames.add(section.info.web_name);
    }
  }
  for (const theme of Object.values(document.KSI ?? {})) {
    if (typeof theme.web_name === "string") {
      webNames.add(theme.web_name);
    }
  }

  return { requirementIds, indicatorIds, webNames };
}

export function collectCrossReferenceIssues(
  document: RulesDocument,
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const { requirementIds, indicatorIds, webNames } =
    collectReferenceIds(document);

  walkJson(document, [], (value, path) => {
    const location = formatPath(path);

    if (isRecord(value) && typeof value.reference_url_web_name === "string") {
      if (!webNames.has(value.reference_url_web_name)) {
        issues.push(
          issue(
            `${location}.reference_url_web_name`,
            `reference_url_web_name ${value.reference_url_web_name} does not match any known FRR or KSI web_name.`,
          ),
        );
      }
    }

    if (typeof value !== "string") {
      return;
    }

    for (const match of value.matchAll(INLINE_KSI_ID_REGEX)) {
      const id = match[1];
      if (!id) {
        continue;
      }
      if (!indicatorIds.has(id)) {
        issues.push(
          issue(location, `referenced KSI indicator ID ${id} does not exist.`),
        );
      }
    }

    for (const match of value.matchAll(INLINE_FRR_ID_REGEX)) {
      const id = match[1];
      if (!id) {
        continue;
      }
      if (!requirementIds.has(id)) {
        issues.push(
          issue(
            location,
            `referenced FRR requirement ID ${id} does not exist.`,
          ),
        );
      }
    }
  });

  return issues;
}

interface RuleTextPart {
  location: string;
  text: string;
  setText: (value: string) => void;
}

function collectRequirementRuleTextParts(
  location: string,
  requirement: Requirement,
): RuleTextPart[] {
  const parts: RuleTextPart[] = [];
  const addText = (
    textLocation: string,
    text: string | undefined,
    setText: (value: string) => void,
  ): void => {
    if (typeof text === "string") {
      parts.push({ location: textLocation, text, setText });
    }
  };
  const addTextList = (
    textLocation: string,
    values: string[] | undefined,
  ): void => {
    values?.forEach((value, index) =>
      addText(`${textLocation}[${index}]`, value, (nextValue) => {
        values[index] = nextValue;
      }),
    );
  };

  addText(`${location}.statement`, requirement.statement, (value) => {
    requirement.statement = value;
  });
  addText(`${location}.note`, requirement.note, (value) => {
    requirement.note = value;
  });
  addTextList(`${location}.notes`, requirement.notes);
  addTextList(
    `${location}.following_information`,
    requirement.following_information,
  );
  addTextList(
    `${location}.following_information_bullets`,
    requirement.following_information_bullets,
  );

  if (requirement.varies_by_class) {
    for (const classKey of CLASS_KEYS) {
      const classEntry = requirement.varies_by_class[classKey];
      const classLocation = `${location}.varies_by_class.${classKey}`;

      addText(`${classLocation}.statement`, classEntry?.statement, (value) => {
        if (classEntry) {
          classEntry.statement = value;
        }
      });
      addText(`${classLocation}.note`, classEntry?.note, (value) => {
        if (classEntry) {
          classEntry.note = value;
        }
      });
      addTextList(`${classLocation}.notes`, classEntry?.notes);
      addTextList(
        `${classLocation}.following_information`,
        classEntry?.following_information,
      );
    }
  }

  return parts;
}

function collectRequirementRuleMentionSources(
  location: string,
  requirement: Requirement,
): Map<string, string[]> {
  const mentions = new Map<string, string[]>();

  for (const part of collectRequirementRuleTextParts(location, requirement)) {
    for (const match of part.text.matchAll(INLINE_FRR_ID_REGEX)) {
      const id = match[1];
      if (!id) {
        continue;
      }

      const locations = mentions.get(id) ?? [];
      locations.push(part.location);
      mentions.set(id, locations);
    }
  }

  return mentions;
}

function collectRequirementNameMap(
  entries: ReturnType<typeof collectRequirementEntries>,
): Map<string, string> {
  return new Map(
    entries
      .filter((entry) => typeof entry.requirement.name === "string")
      .map((entry) => [entry.id, entry.requirement.name]),
  );
}

export function collectInlineRuleDisplayNameIssues(
  document: RulesDocument,
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const entries = collectRequirementEntries(document);
  const requirementNames = collectRequirementNameMap(entries);

  for (const { location, requirement } of entries) {
    for (const part of collectRequirementRuleTextParts(location, requirement)) {
      for (const match of part.text.matchAll(INLINE_FRR_ID_REGEX)) {
        const id = match[1];
        const index = match.index;
        if (!id || index === undefined) {
          continue;
        }

        const name = requirementNames.get(id);
        if (!name) {
          continue;
        }

        const expectedDisplay = `${id} (${name})`;
        const suffix = part.text.slice(index + id.length);
        if (suffix.startsWith(` (${name})`)) {
          continue;
        }

        if (suffix.trimStart().startsWith(name)) {
          issues.push(
            issue(
              part.location,
              `referenced FRR requirement ID ${id} is followed by "${name}" without parentheses; use ${expectedDisplay}.`,
            ),
          );
          continue;
        }

        issues.push(
          issue(
            part.location,
            `referenced FRR requirement ID ${id} must be followed by its rule name in parentheses: ${expectedDisplay}.`,
          ),
        );
      }
    }
  }

  return issues;
}

export interface InlineRuleDisplayNameFix {
  location: string;
  fixedIds: string[];
}

function fixInlineRuleDisplayText(
  text: string,
  requirementNames: Map<string, string>,
): { text: string; fixedIds: string[] } {
  let nextText = "";
  let cursor = 0;
  const fixedIds: string[] = [];

  for (const match of text.matchAll(INLINE_FRR_ID_REGEX)) {
    const id = match[1];
    const index = match.index;
    if (!id || index === undefined || index < cursor) {
      continue;
    }

    const name = requirementNames.get(id);
    if (!name) {
      continue;
    }

    const idEnd = index + id.length;
    const suffix = text.slice(idEnd);
    const expectedSuffix = ` (${name})`;
    if (suffix.startsWith(expectedSuffix)) {
      continue;
    }

    nextText += text.slice(cursor, idEnd);
    nextText += expectedSuffix;
    fixedIds.push(id);

    const unparenthesizedNameStart =
      idEnd + suffix.length - suffix.trimStart().length;
    if (
      text
        .slice(unparenthesizedNameStart, unparenthesizedNameStart + name.length)
        .startsWith(name)
    ) {
      cursor = unparenthesizedNameStart + name.length;
    } else {
      cursor = idEnd;
    }
  }

  if (fixedIds.length === 0) {
    return { text, fixedIds };
  }

  return {
    text: nextText + text.slice(cursor),
    fixedIds,
  };
}

function collectInlineRuleDisplayNameFixTargets(
  document: RulesDocument,
): Array<{
  part: RuleTextPart;
  nextText: string;
  fixedIds: string[];
}> {
  const entries = collectRequirementEntries(document);
  const requirementNames = collectRequirementNameMap(entries);
  const targets: Array<{
    part: RuleTextPart;
    nextText: string;
    fixedIds: string[];
  }> = [];

  for (const { location, requirement } of entries) {
    for (const part of collectRequirementRuleTextParts(location, requirement)) {
      const result = fixInlineRuleDisplayText(part.text, requirementNames);
      if (result.fixedIds.length > 0) {
        targets.push({
          part,
          nextText: result.text,
          fixedIds: result.fixedIds,
        });
      }
    }
  }

  return targets;
}

export function collectInlineRuleDisplayNameFixes(
  document: RulesDocument,
): InlineRuleDisplayNameFix[] {
  return collectInlineRuleDisplayNameFixTargets(document).map((target) => ({
    location: target.part.location,
    fixedIds: target.fixedIds,
  }));
}

export function applyInlineRuleDisplayNameFixes(document: RulesDocument): {
  document: RulesDocument;
  fixes: InlineRuleDisplayNameFix[];
  fixedCount: number;
} {
  const targets = collectInlineRuleDisplayNameFixTargets(document);
  const fixes = targets.map((target) => ({
    location: target.part.location,
    fixedIds: target.fixedIds,
  }));

  for (const target of targets) {
    target.part.setText(target.nextText);
  }

  return {
    document,
    fixes,
    fixedCount: fixes.reduce((total, fix) => total + fix.fixedIds.length, 0),
  };
}

export interface RelatedRuleReferenceFix {
  location: string;
  added: string[];
}

function collectRelatedRuleReferenceFixTargets(document: RulesDocument): Array<{
  location: string;
  requirement: Requirement;
  missingIds: string[];
}> {
  const targets: Array<{
    location: string;
    requirement: Requirement;
    missingIds: string[];
  }> = [];

  for (const { id, location, requirement } of collectRequirementEntries(
    document,
  )) {
    const mentions = collectRequirementRuleMentionSources(
      location,
      requirement,
    );
    mentions.delete(id);

    if (mentions.size === 0) {
      continue;
    }

    const related = Array.isArray(requirement.related)
      ? requirement.related.filter(
          (relatedId): relatedId is string => typeof relatedId === "string",
        )
      : [];
    const missingIds = [...mentions.keys()].filter(
      (mentionedId) => !related.includes(mentionedId),
    );

    if (missingIds.length > 0) {
      targets.push({ location, requirement, missingIds });
    }
  }

  return targets;
}

export function collectRelatedRuleReferenceFixes(
  document: RulesDocument,
): RelatedRuleReferenceFix[] {
  return collectRelatedRuleReferenceFixTargets(document).map((target) => ({
    location: `${target.location}.related`,
    added: target.missingIds,
  }));
}

const RELATED_PRECEDING_KEYS = new Set([
  "name",
  "statement",
  "varies_by_class",
  "following_information",
  "following_information_bullets",
  "danger",
  "note",
  "notes",
]);

function assignRelatedInSchemaOrder(
  requirement: Requirement,
  related: string[],
): void {
  if (Array.isArray(requirement.related)) {
    requirement.related = related;
    return;
  }

  const reordered: Record<string, unknown> = {};
  let inserted = false;

  for (const [key, value] of Object.entries(requirement)) {
    if (!inserted && !RELATED_PRECEDING_KEYS.has(key)) {
      reordered.related = related;
      inserted = true;
    }

    reordered[key] = value;
  }

  if (!inserted) {
    reordered.related = related;
  }

  for (const key of Object.keys(requirement)) {
    delete (requirement as unknown as Record<string, unknown>)[key];
  }
  Object.assign(requirement, reordered);
}

export function applyRelatedRuleReferenceFixes(document: RulesDocument): {
  document: RulesDocument;
  fixes: RelatedRuleReferenceFix[];
  fixedCount: number;
} {
  const targets = collectRelatedRuleReferenceFixTargets(document);
  const fixes = targets.map((target) => ({
    location: `${target.location}.related`,
    added: target.missingIds,
  }));

  for (const target of targets) {
    const related = Array.isArray(target.requirement.related)
      ? [...target.requirement.related]
      : [];

    for (const missingId of target.missingIds) {
      if (!related.includes(missingId)) {
        related.push(missingId);
      }
    }

    assignRelatedInSchemaOrder(target.requirement, related);
  }

  return {
    document,
    fixes,
    fixedCount: fixes.reduce((total, fix) => total + fix.added.length, 0),
  };
}

export function collectRelatedRuleReferenceIssues(
  document: RulesDocument,
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  for (const { id, location, requirement } of collectRequirementEntries(
    document,
  )) {
    const mentions = collectRequirementRuleMentionSources(
      location,
      requirement,
    );
    mentions.delete(id);

    const related = Array.isArray(requirement.related)
      ? requirement.related.filter(
          (relatedId): relatedId is string => typeof relatedId === "string",
        )
      : null;
    const missingIds = [...mentions.keys()].filter(
      (mentionedId) => !related?.includes(mentionedId),
    );

    if (missingIds.length > 0) {
      const sourceSummary = missingIds
        .map(
          (mentionedId) =>
            `${mentionedId} in ${mentions.get(mentionedId)?.join(", ")}`,
        )
        .join("; ");

      if (!related) {
        issues.push(
          issue(
            `${location}.related`,
            `related must be an array containing mentioned FRR requirement IDs: ${sourceSummary}.`,
          ),
        );
      } else {
        issues.push(
          issue(
            `${location}.related`,
            `related is missing mentioned FRR requirement IDs: ${sourceSummary}.`,
          ),
        );
      }
    }

    if (!related) {
      continue;
    }

    for (const [index, relatedId] of related.entries()) {
      if (mentions.has(relatedId)) {
        continue;
      }

      issues.push(
        issue(
          `${location}.related[${index}]`,
          `related ID ${relatedId} is not mentioned in statement, note, notes, following_information, following_information_bullets, or varies_by_class text.`,
        ),
      );
    }
  }

  return issues;
}
