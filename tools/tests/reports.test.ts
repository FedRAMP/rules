import { expect, test } from "bun:test";
import { loadRulesDocument, loadSchemaDocument } from "../src/rules";
import { runReport } from "../src/reports";
import { collectOverall } from "../src/reports/overall";
import { collectProfile, renderProfile } from "../src/reports/profile";
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
      "AFC-CSF-THR": rule(),
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

test("class additions preserve inherited types and common force", () => {
  const d = fixture();
  const r = d.FRR.AFC!.data.all!.CSO!["AFC-CSO-ONE"]!;
  r.varies_by_class = { c: { applicable: true } };
  expect(collectProfile(d, "20x", "C")[0]!.force).toBe("MAY");
  expect(collectProfile(d, "20x", "A")).toHaveLength(1);
  expect(collectProfile(d, "Rev5", "C")).toHaveLength(0);
  d.FRR.AFC!.info.subsets!.CSO = subset([], []);
  expect(collectProfile(d, "20x", "C")).toHaveLength(0);
});

test("class exclusions remove only the selected class", () => {
  const d = fixture();
  const r = d.FRR.AFC!.data.all!.CSO!["AFC-CSO-ONE"]!;
  r.varies_by_class = {
    c: { applicable: true, force: "MUST" },
    a: { applicable: false },
  };
  expect(collectProfile(d, "20x", "A")).toEqual([]);
  expect(collectProfile(d, "20x", "C")[0]!.force).toBe("MUST");
  expect(collectProfile(d, "Rev5", "C")).toEqual([]);
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
  expect(text).toContain("missing effective Class A force");
  expect(text).toStartWith("Unspecified (1):\n\n");
  expect(text).not.toContain("By affected party:");
  expect(text.match(/AFC-CSO-ONE/g)).toHaveLength(1);
});

test("profiles require Providers in rule affects and count only primary force", () => {
  const d = fixture();
  const results = collectProfile(d, "20x", "A");
  expect(renderProfile(results, "A")).toBe(
    "MAY (1):\n\nAFC-CSO-ONE (Fixture rule)",
  );
  for (const affects of [["Everyone"], ["Agencies"], ["FedRAMP"]] as const) {
    d.FRR.AFC!.data.all!.CSO!["AFC-CSO-ONE"]!.affects = [...affects];
    expect(collectProfile(d, "20x", "A")).toEqual([]);
  }
  expect(renderProfile([], "A")).toBe("0 rules");
});

test("force headers include counts in the specified order", () => {
  const forces = [
    "MAY",
    "unspecified",
    "SHOULD NOT",
    "MUST",
    "SHOULD",
    "MUST NOT",
  ] as const;
  const text = renderProfile(
    forces.map((force) => ({ id: force, name: force, force, affects: [] })),
    "A",
  );
  expect(text.split("\n").filter((line) => line.endsWith(":"))).toEqual([
    "MUST (1):",
    "MUST NOT (1):",
    "SHOULD (1):",
    "SHOULD NOT (1):",
    "MAY (1):",
    "Unspecified (1):",
  ]);
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
          varies_by_class: {
            a: { force: "MAY" },
            b: { force: "MUST" },
            c: { force: "MUST" },
            d: { force: "MUST" },
          },
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
    AC: Object.fromEntries(
      ["AC-01", "AC-02"].map((id) => [
        id,
        {
          varies_by_class: {
            b: { force: "MUST" as const },
            c: { force: "MUST" as const },
            d: { force: "MUST" as const },
          },
          assess_yearly_by_class: { b: false, c: false, d: false },
        },
      ]),
    ),
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
    expect(text).toContain(args[0] === "overall" ? "Controls:" : "MUST (");
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
