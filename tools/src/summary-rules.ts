import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { getRepoRoot } from "./config";
import { loadRulesDocument } from "./rules";
import type { Requirement, RulesDocument, UpdatedEntry } from "./types";

const DEFAULT_KEYWORD_ORDER = [
  "MUST",
  "MUST NOT",
  "SHOULD",
  "SHOULD NOT",
  "MAY",
];

interface ProcessSummary {
  shortName: string;
  name: string;
  documentStatus: string;
  requirementCount: number;
  rev5ObtainDate: string;
  rev5MaintainDate: string;
  rev5GraceEndsDate: string;
  twentyXObtainDate: string;
  twentyXMaintainDate: string;
  twentyXGraceEndsDate: string;
  keywordCounts: Map<string, number>;
  latestUpdated: string;
}

function getInfoString(
  value: Record<string, unknown>,
  path: string[],
  fallback = "-",
): string {
  let current: unknown = value;

  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return fallback;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === "string" && current.length > 0 ? current : fallback;
}

function incrementKeywordCount(
  keywordCounts: Map<string, number>,
  keyword?: string,
): void {
  if (!keyword) {
    return;
  }

  keywordCounts.set(keyword, (keywordCounts.get(keyword) ?? 0) + 1);
}

function getLatestUpdatedDate(updated?: UpdatedEntry[]): string | null {
  let latest: string | null = null;

  for (const entry of updated ?? []) {
    if (!latest || entry.date > latest) {
      latest = entry.date;
    }
  }

  return latest;
}

function updateLatestDate(
  currentLatest: string | null,
  candidate: string | null,
): string | null {
  if (!candidate) {
    return currentLatest;
  }

  if (!currentLatest || candidate > currentLatest) {
    return candidate;
  }

  return currentLatest;
}

function getInfoRecord(
  value: Record<string, unknown>,
  path: string[],
): Record<string, unknown> | null {
  let current: unknown = value;

  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return null;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current && typeof current === "object" && !Array.isArray(current)
    ? (current as Record<string, unknown>)
    : null;
}

function getEffectiveInfo(
  value: Record<string, unknown>,
  framework: "rev5" | "20x",
): Record<string, unknown> | null {
  return (
    getInfoRecord(value, [framework, "effective"]) ??
    getInfoRecord(value, ["effective"])
  );
}

function getEffectiveDate(
  value: Record<string, unknown>,
  framework: "rev5" | "20x",
  dateKey: "obtain" | "maintain" | "grace_ends",
): string {
  const effective = getEffectiveInfo(value, framework);
  if (!effective) {
    return "N/A";
  }

  const applicability = getInfoString(effective, ["is"], "");
  if (applicability === "no") {
    return "N/A";
  }

  return getInfoString(effective, ["date", dateKey], "N/A");
}

function summarizeProcess(
  shortName: string,
  process: RulesDocument["FRR"][string],
): ProcessSummary {
  const keywordCounts = new Map<string, number>();
  let latestUpdated: string | null = null;
  let requirementCount = 0;

  for (const labelGroups of Object.values(process.data)) {
    for (const rulesById of Object.values(labelGroups)) {
      for (const requirement of Object.values(
        rulesById as Record<string, Requirement>,
      )) {
        requirementCount += 1;
        incrementKeywordCount(keywordCounts, requirement.primary_key_word);

        for (const classVariant of Object.values(
          requirement.varies_by_class ?? {},
        )) {
          incrementKeywordCount(keywordCounts, classVariant?.primary_key_word);
        }

        latestUpdated = updateLatestDate(
          latestUpdated,
          getLatestUpdatedDate(requirement.updated),
        );
      }
    }
  }

  return {
    shortName,
    name: getInfoString(process.info, ["name"]),
    documentStatus: getInfoString(process.info, ["status"]),
    requirementCount,
    rev5ObtainDate: getEffectiveDate(process.info, "rev5", "obtain"),
    rev5MaintainDate: getEffectiveDate(process.info, "rev5", "maintain"),
    rev5GraceEndsDate: getEffectiveDate(process.info, "rev5", "grace_ends"),
    twentyXObtainDate: getEffectiveDate(process.info, "20x", "obtain"),
    twentyXMaintainDate: getEffectiveDate(process.info, "20x", "maintain"),
    twentyXGraceEndsDate: getEffectiveDate(process.info, "20x", "grace_ends"),
    keywordCounts,
    latestUpdated: latestUpdated ?? "-",
  };
}

function getKeywordColumns(summaries: ProcessSummary[]): string[] {
  const discovered = new Set<string>();

  for (const summary of summaries) {
    for (const keyword of summary.keywordCounts.keys()) {
      discovered.add(keyword);
    }
  }

  const ordered = DEFAULT_KEYWORD_ORDER.filter((keyword) =>
    discovered.has(keyword),
  );
  const additional = [...discovered]
    .filter((keyword) => !DEFAULT_KEYWORD_ORDER.includes(keyword))
    .sort((left, right) => left.localeCompare(right));

  return [...ordered, ...additional];
}

function escapeTableCell(value: string): string {
  return value.replaceAll("|", "\\|");
}

function renderTable(
  summaries: ProcessSummary[],
  keywordColumns: string[],
): string {
  const header = [
    "Short Name",
    "Name",
    "Document Status",
    "Requirements",
    "Rev5 Obtain",
    "Rev5 Maintain",
    "Rev5 Grace Ends",
    "20x Obtain",
    "20x Maintain",
    "20x Grace Ends",
    ...keywordColumns,
    "Most Recently Updated",
  ];

  const divider = header.map(() => "---");
  const rows = summaries.map((summary) => {
    const keywordCells = keywordColumns.map((keyword) =>
      String(summary.keywordCounts.get(keyword) ?? 0),
    );

    return [
      escapeTableCell(summary.shortName),
      escapeTableCell(summary.name),
      escapeTableCell(summary.documentStatus),
      String(summary.requirementCount),
      summary.rev5ObtainDate,
      summary.rev5MaintainDate,
      summary.rev5GraceEndsDate,
      summary.twentyXObtainDate,
      summary.twentyXMaintainDate,
      summary.twentyXGraceEndsDate,
      ...keywordCells,
      summary.latestUpdated,
    ];
  });

  return [header, divider, ...rows]
    .map((row) => `| ${row.join(" | ")} |`)
    .join("\n");
}

function countFrdDefinitions(document: RulesDocument): number {
  return Object.values(document.FRD.data).reduce(
    (count, definitions) => count + Object.keys(definitions).length,
    0,
  );
}

function countKsiIndicators(document: RulesDocument): number {
  return Object.values(document.KSI).reduce(
    (count, theme) => count + Object.keys(theme.indicators).length,
    0,
  );
}

export function buildRulesSummaryMarkdown(document: RulesDocument): string {
  const summaries = Object.entries(document.FRR)
    .map(([shortName, process]) => summarizeProcess(shortName, process))
    .sort((left, right) => left.shortName.localeCompare(right.shortName));
  const keywordColumns = getKeywordColumns(summaries);
  const table = renderTable(summaries, keywordColumns);
  const requirementCount = summaries.reduce(
    (count, summary) => count + summary.requirementCount,
    0,
  );

  return [
    "# FedRAMP Rules Summary",
    "",
    `Generated from \`fedramp-consolidated-rules.json\` (version ${document.info.version}, last updated ${document.info.last_updated}).`,
    "",
    "`fedramp-consolidated-rules.json` is the source of truth for the Consolidated Rules for 2026 Public Preview. This file is generated for quick review; update the JSON and run `bun run build` from `tools` to refresh it.",
    "",
    "## Dataset Overview",
    "",
    `- ${countFrdDefinitions(document)} FRD definitions`,
    `- ${summaries.length} FRR process documents`,
    `- ${requirementCount} FRR requirement records`,
    `- ${Object.keys(document.KSI).length} KSI themes`,
    `- ${countKsiIndicators(document)} KSI indicators`,
    "",
    "## FRR Process Summary",
    "",
    "Requirement counts are the leaf records under each `FRR.*.data` tree. Keyword counts include top-level requirements and class-specific variants when a requirement uses `varies_by_class`.",
    "",
    table,
    "",
  ].join("\n");
}

export function writeRulesSummary(): string {
  const document = loadRulesDocument();
  const outputPath = resolve(getRepoRoot(), "RULES.md");
  const markdown = buildRulesSummaryMarkdown(document);

  writeFileSync(outputPath, markdown, "utf-8");
  return outputPath;
}
