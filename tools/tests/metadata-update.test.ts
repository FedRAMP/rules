import { expect, test } from "bun:test";

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { collectMetadataFreshnessWarnings, collectVersionIncrementWarnings } from "../src/metadata-freshness";
import type { RulesDocument } from "../src/types";

function testDocument(version: string, lastUpdated: string): RulesDocument {
  return {
    info: {
      title: "Test",
      description: "Test",
      version,
      last_updated: lastUpdated,
    },
    FRD: { info: {}, data: { all: {} } },
    FRR: {},
    KSI: {},
  } as RulesDocument;
}

test("metadata freshness warnings detect a stale info.last_updated with a valid version", () => {
  const warnings = collectMetadataFreshnessWarnings(
    testDocument("CR26.v33", "2026-05-28"),
    { date: "2026-05-29", shortHash: "abc1234" },
  );

  expect(warnings).toEqual([
    {
      field: "info.last_updated",
      message:
        'info.last_updated is "2026-05-28"; expected "2026-05-29" from commit abc1234.',
    },
  ]);
});

test("metadata freshness warnings accept matching date metadata", () => {
  expect(
    collectMetadataFreshnessWarnings(
      testDocument("CR26.v33", "2026-05-29"),
      { date: "2026-05-29", shortHash: "abc1234" },
    ),
  ).toEqual([]);
});

test("a dated version warns even when its prefix matches the commit date", () => {
  const warnings = collectMetadataFreshnessWarnings(
    testDocument("2026.05.29.01", "2026-05-29"),
    { date: "2026-05-29", shortHash: "abc1234" },
  );
  expect(warnings.map(({ field }) => field)).toEqual(["info.version"]);
});

test("rules updates warn until a maintainer increments the version", () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "rules-version-"));
  const rulesPath = join(repoRoot, "rules.json");
  const git = (...args: string[]) => execFileSync("git", args, { cwd: repoRoot });
  const doc = testDocument("CR26.v99", "2026-05-29");
  const warnings = () => collectVersionIncrementWarnings(doc, { repoRoot, rulesPath });
  const commit = () => {
    writeFileSync(rulesPath, JSON.stringify(doc));
    git("add", "rules.json");
    git("-c", "user.name=Test", "-c", "user.email=test@example.org",
        "-c", "commit.gpgSign=false", "-c", "core.hooksPath=/dev/null", "commit", "-qm", "rules");
  };

  try {
    git("init", "-q");
    commit();
    doc.info.last_updated = "2026-05-30";
    expect(warnings()).toEqual([]);
    doc.info.description = "Updated rules description";
    expect(warnings().map(w => w.field)).toEqual(["info.version"]);
    commit();
    expect(warnings().map(w => w.field)).toEqual(["info.version"]);
    doc.info.version = "CR26.v100";
    expect(warnings()).toEqual([]);
    commit();
    expect(warnings()).toEqual([]);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});
