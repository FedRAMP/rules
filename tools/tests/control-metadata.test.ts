import { expect, test } from "bun:test";
import {
  collectControlMetadataIssues,
  normalizeRev5ControlId,
  formatControlMetadataSummary,
} from "../src/control-metadata";
import {
  collectConsistencyChecks,
  formatConsistencyReport,
} from "../src/consistency";
import { loadRulesDocument } from "../src/rules";
import { validateSchema } from "../src/schema-validation";

const classes = ["b", "c", "d"] as const;

test("every CTL class force and annual assessment flag matches the source rules", () => {
  const document = loadRulesDocument();
  const baseline = document.FRR.FRC!.data.rev5!.CSF!["FRC-CSF-BSL"]!;
  const annual = document.FRR.IVV!.data.rev5!.CSF!["IVV-CSF-AIA"]!;
  // Independently turn CTL keys back into source notation rather than using
  // the production normalizer to derive expected membership.
  for (const [family, controls] of Object.entries(document.CTL!)) {
    for (const [id, ctl] of Object.entries(controls)) {
      const [prefix, number, enhancement] = id.split("-");
      const sourceId = `${prefix}-${number}${enhancement ? ` (${enhancement})` : ""}`;
      for (const cls of classes) {
        expect(ctl.varies_by_class[cls].force, `${id}.${cls}`).toBe(
          baseline.varies_by_class![cls]!.rev5_controls_list![family]?.includes(
            sourceId,
          )
            ? "MUST"
            : "MAY",
        );
        expect(ctl.assess_yearly_by_class[cls], `${id}.${cls}`).toBe(
          annual.varies_by_class![cls]!.rev5_controls_list![family]?.includes(
            sourceId,
          ) ?? false,
        );
      }
    }
  }
  expect(collectControlMetadataIssues(document)).toEqual([]);
});

test("control ID normalization distinguishes base controls and enhancements", () => {
  expect(normalizeRev5ControlId("AC-02")).toBe("AC-02");
  expect(normalizeRev5ControlId("AC-02 (01)")).toBe("AC-02-01");
  for (const id of ["AC-2", "AC-02-01", "AC-02 (1)", "AC-02 trailing"])
    expect(normalizeRev5ControlId(id)).toBeNull();
});

for (const cls of classes) {
  test(`Class ${cls}: force and annual mismatches fail in both directions`, () => {
    const document = loadRulesDocument();
    const control = document.CTL!.AC!["AC-02"]!;
    control.varies_by_class[cls].force = "MAY";
    control.assess_yearly_by_class[cls] = false;
    // A synthetic unlisted control must be MAY and false for every class.
    document.CTL!.AC!["AC-99"] = {
      varies_by_class: {
        b: { force: "MAY" },
        c: { force: "MAY" },
        d: { force: "MAY" },
      },
      assess_yearly_by_class: { b: false, c: false, d: false },
    };
    document.CTL!.AC!["AC-99"]!.varies_by_class[cls].force = "MUST";
    document.CTL!.AC!["AC-99"]!.assess_yearly_by_class[cls] = true;
    const issues = collectControlMetadataIssues(document);
    expect(issues.map((i) => i.location).sort()).toEqual(
      [
        `CTL.AC.AC-02.varies_by_class.${cls}.force`,
        `CTL.AC.AC-02.assess_yearly_by_class.${cls}`,
        `CTL.AC.AC-99.varies_by_class.${cls}.force`,
        `CTL.AC.AC-99.assess_yearly_by_class.${cls}`,
      ].sort(),
    );
    expect(
      formatConsistencyReport(collectConsistencyChecks(document)),
    ).toContain("Rev5 control metadata failed with 4 issues");
  });
}

test("deleted controls, missing source lists, and changed source membership fail", () => {
  const document = loadRulesDocument();
  delete document.CTL!.AC!["AC-02-01"];
  expect(
    collectControlMetadataIssues(document).some(
      (i) =>
        i.location === "CTL.AC.AC-02-01" &&
        i.message.includes("Missing control"),
    ),
  ).toBe(true);
  const baseline = document.FRR.FRC!.data.rev5!.CSF!["FRC-CSF-BSL"]!;
  baseline.varies_by_class!.b!.rev5_controls_list!.AC!.push("AC-02 (01)");
  expect(
    collectControlMetadataIssues(document).some((i) =>
      i.message.includes("FRC-CSF-BSL.varies_by_class.b"),
    ),
  ).toBe(true);
  delete baseline.varies_by_class!.b!.rev5_controls_list;
  expect(
    collectControlMetadataIssues(document).some((i) =>
      i.message.includes("Missing source control list"),
    ),
  ).toBe(true);
  delete document.FRR.IVV!.data.rev5!.CSF!["IVV-CSF-AIA"];
  expect(
    collectControlMetadataIssues(document).filter((i) =>
      i.message.includes("Missing source control list"),
    ),
  ).toHaveLength(4);
});

test("source edits invalidate metadata without relying on frozen fixture counts", () => {
  const document = loadRulesDocument();
  const baseline = document.FRR.FRC!.data.rev5!.CSF!["FRC-CSF-BSL"]!;
  const annual = document.FRR.IVV!.data.rev5!.CSF!["IVV-CSF-AIA"]!;
  baseline.varies_by_class!.b!.rev5_controls_list!.AC =
    baseline.varies_by_class!.b!.rev5_controls_list!.AC!.filter(
      (id) => id !== "AC-02",
    );
  annual.varies_by_class!.b!.rev5_controls_list!.AC =
    annual.varies_by_class!.b!.rev5_controls_list!.AC!.filter(
      (id) => id !== "AC-02",
    );
  expect(
    collectControlMetadataIssues(document)
      .map((i) => i.location)
      .sort(),
  ).toEqual([
    "CTL.AC.AC-02.assess_yearly_by_class.b",
    "CTL.AC.AC-02.varies_by_class.b.force",
  ]);
});

test("CTL schema requires all three forces and annual booleans while retaining guidance", () => {
  const document = loadRulesDocument();
  const control = document.CTL!.AC!["AC-02"]!;
  control.guidance = ["Common guidance"];
  control.varies_by_class.b.guidance = ["Class B guidance"];
  expect(validateSchema(document).valid).toBe(true);
  for (const cls of classes) {
    const candidate = structuredClone(document);
    Reflect.deleteProperty(candidate.CTL!.AC!["AC-02"]!.varies_by_class, cls);
    expect(validateSchema(candidate).valid).toBe(false);
    const missingForce = structuredClone(document);
    Reflect.deleteProperty(
      missingForce.CTL!.AC!["AC-02"]!.varies_by_class[cls],
      "force",
    );
    expect(validateSchema(missingForce).valid).toBe(false);
    expect(
      collectControlMetadataIssues(missingForce).some(
        (i) => i.location === `CTL.AC.AC-02.varies_by_class.${cls}.force`,
      ),
    ).toBe(true);
    const yearly = structuredClone(document);
    Reflect.deleteProperty(
      yearly.CTL!.AC!["AC-02"]!.assess_yearly_by_class,
      cls,
    );
    expect(validateSchema(yearly).valid).toBe(false);
  }
  for (const force of ["SHOULD", "", null]) {
    Object.assign(control.varies_by_class.b, { force });
    expect(validateSchema(document).valid).toBe(false);
  }
  control.varies_by_class.b.force = "MUST";
  Object.assign(control.assess_yearly_by_class, { b: "true" });
  expect(validateSchema(document).valid).toBe(false);
});

test("final control summary reports class totals and mismatch counts", () => {
  const document = loadRulesDocument();
  const issues = collectControlMetadataIssues(document);
  const summary = formatControlMetadataSummary(document, issues);
  const count = Object.values(document.CTL!).reduce(
    (n, controls) => n + Object.keys(controls).length,
    0,
  );
  expect(summary).toContain(`${count} controls checked; 0 issues.`);
  for (const cls of classes)
    expect(summary).toContain(`Class ${cls.toUpperCase()}:`);
  document.CTL!.AC!["AC-02"]!.varies_by_class.b.force = "MAY";
  expect(
    formatControlMetadataSummary(
      document,
      collectControlMetadataIssues(document),
    ),
  ).toContain("1 issues.");
});
