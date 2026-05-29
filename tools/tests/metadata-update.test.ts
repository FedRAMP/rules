import { expect, test } from "bun:test";

import {
  collectMetadataFreshnessWarnings,
  versionDatePrefix,
} from "../src/metadata-freshness";
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

test("metadata freshness warnings detect stale info.last_updated and info.version dates", () => {
  const warnings = collectMetadataFreshnessWarnings(
    testDocument("2026.05.28.01-preview", "2026-05-28"),
    { date: "2026-05-29", shortHash: "abc1234" },
  );

  expect(warnings).toEqual([
    {
      field: "info.last_updated",
      message:
        'info.last_updated is "2026-05-28"; expected "2026-05-29" from commit abc1234.',
    },
    {
      field: "info.version",
      message:
        'info.version is "2026.05.28.01-preview"; expected a "2026.05.29" date prefix from commit abc1234.',
    },
  ]);
});

test("metadata freshness warnings accept matching date metadata", () => {
  expect(
    collectMetadataFreshnessWarnings(
      testDocument("2026.05.29.01-preview", "2026-05-29"),
      { date: "2026-05-29", shortHash: "abc1234" },
    ),
  ).toEqual([]);
});

test("versionDatePrefix reads the leading date from preview versions", () => {
  expect(versionDatePrefix("2026.05.29.01-preview")).toBe("2026.05.29");
});
