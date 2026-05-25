import * as XLSX from "xlsx";
import { getOptionValue } from "./src/cli";
import { loadRulesDocument } from "./src/rules";
import type { KsiIndicator, Requirement, RulesDocument } from "./src/types";

const CLASS_KEYS = ["a", "b", "c", "d"] as const;

function joinList(values: unknown): string {
  if (!Array.isArray(values)) return "";
  return values.filter((v): v is string => typeof v === "string").join("; ");
}

// artifacts: { "all"|"20x"|"rev5": { "all_classes"?: string[], "a"?: string[], ... } }
type ArtifactsByClass = Partial<Record<"all_classes" | "a" | "b" | "c" | "d", string[]>>;
type ArtifactsField = Record<string, ArtifactsByClass>;

function flattenArtifacts(artifacts: unknown): Record<string, string> {
  const merged: Record<"all_classes" | "a" | "b" | "c" | "d", string[]> = {
    all_classes: [], a: [], b: [], c: [], d: [],
  };

  if (!artifacts || typeof artifacts !== "object" || Array.isArray(artifacts)) {
    return {
      "Artifacts (All Classes)": "",
      "Artifacts (Class A)": "",
      "Artifacts (Class B)": "",
      "Artifacts (Class C)": "",
      "Artifacts (Class D)": "",
    };
  }

  for (const appVal of Object.values(artifacts as ArtifactsField)) {
    for (const key of Object.keys(merged) as (keyof typeof merged)[]) {
      if (Array.isArray(appVal[key])) {
        merged[key].push(...appVal[key]!.filter(Boolean));
      }
    }
  }

  return {
    "Artifacts (All Classes)": merged.all_classes.join("; "),
    "Artifacts (Class A)": merged.a.join("; "),
    "Artifacts (Class B)": merged.b.join("; "),
    "Artifacts (Class C)": merged.c.join("; "),
    "Artifacts (Class D)": merged.d.join("; "),
  };
}

function lastUpdatedDate(updated: Requirement["updated"]): string {
  return updated?.[0]?.date ?? "";
}

function lastUpdatedComment(updated: Requirement["updated"]): string {
  return updated?.[0]?.comment ?? "";
}

// ── FRD ──────────────────────────────────────────────────────────────────────

function buildFrdRows(document: RulesDocument) {
  const rows: Record<string, string>[] = [];

  for (const [scopeKey, definitions] of Object.entries(document.FRD.data ?? {})) {
    for (const [id, def] of Object.entries(definitions)) {
      rows.push({
        ID: id,
        Applicability: scopeKey,
        Term: def.term,
        Tag: def.tag ?? "",
        Alts: joinList(def.alts),
        Definition: def.definition,
        Note: def.note ?? joinList(def.notes),
        Reference: def.reference ?? "",
        "Reference URL": def.reference_url ?? def.referenceurl ?? "",
        "Last Updated": lastUpdatedDate(def.updated),
        "Update Comment": lastUpdatedComment(def.updated),
      });
    }
  }

  return rows;
}

// ── FRR ──────────────────────────────────────────────────────────────────────

function statementForClass(req: Requirement, classKey: (typeof CLASS_KEYS)[number]): string {
  return req.varies_by_class?.[classKey]?.statement ?? "";
}

function pkwForClass(req: Requirement, classKey: (typeof CLASS_KEYS)[number]): string {
  return req.varies_by_class?.[classKey]?.primary_key_word ?? "";
}

function buildFrrRows(document: RulesDocument) {
  const rows: Record<string, string>[] = [];

  for (const [sectionKey, section] of Object.entries(document.FRR ?? {})) {
    for (const [applicability, scope] of Object.entries(section.data ?? {})) {
      for (const [subsetKey, requirements] of Object.entries(scope ?? {})) {
        for (const [id, req] of Object.entries(requirements)) {
          const hasVariants = Boolean(req.varies_by_class);

          rows.push({
            ID: id,
            Process: sectionKey,
            Applicability: applicability,
            Subset: subsetKey,
            Name: req.name,
            Statement: req.statement ?? "",
            "Primary Keyword": req.primary_key_word ?? "",
            "Statement (Class A)": hasVariants ? statementForClass(req, "a") : "",
            "Keyword (Class A)": hasVariants ? pkwForClass(req, "a") : "",
            "Statement (Class B)": hasVariants ? statementForClass(req, "b") : "",
            "Keyword (Class B)": hasVariants ? pkwForClass(req, "b") : "",
            "Statement (Class C)": hasVariants ? statementForClass(req, "c") : "",
            "Keyword (Class C)": hasVariants ? pkwForClass(req, "c") : "",
            "Statement (Class D)": hasVariants ? statementForClass(req, "d") : "",
            "Keyword (Class D)": hasVariants ? pkwForClass(req, "d") : "",
            "Following Information": joinList(req.following_information),
            Note: req.note ?? joinList(req.notes),
            Affects: joinList(req.affects),
            Controls: joinList((req as unknown as Record<string, unknown>).controls),
            Terms: joinList(req.terms),
            "Timeframe Type": String((req as unknown as Record<string, unknown>).timeframe_type ?? ""),
            "Timeframe Num": String((req as unknown as Record<string, unknown>).timeframe_num ?? ""),
            ...flattenArtifacts((req as unknown as Record<string, unknown>).artifacts),
            "Last Updated": lastUpdatedDate(req.updated),
            "Update Comment": lastUpdatedComment(req.updated),
          });
        }
      }
    }
  }

  return rows;
}

// ── KSI ──────────────────────────────────────────────────────────────────────

function ksiStatementForClass(ind: KsiIndicator, classKey: (typeof CLASS_KEYS)[number]): string {
  return ind.varies_by_class?.[classKey]?.statement ?? "";
}

function buildKsiRows(document: RulesDocument) {
  const rows: Record<string, string>[] = [];

  for (const [themeKey, theme] of Object.entries(document.KSI ?? {})) {
    const indicators = Array.isArray(theme.indicators)
      ? Object.fromEntries(theme.indicators.map((ind, i) => [`KSI-${themeKey}-${String(i + 1).padStart(3, "0")}`, ind]))
      : theme.indicators;

    for (const [id, ind] of Object.entries(indicators ?? {})) {
      const hasVariants = Boolean(ind.varies_by_class);

      rows.push({
        ID: id,
        Theme: themeKey,
        "Theme Name": theme.name,
        Name: ind.name,
        Statement: ind.statement ?? "",
        "Statement (Class A)": hasVariants ? ksiStatementForClass(ind, "a") : "",
        "Statement (Class B)": hasVariants ? ksiStatementForClass(ind, "b") : "",
        "Statement (Class C)": hasVariants ? ksiStatementForClass(ind, "c") : "",
        "Statement (Class D)": hasVariants ? ksiStatementForClass(ind, "d") : "",
        Controls: joinList((ind as unknown as Record<string, unknown>).controls),
        Terms: joinList(ind.terms),
        Note: ind.note ?? joinList(ind.notes),
        "Last Updated": lastUpdatedDate(ind.updated),
        "Update Comment": lastUpdatedComment(ind.updated),
      });
    }
  }

  return rows;
}

// ── Main ─────────────────────────────────────────────────────────────────────

const outputPath = getOptionValue("--output") ?? "../fedramp-consolidated-rules.xlsx";

const document = loadRulesDocument();

const wb = XLSX.utils.book_new();

const frdRows = buildFrdRows(document);
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(frdRows), "FRD Definitions");

const frrRows = buildFrrRows(document);
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(frrRows), "FRR Requirements");

const ksiRows = buildKsiRows(document);
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ksiRows), "KSI Indicators");

XLSX.writeFile(wb, outputPath);

console.log(`Wrote ${frdRows.length} FRD definitions, ${frrRows.length} FRR requirements, ${ksiRows.length} KSI indicators.`);
console.log(`Spreadsheet saved to: ${outputPath}`);
