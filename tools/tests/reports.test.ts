import { expect, test } from "bun:test";
import { loadRulesDocument, loadSchemaDocument } from "../src/rules";
import { runReport } from "../src/reports";
import { collectOverall } from "../src/reports/overall";
import {
  collectProfile,
  renderProfile,
  summarizeProfile,
} from "../src/reports/profile";
import type {
  FrrSubsetDefinition,
  Requirement,
  RulesDocument,
} from "../src/types";

function subset(
  types: FrrSubsetDefinition["applicability"]["types"] = ["20x"],
  classes: FrrSubsetDefinition["applicability"]["classes"] = ["A"],
): FrrSubsetDefinition {
  return {
    name: "Subset",
    description: "Fixture",
    applicability: {
      types,
      classes,
      paths: ["Program"],
      affects: ["Providers"],
    },
  };
}
function rule(overrides: Partial<Requirement> = {}): Requirement {
  return {
    name: "Fixture rule",
    statement: "Parties MAY act but MUST record it if they do.",
    force: "MAY",
    affects: ["Providers"],
    updated: [],
    ...overrides,
  } as Requirement;
}
function fixture(): RulesDocument {
  const document = loadRulesDocument();
  const info = structuredClone(document.FRR.AFC!.info);
  delete info["20x"];
  delete info.rev5;
  info.subsets = { CSO: subset() };
  document.FRR = {
    AFC: { info, data: { all: { CSO: { "AFC-CSO-ONE": rule() } } } },
  };
  document.KSI = {};
  delete document.CTL;
  return document;
}

test("profile combines shared and matching buckets, without crossing framework boundaries", () => {
  const d = fixture();
  const section = d.FRR.AFC!;
  section.info["20x"] = { subsets: { CSX: subset() } };
  section.info.rev5 = { subsets: { CSF: subset(["Rev5"]) } };
  section.data["20x"] = { CSX: { "AFC-CSX-TWO": rule() } };
  section.data.rev5 = {
    CSF: {
      "AFC-CSF-THR": rule({ applicability: { add: { types: ["20x"] } } }),
    },
  };
  expect(collectProfile(d, "20x", "A").map((r) => r.id)).toEqual([
    "AFC-CSO-ONE",
    "AFC-CSX-TWO",
  ]);
  expect(collectProfile(d, "Rev5", "A").map((r) => r.id)).toEqual([
    "AFC-CSF-THR",
  ]);
});

test("additional applicability extends dimensions; omitted dimensions remain inherited", () => {
  const d = fixture();
  const r = d.FRR.AFC!.data.all!.CSO!["AFC-CSO-ONE"]!;
  (r.applicability ??= {}).add = { types: ["Rev5"], classes: ["C"] };
  expect(collectProfile(d, "Rev5", "C")).toHaveLength(1);
  expect(collectProfile(d, "20x", "A")).toHaveLength(1);
  (r.applicability ??= {}).add = { classes: ["C"] };
  expect(collectProfile(d, "Rev5", "C")).toHaveLength(0);
  expect(collectProfile(d, "20x", "C")).toHaveLength(1);
  d.FRR.AFC!.info.subsets!.CSO = subset([], []);
  expect(collectProfile(d, "20x", "C")).toHaveLength(0);
  (r.applicability ??= {}).add = { types: ["20x"], classes: ["C"] };
  expect(collectProfile(d, "20x", "C")).toHaveLength(1);
});

test("profile exclusions remove types and classes after additions", () => {
  const d = fixture();
  const r = d.FRR.AFC!.data.all!.CSO!["AFC-CSO-ONE"]!;
  (r.applicability ??= {}).add = { types: ["Rev5"], classes: ["C"] };
  (r.applicability ??= {}).exclude = { classes: ["A"] };
  expect(collectProfile(d, "20x", "A")).toEqual([]);
  expect(collectProfile(d, "20x", "C")).toHaveLength(1);
  (r.applicability ??= {}).exclude = { types: ["20x"] };
  expect(collectProfile(d, "20x", "C")).toEqual([]);
  expect(collectProfile(d, "Rev5", "C")).toHaveLength(1);
  (r.applicability ??= {}).exclude = { types: ["Rev5"], classes: ["C"] };
  expect(collectProfile(d, "Rev5", "A")).toEqual([]);
  expect(collectProfile(d, "20x", "C")).toEqual([]);
  expect(collectProfile(d, "20x", "A")).toHaveLength(1);
});

test("common and framework subset declarations combine for framework rules", () => {
  const d = fixture();
  d.FRR.AFC!.data = { "20x": { CSO: { "AFC-CSO-ONE": rule() } } };
  d.FRR.AFC!.info["20x"] = { subsets: { CSO: subset(["Rev5"], ["C"]) } };
  expect(collectProfile(d, "20x", "C")).toHaveLength(1);
});

test("class force is selected and missing variants remain counted as unspecified", () => {
  const d = fixture();
  d.FRR.AFC!.info.subsets!.CSO = subset(["20x"], ["A", "B", "C"]);
  d.FRR.AFC!.data.all!.CSO!["AFC-CSO-ONE"] = {
    name: "Variant rule",
    affects: ["Providers", "Agencies"],
    updated: [],
    varies_by_class: {
      b: { statement: "B", force: "MUST" },
      c: { statement: "C", force: "SHOULD" },
    },
  };
  expect(collectProfile(d, "20x", "B")[0]!.force).toBe("MUST");
  expect(collectProfile(d, "20x", "C")[0]!.force).toBe("SHOULD");
  const results = collectProfile(d, "20x", "A");
  expect(results[0]!.force).toBe("unspecified");
  const text = renderProfile(results, "A");
  expect(text).toContain("missing Class A statement variant");
  expect(text).toContain("Agencies: 1 rule (1 unspecified)");
  expect(text).toContain("Providers: 1 rule (1 unspecified)");
  expect(text).toContain("Party totals overlap");
  expect(text.endsWith("1 rule (1 unspecified)")).toBe(true);
  expect(text.match(/AFC-CSO-ONE/g)).toHaveLength(1);
});

test("primary force only; Everyone remains separate; empty output is explicit", () => {
  const d = fixture();
  d.FRR.AFC!.data.all!.CSO!["AFC-CSO-ONE"]!.affects = ["Everyone"];
  const results = collectProfile(d, "20x", "A");
  expect(summarizeProfile(results)).toBe("1 rule (1 MAY)");
  expect(renderProfile(results, "A")).toContain("Everyone: 1 rule (1 MAY)");
  expect(renderProfile([], "A")).toBe("0 rules");
});

test("force summary includes each distinct force in the specified order", () => {
  const forces = [
    "MAY",
    "unspecified",
    "SHOULD NOT",
    "MUST",
    "SHOULD",
    "MUST NOT",
  ] as const;
  expect(
    summarizeProfile(
      forces.map((force) => ({ id: force, name: force, force, affects: [] })),
    ),
  ).toBe(
    "6 rules (1 MUST, 1 MUST NOT, 1 SHOULD, 1 SHOULD NOT, 1 MAY, 1 unspecified)",
  );
});

test("unresolved subsets and duplicate IDs produce diagnostic errors", () => {
  const d = fixture();
  d.FRR.AFC!.info.subsets = {};
  expect(() => collectProfile(d, "20x", "A")).toThrow(
    "Unresolved subset declaration",
  );
  d.FRR.AFC!.info.subsets = { CSO: subset() };
  d.FRR.AFC!.data["20x"] = structuredClone(d.FRR.AFC!.data.all!);
  expect(() => collectProfile(d, "20x", "A")).toThrow(
    "Duplicate rule ID AFC-CSO-ONE",
  );
});

test("overall counts populated buckets and entries, including empty rulesets", () => {
  const d = fixture();
  d.FRR.EMPTY = { info: structuredClone(d.FRR.AFC!.info), data: {} };
  d.FRR.AFC!.data.all!.EMPTY = {};
  d.FRR.AFC!.data["20x"] = {
    CSO: {
      "AFC-CSO-TWO": {
        name: "Variants",
        affects: [],
        updated: [],
        varies_by_class: {
          b: { statement: "B", force: "MUST" },
          c: { statement: "C", force: "MUST" },
        },
      },
    },
  };
  d.KSI = {
    IAM: {
      id: "IAM",
      name: "IAM",
      web_name: "IAM",
      short_name: "IAM",
      status: "stable",
      indicators: {
        "KSI-IAM-ONE": {
          name: "Indicator",
          statement: "Statement",
          controls: [],
          updated: [],
        },
      },
    },
  };
  expect(collectOverall(d)).toEqual({
    rulesets: 2,
    subsets: 2,
    rules: 2,
    ksis: 1,
    controls: 0,
  });
  d.CTL = {
    AC: { "AC-1": {}, "AC-2": { varies_by_class: { b: {}, c: {} } } },
    AU: {},
  };
  expect(collectOverall(d).controls).toBe(2);
});

test("help and argument arity errors do not load documents", () => {
  const failLoad = (): never => {
    throw new Error("Unexpected load");
  };
  for (const args of [
    [],
    ["--help"],
    ["profile", "--help"],
    ["overall", "--help"],
  ]) {
    expect(runReport(args, failLoad)).toContain("bun report");
  }
  for (const args of [
    ["unknown"],
    ["profile"],
    ["profile", "20x"],
    ["profile", "20x", "a", "extra"],
    ["overall", "extra"],
  ]) {
    expect(() => runReport(args, failLoad)).toThrow(/Unknown report|Usage:/);
  }
});

test("report runner rejects invalid schema data before rendering", () => {
  const d = loadRulesDocument();
  delete (d as Partial<RulesDocument>).FRR;
  expect(() =>
    runReport(["overall"], () => ({
      document: d,
      schema: loadSchemaDocument(),
    })),
  ).toThrow("Schema validation failed");
});

test("CLI runs requested commands and accepts case-insensitive profile values", () => {
  for (const args of [
    ["profile", "20x", "a"],
    ["profile", "rev5", "c"],
    ["profile", "REV5", "C"],
    ["overall"],
  ]) {
    const result = Bun.spawnSync([process.execPath, "report", ...args], {
      cwd: new URL("..", import.meta.url).pathname,
    });
    expect(result.exitCode).toBe(0);
    const text = result.stdout.toString();
    expect(text).toContain("Dataset:");
    expect(text).toContain(
      args[0] === "overall" ? "Controls:" : "By affected party:",
    );
  }
  for (const args of [
    ["profile", "bad", "a"],
    ["profile", "20x", "z"],
    ["unknown"],
  ]) {
    const result = Bun.spawnSync([process.execPath, "report", ...args], {
      cwd: new URL("..", import.meta.url).pathname,
    });
    expect(result.exitCode).toBe(1);
    expect(result.stdout.toString()).toBe("");
    expect(result.stderr.toString()).toContain("Unknown");
  }
});
