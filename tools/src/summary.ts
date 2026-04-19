import { writeRulesSummary } from "./summary-rules";

export const SUMMARY_SCOPES = ["rules"] as const;
export type SummaryScope = (typeof SUMMARY_SCOPES)[number];

export function isSummaryScope(value: string): value is SummaryScope {
  return (SUMMARY_SCOPES as readonly string[]).includes(value);
}

export function runSummaries(scope?: SummaryScope): SummaryScope[] {
  const scopes = scope ? [scope] : [...SUMMARY_SCOPES];

  for (const selectedScope of scopes) {
    if (selectedScope === "rules") {
      const outputPath = writeRulesSummary();
      console.log(`Wrote ${outputPath}`);
    }
  }

  return scopes;
}
