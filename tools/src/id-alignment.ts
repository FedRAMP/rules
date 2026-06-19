import { loadSchemaDocument } from "./rules";
import { getSchemaPattern } from "./schema-metadata";
import type { IdAlignmentIssue, RulesDocument, UpdatedEntry } from "./types";

const REQUIREMENT_ID_PATTERN = getSchemaPattern(
  loadSchemaDocument(),
  "#/$defs/frr_requirement_id",
);
const REQUIREMENT_ID_REGEX = REQUIREMENT_ID_PATTERN
  ? new RegExp(REQUIREMENT_ID_PATTERN)
  : null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function ensureUpdatedEntry(
  target: Record<string, unknown>,
  comment: string,
  entryDate: string,
): void {
  const entry: UpdatedEntry = { date: entryDate, comment };
  const updated = target.updated;

  if (updated === undefined) {
    target.updated = [entry];
    return;
  }

  if (Array.isArray(updated)) {
    updated.push(entry);
    return;
  }

  target.updated = [updated, entry];
}

export function incrementVersion(version: string): string {
  const [mainVersion, suffix] = version.split("-", 2);
  const parts = (mainVersion ?? "").split(".");

  if (parts.length < 3) {
    return version;
  }

  const patch = Number(parts[2]);
  if (Number.isNaN(patch)) {
    return version;
  }

  parts[2] = String(patch + 1);
  return suffix ? `${parts.join(".")}-${suffix}` : parts.join(".");
}

function processDataBlock(
  dataBlock: Record<string, unknown>,
  entryDate: string,
  issues: IdAlignmentIssue[],
  shouldFix: boolean,
  basePath: string,
): void {
  const walk = (node: unknown, parentKey: string | null, nodePath: string) => {
    if (isRecord(node)) {
      if (parentKey !== null) {
        const renamePlan: Array<{ oldKey: string; newKey: string }> = [];

        for (const key of Object.keys(node)) {
          if (!REQUIREMENT_ID_REGEX?.test(key)) {
            continue;
          }

          const [left, middle, right] = key.split("-");
          if (!left || !middle || !right) {
            continue;
          }
          if (middle === parentKey) {
            continue;
          }

          const newKey = `${left}-${parentKey}-${right}`;
          if (newKey in node && newKey !== key) {
            issues.push({
              path: nodePath,
              parent: parentKey,
              oldKey: key,
              newKey,
              status: "skipped_collision",
            });
            continue;
          }

          issues.push({
            path: nodePath,
            parent: parentKey,
            oldKey: key,
            newKey,
            status: shouldFix ? "fixed" : "skipped_collision",
          });

          if (shouldFix) {
            renamePlan.push({ oldKey: key, newKey });
          }
        }

        for (const { oldKey, newKey } of renamePlan) {
          const item = node[oldKey];
          delete node[oldKey];

          if (isRecord(item)) {
            ensureUpdatedEntry(
              item,
              `Auto-fix: key "${oldKey}" middle segment did not match parent "${parentKey}". Renamed to "${newKey}".`,
              entryDate,
            );
            node[newKey] = item;
          } else {
            node[newKey] = item;
          }
        }
      }

      for (const [key, value] of Object.entries(node)) {
        walk(value, key, nodePath ? `${nodePath}.${key}` : key);
      }
    } else if (Array.isArray(node)) {
      node.forEach((value, index) => {
        walk(value, parentKey, `${nodePath}[${index}]`);
      });
    }
  };

  walk(dataBlock, null, basePath);
}

export function collectIdAlignmentIssues(
  document: RulesDocument,
): IdAlignmentIssue[] {
  const cloned = structuredClone(document);
  return fixIdAlignment(cloned, {
    entryDate: cloned.info.last_updated,
    updateDocument: false,
  }).issues;
}

export function fixIdAlignment(
  document: RulesDocument,
  options: { entryDate: string; updateDocument: boolean },
): { issues: IdAlignmentIssue[]; fixedCount: number; skippedCount: number } {
  const issues: IdAlignmentIssue[] = [];

  const walk = (node: unknown, nodePath: string) => {
    if (!isRecord(node)) {
      if (Array.isArray(node)) {
        node.forEach((value, index) => walk(value, `${nodePath}[${index}]`));
      }
      return;
    }

    if (isRecord(node.data)) {
      processDataBlock(
        node.data,
        options.entryDate,
        issues,
        options.updateDocument,
        nodePath ? `${nodePath}.data` : "data",
      );
    }

    for (const [key, value] of Object.entries(node)) {
      walk(value, nodePath ? `${nodePath}.${key}` : key);
    }
  };

  walk(document, "");

  const fixedCount = issues.filter((issue) => issue.status === "fixed").length;
  const skippedCount = issues.filter(
    (issue) => issue.status === "skipped_collision",
  ).length;

  if (options.updateDocument && fixedCount > 0) {
    document.info.version = incrementVersion(document.info.version);
    document.info.last_updated = options.entryDate;
  }

  return {
    issues,
    fixedCount,
    skippedCount,
  };
}
