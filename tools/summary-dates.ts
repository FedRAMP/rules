import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getOptionValue } from "./src/cli";
import { loadRulesDocument } from "./src/rules";
import { getRepoRoot } from "./src/config";

interface EffectiveDates {
  obtain: string | null;
  maintain: string | null;
  grace_ends: string | null;
  grace_by_assessment_months: number | null;
}

interface DocRow {
  id: string;
  name: string;
  purpose: string;
  rev5Dates: EffectiveDates;
  twentyxDates: EffectiveDates;
  typesInData: string[];
}

function extractDates(info: Record<string, unknown>, typeKey: "20x" | "rev5"): EffectiveDates {
  // Per-type block takes precedence; fall back to top-level effective
  const typeBlock = info[typeKey] as Record<string, unknown> | undefined;
  const typeDate = (typeBlock?.effective as Record<string, unknown> | undefined)?.date as
    | Record<string, string>
    | undefined;
  if (typeDate) {
    return {
      obtain: typeDate.obtain ?? null,
      maintain: typeDate.maintain ?? null,
      grace_ends: typeDate.grace_ends ?? null,
      grace_by_assessment_months:
        typeDate.grace_by_assessment_months != null
          ? Number(typeDate.grace_by_assessment_months)
          : null,
    };
  }
  const topDate = (info.effective as Record<string, unknown> | undefined)?.date as
    | Record<string, string>
    | undefined;
  return {
    obtain: topDate?.obtain ?? null,
    maintain: topDate?.maintain ?? null,
    grace_ends: topDate?.grace_ends ?? null,
    grace_by_assessment_months:
      topDate?.grace_by_assessment_months != null
        ? Number(topDate.grace_by_assessment_months)
        : null,
  };
}

// Use non-breaking hyphens so date strings never wrap across table cells
function fmtDate(d: string | null): string {
  return d ? d.replace(/-/g, "‑") : "—";
}

function fmtGrace(dates: EffectiveDates): string {
  if (dates.grace_ends) return fmtDate(dates.grace_ends);
  if (dates.grace_by_assessment_months != null)
    return `+${dates.grace_by_assessment_months} months post‑assessment`;
  return "—";
}

function buildRows(doc: ReturnType<typeof loadRulesDocument>): DocRow[] {
  const rows: DocRow[] = [];
  for (const [id, frr] of Object.entries(doc.FRR)) {
    const info = frr.info as Record<string, unknown>;
    const name = (info.name as string) ?? id;
    const purpose = (info.purpose as string) ?? "";
    const rev5Dates = extractDates(info, "rev5");
    const twoxDates = extractDates(info, "20x");
    const typesInData = Object.keys(frr.data).filter((k) => k !== "all");
    rows.push({ id, name, purpose, rev5Dates, twentyxDates: twoxDates, typesInData });
  }
  rows.sort((a, b) => a.id.localeCompare(b.id));
  return rows;
}

function wrapPurpose(text: string): string {
  const max = 300;
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

function buildTable(rows: DocRow[], typeLabel: "20x" | "Rev5"): string {
  const typeKey = typeLabel === "20x" ? "20x" : "rev5";
  const lines: string[] = [];
  lines.push(`| ID | Name | Purpose | Obtain | Maintain | Grace Ends |`);
  lines.push(`|:---|:-----|:--------|:------:|:--------:|:----------:|`);
  for (const row of rows) {
    const dates = typeLabel === "20x" ? row.twentyxDates : row.rev5Dates;
    const hasTypeSpecific = row.typesInData.includes(typeKey);
    const note = hasTypeSpecific ? ` *(includes ${typeLabel}-specific requirements)*` : "";
    const cols = [
      `**${row.id}**`,
      row.name.replace(/\s*\(Needs Review\)\s*/g, "").trim(),
      wrapPurpose(row.purpose) + note,
      fmtDate(dates.obtain),
      fmtDate(dates.maintain),
      fmtGrace(dates),
    ];
    lines.push(`| ${cols.join(" | ")} |`);
  }
  return lines.join("\n");
}

function generateMarkdown(rows: DocRow[]): string {
  const sections: string[] = [];

  sections.push(`# FedRAMP Requirement Effective Dates`);
  sections.push(
    `Obtain, maintain, and grace-end dates for each FedRAMP Rules (FRR) document.\n` +
      `"—" indicates no date has been published yet for that document.\n` +
      `Where dates differ between authorization types, each table reflects the type-specific schedule.`
  );

  sections.push(`## Rev5`);
  sections.push(buildTable(rows, "Rev5"));

  sections.push(`\n## 20x`);
  sections.push(buildTable(rows, "20x"));

  return sections.join("\n\n");
}

const doc = loadRulesDocument();
const rows = buildRows(doc);
const markdown = generateMarkdown(rows);

const outputArg = getOptionValue("--output");
const outputPath = outputArg
  ? resolve(outputArg)
  : resolve(getRepoRoot(), "DATES.md");

writeFileSync(outputPath, markdown + "\n", "utf-8");
console.log(`Written: ${outputPath}`);