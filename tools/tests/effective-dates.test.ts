import { expect, test } from "bun:test";

import { loadRulesDocument } from "../src/rules";
import type { RulesDocument } from "../src/types";

const MAX_OBTAIN_DATE = "2027-01-01";

type CertificationKey = "20x" | "rev5";

interface EffectiveDates {
  obtain: string;
  maintain: string;
  grace: {
    default: string;
  };
}

interface EffectiveEntry {
  date?: EffectiveDates;
}

interface EffectiveDateLocation {
  path: string;
  effective: EffectiveEntry;
}

interface EffectiveDateIssue {
  path: string;
  message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function frameworkEffectiveEntry(
  info: Record<string, unknown>,
  certification: CertificationKey,
): EffectiveEntry | undefined {
  const frameworkInfo = info[certification];
  if (!isRecord(frameworkInfo)) {
    return undefined;
  }

  const effective = frameworkInfo.effective;
  if (!isRecord(effective)) {
    return undefined;
  }

  return effective as unknown as EffectiveEntry;
}

function collectCertificationEffectiveEntries(
  document: RulesDocument,
): EffectiveDateLocation[] {
  const locations: EffectiveDateLocation[] = [];

  function addInfoEntries(path: string, info: Record<string, unknown>): void {
    for (const certification of ["20x", "rev5"] as const) {
      const effective = frameworkEffectiveEntry(info, certification);
      if (effective) {
        locations.push({
          path: `${path}.${certification}.effective`,
          effective,
        });
      }
    }
  }

  addInfoEntries("FRD.info", document.FRD.info);

  for (const [processName, processDocument] of Object.entries(document.FRR)) {
    addInfoEntries(`FRR.${processName}.info`, processDocument.info);
  }

  return locations;
}

function collectEffectiveDateIssues(
  document: RulesDocument,
): EffectiveDateIssue[] {
  const issues: EffectiveDateIssue[] = [];

  for (const { path, effective } of collectCertificationEffectiveEntries(
    document,
  )) {
    const dates = effective.date;
    if (!dates) {
      continue;
    }

    const obtainPath = `${path}.date.obtain`;
    const maintainPath = `${path}.date.maintain`;
    const gracePath = `${path}.date.grace.default`;
    const graceDefault = dates.grace.default;

    if (dates.maintain < dates.obtain) {
      issues.push({
        path: maintainPath,
        message: `maintain date ${dates.maintain} is before obtain date ${dates.obtain}.`,
      });
    }

    if (graceDefault < dates.obtain) {
      issues.push({
        path: gracePath,
        message: `grace.default date ${graceDefault} is before obtain date ${dates.obtain}.`,
      });
    }

    if (dates.obtain > MAX_OBTAIN_DATE) {
      issues.push({
        path: obtainPath,
        message: `obtain date ${dates.obtain} is after ${MAX_OBTAIN_DATE}.`,
      });
    }
  }

  return issues;
}

test("certification-specific effective dates follow the timing rules", () => {
  const issues = collectEffectiveDateIssues(loadRulesDocument());

  if (issues.length > 0) {
    throw new Error(
      [
        "Certification-specific effective dates failed validation:",
        ...issues.map((issue) => `- ${issue.path}: ${issue.message}`),
      ].join("\n"),
    );
  }

  expect(issues).toEqual([]);
});
