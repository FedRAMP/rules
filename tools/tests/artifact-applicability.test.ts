import { expect, test } from "bun:test";

import {
  collectArtifactApplicabilityIssues,
  type ConsistencyIssue,
} from "../src/consistency";
import {
  cloneDocument,
  loadRulesDocument,
  loadSchemaDocument,
} from "../src/rules";
import { getStringEnum } from "../src/schema-metadata";
import type { RulesDocument } from "../src/types";

type ApplicabilityKey = "all" | "20x" | "rev5";
const APPLICABILITY_KEYS = getStringEnum(
  loadSchemaDocument(),
  "#/$defs/applicability_key",
) as ApplicabilityKey[];

function allowedArtifactKeys(
  parentApplicability: ApplicabilityKey,
): ApplicabilityKey[] {
  return parentApplicability === "all"
    ? APPLICABILITY_KEYS
    : [parentApplicability];
}

type ArtifactHolder = Record<string, unknown> & {
  artifacts?: Record<string, string[]>;
  varies_by_class?: Record<string, unknown>;
};

interface ArtifactHolderTarget {
  location: string;
  parentApplicability: ApplicabilityKey;
  holder: ArtifactHolder;
}

function isApplicabilityKey(value: string): value is ApplicabilityKey {
  return (APPLICABILITY_KEYS as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function collectArtifactHolderTargets(
  document: RulesDocument,
): ArtifactHolderTarget[] {
  const targets: ArtifactHolderTarget[] = [];

  for (const [sectionKey, section] of Object.entries(document.FRR ?? {})) {
    for (const [scopeKey, scope] of Object.entries(section.data ?? {})) {
      if (!isApplicabilityKey(scopeKey)) {
        continue;
      }

      for (const [subsetKey, requirements] of Object.entries(scope ?? {})) {
        for (const [id, requirement] of Object.entries(requirements ?? {})) {
          const requirementHolder = requirement as unknown as ArtifactHolder;
          const requirementLocation = `FRR.${sectionKey}.data.${scopeKey}.${subsetKey}.${id}`;

          targets.push({
            location: requirementLocation,
            parentApplicability: scopeKey,
            holder: requirementHolder,
          });

          if (!isRecord(requirementHolder.varies_by_class)) {
            continue;
          }

          for (const [classKey, classEntry] of Object.entries(
            requirementHolder.varies_by_class,
          )) {
            if (!isRecord(classEntry)) {
              continue;
            }

            targets.push({
              location: `${requirementLocation}.varies_by_class.${classKey}`,
              parentApplicability: scopeKey,
              holder: classEntry as ArtifactHolder,
            });
          }
        }
      }
    }
  }

  return targets;
}

function artifactListFor(key: string): string[] {
  return [`${key} evidence.`];
}

function setArtifacts(
  target: ArtifactHolderTarget,
  keys: readonly ApplicabilityKey[],
): void {
  target.holder.artifacts = Object.fromEntries(
    keys.map((key) => [key, artifactListFor(key)]),
  );
}

function expectedIssueForTarget(
  target: ArtifactHolderTarget,
): ConsistencyIssue | null {
  if (!isRecord(target.holder.artifacts)) {
    return null;
  }

  const allowedKeys = allowedArtifactKeys(target.parentApplicability);
  const disallowedKeys = Object.keys(target.holder.artifacts).filter(
    (key) => !allowedKeys.includes(key as ApplicabilityKey),
  );

  if (disallowedKeys.length === 0) {
    return null;
  }

  return {
    location: `${target.location}.artifacts`,
    message:
      `artifacts is inside data.${target.parentApplicability}, ` +
      `so it may only use applicability keys: ${allowedKeys.join(", ")}. ` +
      `Found disallowed keys: ${disallowedKeys.join(", ")}.`,
  };
}

function collectExpectedArtifactApplicabilityIssues(
  document: RulesDocument,
): ConsistencyIssue[] {
  return collectArtifactHolderTargets(document).flatMap((target) => {
    const issue = expectedIssueForTarget(target);
    return issue ? [issue] : [];
  });
}

function sortIssues(issues: ConsistencyIssue[]): ConsistencyIssue[] {
  return [...issues].sort(
    (left, right) =>
      left.location.localeCompare(right.location) ||
      left.message.localeCompare(right.message),
  );
}

test("current artifact applicability keys match their containing data scope", () => {
  const document = loadRulesDocument();
  const issues = collectArtifactApplicabilityIssues(document);
  const expectedIssues = collectExpectedArtifactApplicabilityIssues(document);

  expect(sortIssues(issues)).toEqual(sortIssues(expectedIssues));
  expect(issues).toEqual([]);
});

test("artifact applicability permits keys based on every FRR data scope in the rules", () => {
  const document = cloneDocument(loadRulesDocument());
  const targets = collectArtifactHolderTargets(document);

  expect(targets.length).toBeGreaterThan(0);

  for (const target of targets) {
    setArtifacts(target, allowedArtifactKeys(target.parentApplicability));
  }

  const issues = collectArtifactApplicabilityIssues(document);

  expect(issues).toEqual([]);
});

test("artifact applicability reports mismatches based on every restricted FRR data scope", () => {
  const document = cloneDocument(loadRulesDocument());
  const restrictedTargets = collectArtifactHolderTargets(document).filter(
    (target) => target.parentApplicability !== "all",
  );

  expect(restrictedTargets.length).toBeGreaterThan(0);

  for (const target of restrictedTargets) {
    setArtifacts(target, APPLICABILITY_KEYS);
  }

  const issues = collectArtifactApplicabilityIssues(document);
  const expectedIssues = collectExpectedArtifactApplicabilityIssues(document);

  expect(issues.length).toBe(restrictedTargets.length);
  expect(sortIssues(issues)).toEqual(sortIssues(expectedIssues));
});
