import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { getRepoRoot } from "./src/config";
import { loadRulesDocument } from "./src/rules";
import type { Requirement, RulesDocument, UpdatedEntry } from "./src/types";

const DEFAULT_KEYWORD_ORDER = ["MUST", "MUST NOT", "SHOULD", "SHOULD NOT", "MAY"];

interface ProcessSummary {
  shortName: string;
  name: string;
  rev5Status: string;
  rev5ObtainDate: string;
  rev5MaintainDate: string;
  rev5GraceEndsDate: string;
  twentyXStatus: string;
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

function incrementKeywordCount(keywordCounts: Map<string, number>, keyword?: string): void {
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

function updateLatestDate(currentLatest: string | null, candidate: string | null): string | null {
  if (!candidate) {
    return currentLatest;
  }

  if (!currentLatest || candidate > currentLatest) {
    return candidate;
  }

  return currentLatest;
}

function getEffectiveDate(
  value: Record<string, unknown>,
  framework: "rev5" | "20x",
  dateKey: "obtain" | "maintain" | "grace_ends",
): string {
  const applicability = getInfoString(value, ["effective", framework, "is"], "");
  if (applicability === "no") {
    return "N/A";
  }

  return getInfoString(value, ["effective", framework, "date", dateKey], "N/A");
}

function summarizeProcess(shortName: string, process: RulesDocument["FRR"][string]): ProcessSummary {
  const keywordCounts = new Map<string, number>();
  let latestUpdated: string | null = null;

  for (const labelGroups of Object.values(process.data)) {
    for (const rulesById of Object.values(labelGroups)) {
      for (const requirement of Object.values(rulesById as Record<string, Requirement>)) {
        incrementKeywordCount(keywordCounts, requirement.primary_key_word);

        for (const level of Object.values(requirement.varies_by_level ?? {})) {
          incrementKeywordCount(keywordCounts, level?.primary_key_word);
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
    rev5Status: getInfoString(process.info, ["effective", "rev5", "current_status"]),
    rev5ObtainDate: getEffectiveDate(process.info, "rev5", "obtain"),
    rev5MaintainDate: getEffectiveDate(process.info, "rev5", "maintain"),
    rev5GraceEndsDate: getEffectiveDate(process.info, "rev5", "grace_ends"),
    twentyXStatus: getInfoString(process.info, ["effective", "20x", "current_status"]),
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

  const ordered = DEFAULT_KEYWORD_ORDER.filter((keyword) => discovered.has(keyword));
  const additional = [...discovered]
    .filter((keyword) => !DEFAULT_KEYWORD_ORDER.includes(keyword))
    .sort((left, right) => left.localeCompare(right));

  return [...ordered, ...additional];
}

function escapeTableCell(value: string): string {
  return value.replaceAll("|", "\\|");
}

function renderTable(summaries: ProcessSummary[], keywordColumns: string[]): string {
  const header = [
    "Short Name",
    "Name",
    "Rev5 Status",
    "Rev5 Obtain",
    "Rev5 Maintain",
    "Rev5 Grace Ends",
    "20x Status",
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
      escapeTableCell(summary.rev5Status),
      summary.rev5ObtainDate,
      summary.rev5MaintainDate,
      summary.rev5GraceEndsDate,
      escapeTableCell(summary.twentyXStatus),
      summary.twentyXObtainDate,
      summary.twentyXMaintainDate,
      summary.twentyXGraceEndsDate,
      ...keywordCells,
      summary.latestUpdated,
    ];
  });

  return [header, divider, ...rows].map((row) => `| ${row.join(" | ")} |`).join("\n");
}

function buildSummaryMarkdown(document: RulesDocument): string {
  const summaries = Object.entries(document.FRR)
    .map(([shortName, process]) => summarizeProcess(shortName, process))
    .sort((left, right) => left.shortName.localeCompare(right.shortName));
  const keywordColumns = getKeywordColumns(summaries);
  const table = renderTable(summaries, keywordColumns);

  return [
    "# FedRAMP Rules Summary",
    "",
    `Generated from \`fedramp-consolidated-rules.json\` (version ${document.info.version}, last updated ${document.info.last_updated}).`,
    "",
    table,
    "",
  ].join("\n");
}

const document = loadRulesDocument();
const outputPath = resolve(getRepoRoot(), "RULES.md");
const markdown = buildSummaryMarkdown(document);

writeFileSync(outputPath, markdown, "utf-8");
console.log(`Wrote ${outputPath}`);
