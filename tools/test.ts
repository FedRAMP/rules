import {
  collectConsistencyChecks,
  collectFrrSubsetForceOrderWarnings,
  type ConsistencyCheck,
  type ConsistencyIssue,
} from "./src/consistency";
import {
  collectMetadataFreshnessWarnings,
  latestCommitMetadata,
  type MetadataFreshnessWarning,
} from "./src/metadata-freshness";
import { collectPropertyOrderIssues } from "./src/property-order";
import { loadRulesDocument, loadSchemaDocument } from "./src/rules";
import type { PropertyOrderIssue } from "./src/types";

const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function useColor(): boolean {
  return !process.env.NO_COLOR && process.env.TERM !== "dumb";
}

function color(value: string, code: string): string {
  if (!useColor()) {
    return value;
  }

  return `${code}${value}${RESET}`;
}

function plural(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

function formatPath(path: string): string {
  return color(path, CYAN);
}

function formatProblem(value: string): string {
  return color(value, RED);
}

function formatExpected(values: string[]): string {
  return color(values.join(", "), GREEN);
}

function formatActual(values: string[]): string {
  return color(values.join(", "), YELLOW);
}

function formatConsistencyFailureSummary(checks: ConsistencyCheck[]): string {
  const failedChecks = checks.filter((check) => check.issues.length > 0);
  const issueCount = failedChecks.reduce(
    (total, check) => total + check.issues.length,
    0,
  );
  const lines = [
    `${formatProblem("Consistency validation failed")} with ${formatProblem(
      `${issueCount} ${plural(issueCount, "issue")}`,
    )}:`,
  ];

  for (const check of failedChecks) {
    lines.push(
      "",
      `${color(check.title, BOLD)} ${color(
        `(${check.issues.length} ${plural(check.issues.length, "issue")})`,
        DIM,
      )}`,
    );

    for (const issue of check.issues) {
      lines.push("", `  - ${formatPath(issue.location)}`);
      lines.push(`    ${issue.message}`);
    }
  }

  return lines.join("\n");
}

function formatPropertyOrderFailureSummary(
  issues: PropertyOrderIssue[],
): string {
  const lines = [
    `${formatProblem(
      "Property order failed",
    )} with ${formatProblem(`${issues.length} ${plural(issues.length, "issue")}`)}:`,
  ];

  for (const issue of issues) {
    lines.push("", `  - ${formatPath(issue.path)}`);
    lines.push(`    expected: ${formatExpected(issue.expectedOrder)}`);
    lines.push(`    found:    ${formatActual(issue.actualOrder)}`);
  }

  return lines.join("\n");
}

function formatMetadataFreshnessWarningSummary(
  warnings: MetadataFreshnessWarning[],
): string {
  return [
    color("Metadata freshness warning", `${BOLD}${YELLOW}`),
    ...warnings.map(
      (warning) => `  - ${formatPath(warning.field)}: ${warning.message}`,
    ),
    "    Update fedramp-consolidated-rules.json metadata before publishing this branch.",
  ].join("\n");
}

function formatFrrSubsetForceOrderWarningSummary(
  warnings: ConsistencyIssue[],
): string {
  return [
    color("FRR subset force order warning", `${BOLD}${YELLOW}`),
    ...warnings.map(
      (warning) => `  - ${formatPath(warning.location)}: ${warning.message}`,
    ),
    "    Reorder these rule groups manually; no automatic fix is provided.",
  ].join("\n");
}

const testResult = Bun.spawnSync({
  cmd: ["bun", "test"],
  stdout: "inherit",
  stderr: "inherit",
});

const rulesDocument = loadRulesDocument();
const schemaDocument = loadSchemaDocument();
const metadataFreshnessWarnings = collectMetadataFreshnessWarnings(
  rulesDocument,
  latestCommitMetadata(),
);
const frrSubsetForceOrderWarnings =
  collectFrrSubsetForceOrderWarnings(rulesDocument);
const consistencyChecks = collectConsistencyChecks(rulesDocument);
const consistencyFailed = consistencyChecks.some(
  (check) => check.issues.length > 0,
);
const propertyOrderIssues = collectPropertyOrderIssues(
  rulesDocument,
  schemaDocument,
);
const propertyOrderFailed = propertyOrderIssues.length > 0;
const finalReports: string[] = [];

if (metadataFreshnessWarnings.length > 0) {
  console.warn(
    `\n${color("-----", DIM)}\n\n${formatMetadataFreshnessWarningSummary(
      metadataFreshnessWarnings,
    )}\n`,
  );
}

if (frrSubsetForceOrderWarnings.length > 0) {
  console.warn(
    `\n${color("-----", DIM)}\n\n${formatFrrSubsetForceOrderWarningSummary(
      frrSubsetForceOrderWarnings,
    )}\n`,
  );
}

if (consistencyFailed) {
  finalReports.push(formatConsistencyFailureSummary(consistencyChecks));
}

if (propertyOrderFailed) {
  finalReports.push(formatPropertyOrderFailureSummary(propertyOrderIssues));
}

if (finalReports.length > 0) {
  console.error(
    `\n${color("-----", DIM)}\n\n${color(
      "⚠️ 🙈",
      `${BOLD}${RED}`,
    )}\n\n${finalReports.map((report) => report.trimEnd()).join("\n\n")}\n\n`,
  );
}

process.exit(
  consistencyFailed || propertyOrderFailed ? 1 : (testResult.exitCode ?? 1),
);
