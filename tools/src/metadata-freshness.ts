import { getRepoRoot } from "./config";
import type { RulesDocument } from "./types";

export type LatestCommitMetadata =
  | { date: string; shortHash: string }
  | { warning: string };

export interface MetadataFreshnessWarning {
  field: "info.last_updated" | "info.version" | "git";
  message: string;
}

export function latestCommitMetadata(
  cwd: string = getRepoRoot(),
): LatestCommitMetadata {
  const result = Bun.spawnSync({
    cmd: ["git", "log", "-1", "--format=%cs%n%h"],
    cwd,
  });

  if (result.exitCode !== 0) {
    return {
      warning:
        "Could not determine the most recent git commit date for metadata freshness.",
    };
  }

  const [date, shortHash] = result.stdout.toString().trim().split("\n");

  if (!date || !shortHash) {
    return {
      warning:
        "Could not parse the most recent git commit date for metadata freshness.",
    };
  }

  return { date, shortHash };
}

export function versionDatePrefix(version: string): string | undefined {
  return version.match(/^\d{4}\.\d{2}\.\d{2}/)?.[0];
}

export function collectMetadataFreshnessWarnings(
  document: RulesDocument,
  commit: LatestCommitMetadata,
): MetadataFreshnessWarning[] {
  if ("warning" in commit) {
    return [{ field: "git", message: commit.warning }];
  }

  const commitVersionDate = commit.date.replaceAll("-", ".");
  const warnings: MetadataFreshnessWarning[] = [];

  if (document.info.last_updated !== commit.date) {
    warnings.push({
      field: "info.last_updated",
      message: `info.last_updated is ${JSON.stringify(
        document.info.last_updated,
      )}; expected ${JSON.stringify(commit.date)} from commit ${commit.shortHash}.`,
    });
  }

  if (versionDatePrefix(document.info.version) !== commitVersionDate) {
    warnings.push({
      field: "info.version",
      message: `info.version is ${JSON.stringify(
        document.info.version,
      )}; expected a ${JSON.stringify(commitVersionDate)} date prefix from commit ${commit.shortHash}.`,
    });
  }

  return warnings;
}
