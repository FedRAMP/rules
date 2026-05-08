import { visitIndicators, visitRequirements } from "./traversal";
import type {
  ClassKey,
  DefinitionEntry,
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
const CLASS_NAMES: Record<ClassKey, string> = {
  a: "Class A",
  b: "Class B",
  c: "Class C",
  d: "Class D",
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
const ALLOWED_NOTIFICATION_METHODS = ["email", "update", "web"] as const;
const ALLOWED_NOTIFICATION_PARTIES = [
  "FedRAMP",
  "Provider",
  "all necessary parties",
  "public",
] as const;
const ALLOWED_TIMEFRAME_TYPES = [
  "bizdays",
  "days",
  "hours",
  "month",
  "months",
  "years",
] as const;

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

  return [
    `Consistency validation failed with ${issueCount} ${issueLabel}.`,
    "",
    ...failedChecks.flatMap((check) => [
      formatConsistencyIssues(check.title, check.issues),
      "",
    ]),
  ].join("\n");
}

export function collectConsistencyChecks(document: RulesDocument): ConsistencyCheck[] {
  return [
    {
      title: "Full ID alignment",
      issues: collectFullIdAlignmentIssues(document),
    },
    {
      title: "FRR label declarations",
      issues: collectFrrLabelDeclarationIssues(document),
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
  labelKey: string;
  id: string;
  requirement: Requirement;
  location: string;
}> {
  const entries: Array<{
    sectionKey: string;
    scopeKey: string;
    labelKey: string;
    id: string;
    requirement: Requirement;
    location: string;
  }> = [];

  for (const [sectionKey, section] of Object.entries(document.FRR ?? {})) {
    for (const [scopeKey, scope] of Object.entries(section.data ?? {})) {
      for (const [labelKey, requirements] of Object.entries(scope ?? {})) {
        for (const [id, requirement] of Object.entries(requirements ?? {})) {
          entries.push({
            sectionKey,
            scopeKey,
            labelKey,
            id,
            requirement,
            location: `FRR.${sectionKey}.data.${scopeKey}.${labelKey}.${id}`,
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
          theme.indicators.map((indicator, index) => [`${theme.id}-${index}`, indicator]),
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

  for (const [scopeKey, definitions] of Object.entries(document.FRD.data ?? {})) {
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

export function collectFullIdAlignmentIssues(document: RulesDocument): ConsistencyIssue[] {
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
        issue(entry.location, `definition ID must start with FRD-, but found ${entry.id}.`),
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
        issue(entry.location, `requirement ID ${entry.id} does not match ABC-LBL-XYZ format.`),
      );
      continue;
    }

    const [, idSection, idLabel] = match;
    if (idSection !== entry.sectionKey) {
      issues.push(
        issue(
          entry.location,
          `requirement ID first segment is ${idSection}, but the containing FRR document is ${entry.sectionKey}.`,
        ),
      );
    }
    if (idLabel !== entry.labelKey) {
      issues.push(
        issue(
          entry.location,
          `requirement ID middle segment is ${idLabel}, but the containing label bucket is ${entry.labelKey}.`,
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
        issue(entry.location, `indicator ID ${entry.id} does not match KSI-ABC-XYZ format.`),
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

export function collectFrrLabelDeclarationIssues(document: RulesDocument): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  for (const [sectionKey, section] of Object.entries(document.FRR ?? {})) {
    const declaredLabels = new Set(Object.keys(section.info.labels ?? {}));

    for (const [scopeKey, scope] of Object.entries(section.data ?? {})) {
      for (const labelKey of Object.keys(scope ?? {})) {
        if (!declaredLabels.has(labelKey)) {
          issues.push(
            issue(
              `FRR.${sectionKey}.data.${scopeKey}.${labelKey}`,
              `label bucket ${labelKey} is used in data but is not declared in FRR.${sectionKey}.info.labels.`,
            ),
          );
        }
      }
    }
  }

  return issues;
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

  const expectedOrder = [...dates].sort((left, right) => right.localeCompare(left));
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

export function collectAuditHistoryIssues(document: RulesDocument): ConsistencyIssue[] {
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

export function collectTextHygieneIssues(document: RulesDocument): ConsistencyIssue[] {
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
      issues.push(issue(location, "text value has leading or trailing whitespace."));
    }
    if (TEXT_CONTROL_CHARACTER_REGEX.test(value)) {
      issues.push(issue(location, "text value contains a control character."));
    }
  });

  return issues;
}

export function collectClassVariantStatementIssues(document: RulesDocument): ConsistencyIssue[] {
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
      const unexpectedClasses = mentionedClasses.filter((className) => className !== expectedClass);
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

function collectAffectsIssues(location: string, requirement: Requirement): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const affects = requirement.affects ?? [];

  if (affects.length === 0) {
    issues.push(issue(`${location}.affects`, "affects must list at least one party."));
    return issues;
  }

  const duplicateAffects = collectDuplicateValues(affects);
  if (duplicateAffects.length > 0) {
    issues.push(
      issue(`${location}.affects`, `affects contains duplicate values: ${duplicateAffects.join(", ")}.`),
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

function collectControlIssues(location: string, entity: RequirementLike): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const controls = isRecord(entity) && Array.isArray(entity.controls)
    ? entity.controls.filter((control): control is string => typeof control === "string")
    : [];

  const duplicateControls = collectDuplicateValues(controls);
  if (duplicateControls.length > 0) {
    issues.push(
      issue(`${location}.controls`, `controls contains duplicate IDs: ${duplicateControls.join(", ")}.`),
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

function collectTimeframeIssues(value: unknown, path: JsonPathSegment[]): ConsistencyIssue[] {
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
      if (!(ALLOWED_TIMEFRAME_TYPES as readonly string[]).includes(node.timeframe_type)) {
        issues.push(
          issue(
            `${location}.timeframe_type`,
            `timeframe_type ${node.timeframe_type} is not allowed. Allowed values are: ${joinAllowed(ALLOWED_TIMEFRAME_TYPES)}.`,
          ),
        );
      }
    }

    if (hasNum && typeof node.timeframe_num === "number" && node.timeframe_num <= 0) {
      issues.push(
        issue(`${location}.timeframe_num`, "timeframe_num must be greater than zero."),
      );
    }
  });

  return issues;
}

function collectNotificationIssues(value: unknown, path: JsonPathSegment[]): ConsistencyIssue[] {
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
        !(ALLOWED_NOTIFICATION_METHODS as readonly string[]).includes(notification.method)
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
        !(ALLOWED_NOTIFICATION_PARTIES as readonly string[]).includes(notification.party)
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

export function collectControlledVocabularyIssues(document: RulesDocument): ConsistencyIssue[] {
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

export function collectFrdTermLookupIssues(document: RulesDocument): ConsistencyIssue[] {
  const candidateMap = new Map<
    string,
    Map<string, { id: string; term: string; location: string }>
  >();

  for (const entry of collectDefinitionEntries(document)) {
    const candidates = [entry.definition.term, ...(entry.definition.alts ?? [])];
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

  return issues.sort((left, right) => left.message.localeCompare(right.message));
}

function collectReferenceIds(document: RulesDocument): {
  requirementIds: Set<string>;
  indicatorIds: Set<string>;
  webNames: Set<string>;
} {
  const requirementIds = new Set(collectRequirementEntries(document).map((entry) => entry.id));
  const indicatorIds = new Set(collectIndicatorEntries(document).map((entry) => entry.id));
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

export function collectCrossReferenceIssues(document: RulesDocument): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const { requirementIds, indicatorIds, webNames } = collectReferenceIds(document);

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
        issues.push(issue(location, `referenced KSI indicator ID ${id} does not exist.`));
      }
    }

    for (const match of value.matchAll(INLINE_FRR_ID_REGEX)) {
      const id = match[1];
      if (!id) {
        continue;
      }
      if (!requirementIds.has(id)) {
        issues.push(issue(location, `referenced FRR requirement ID ${id} does not exist.`));
      }
    }
  });

  return issues;
}
