import type { RulesDocument } from "./types";
import type { ConsistencyIssue } from "./consistency";

const CLASSES = ["b", "c", "d"] as const;
const SOURCES = [
  { process: "FRC", id: "FRC-CSF-BSL", kind: "force" },
  { process: "IVV", id: "IVV-CSF-AIA", kind: "yearly" },
] as const;

/** Source lists use AC-02 (01); CTL keys use AC-02-01. */
export function normalizeRev5ControlId(value: string): string | null {
  const match = /^([A-Z]{2}-\d{2})(?: \((\d{2})\))?$/.exec(value);
  return match ? `${match[1]}${match[2] ? `-${match[2]}` : ""}` : null;
}

export function collectControlMetadataIssues(
  document: RulesDocument,
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  // CTL is optional in small documents. Source-bearing documents must include
  // all referenced controls even if CTL was accidentally deleted.
  if (
    !document.CTL &&
    !SOURCES.some((s) => document.FRR?.[s.process]?.data?.rev5?.CSF?.[s.id])
  )
    return issues;
  for (const source of SOURCES) {
    const sourcePath = `FRR.${source.process}.data.rev5.CSF.${source.id}`;
    const rule = document.FRR?.[source.process]?.data?.rev5?.CSF?.[source.id];
    for (const cls of CLASSES) {
      const listPath = `${sourcePath}.varies_by_class.${cls}.rev5_controls_list`;
      const list = rule?.varies_by_class?.[cls]?.rev5_controls_list;
      if (!list || typeof list !== "object" || Array.isArray(list)) {
        issues.push({
          location: listPath,
          message: `Missing source control list for ${source.id}, Class ${cls.toUpperCase()}; metadata cannot be verified.`,
        });
        continue;
      }
      const included = new Set<string>();
      for (const [family, values] of Object.entries(list)) {
        if (!Array.isArray(values)) {
          issues.push({
            location: `${listPath}.${family}`,
            message: "Expected an array of Rev5 control IDs.",
          });
          continue;
        }
        for (const [index, value] of values.entries()) {
          const id =
            typeof value === "string" ? normalizeRev5ControlId(value) : null;
          if (!id || id.slice(0, 2) !== family) {
            issues.push({
              location: `${listPath}.${family}[${index}]`,
              message: `Invalid control ID or family: ${JSON.stringify(value)}.`,
            });
            continue;
          }
          if (included.has(id))
            issues.push({
              location: `${listPath}.${family}[${index}]`,
              message: `Duplicate source control ${id}.`,
            });
          included.add(id);
          if (!document.CTL?.[family]?.[id])
            issues.push({
              location: `CTL.${family}.${id}`,
              message: `Missing control referenced by ${listPath}.`,
            });
        }
      }
      for (const [family, controls] of Object.entries(document.CTL ?? {})) {
        for (const [id, control] of Object.entries(controls)) {
          const expected =
            source.kind === "force"
              ? included.has(id)
                ? "MUST"
                : "MAY"
              : included.has(id);
          const actual =
            source.kind === "force"
              ? control.varies_by_class?.[cls]?.force
              : control.assess_yearly_by_class?.[cls];
          const field =
            source.kind === "force"
              ? `varies_by_class.${cls}.force`
              : `assess_yearly_by_class.${cls}`;
          if (actual !== expected)
            issues.push({
              location: `CTL.${family}.${id}.${field}`,
              message: `Expected ${JSON.stringify(expected)} from ${listPath}; found ${JSON.stringify(actual) ?? "missing"}.`,
            });
        }
      }
    }
  }
  return issues;
}

export function formatControlMetadataSummary(
  document: RulesDocument,
  issues: ConsistencyIssue[],
): string {
  const controls = Object.values(document.CTL ?? {}).flatMap((family) =>
    Object.values(family),
  );
  return [
    `Rev5 control metadata: ${controls.length} controls checked; ${issues.length} issues.`,
    ...CLASSES.map((cls) => {
      const must = controls.filter(
        (control) => control.varies_by_class?.[cls]?.force === "MUST",
      ).length;
      const may = controls.filter(
        (control) => control.varies_by_class?.[cls]?.force === "MAY",
      ).length;
      const yearly = controls.filter(
        (control) => control.assess_yearly_by_class?.[cls] === true,
      ).length;
      return `  Class ${cls.toUpperCase()}: ${must} MUST, ${may} MAY; ${yearly} assessed yearly.`;
    }),
  ].join("\n");
}
