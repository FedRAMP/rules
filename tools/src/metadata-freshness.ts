import { rulesVersionPattern } from "./version";
import { relative } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { getRepoRoot, getResolvedPaths } from "./config";
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

export function collectMetadataFreshnessWarnings(
  document: RulesDocument,
  commit: LatestCommitMetadata,
): MetadataFreshnessWarning[] {
  if ("warning" in commit) {
    return [{ field: "git", message: commit.warning }];
  }

  const warnings: MetadataFreshnessWarning[] = [];

  if (document.info.last_updated !== commit.date) {
    warnings.push({
      field: "info.last_updated",
      message: `info.last_updated is ${JSON.stringify(
        document.info.last_updated,
      )}; expected ${JSON.stringify(commit.date)} from commit ${commit.shortHash}.`,
    });
  }

  if (!rulesVersionPattern.test(document.info.version)) {
    warnings.push({
      field: "info.version",
      message: `info.version is ${JSON.stringify(
        document.info.version,
      )}; expected a version such as CR26.v33.`,
    });
  }

  return warnings;
}

function contentForVersionCheck(document: RulesDocument) {
  const { version, last_updated, ...info } = document.info;
  return { ...document, info };
}

export function collectVersionIncrementWarnings(
  document: RulesDocument,
  { repoRoot, rulesPath }: { repoRoot: string; rulesPath: string } = getResolvedPaths(),
): MetadataFreshnessWarning[] {
  const current = rulesVersionPattern.exec(document.info.version);
  if (!current) return []; // The format check reports this separately.

  const path = relative(repoRoot, rulesPath);
  const git = (...args: string[]) =>
    Bun.spawnSync(["git", ...args], { cwd: repoRoot, maxBuffer: 32 * 1024 * 1024 });
  const historyWarning: MetadataFreshnessWarning = {
    field: "git",
    message: "Could not compare rules versions against repository history.",
  };
  const history = git("log", "-2", "--format=%H", "--", path);
  if (history.exitCode !== 0) return [historyWarning];

  const content = contentForVersionCheck(document);
  for (const hash of history.stdout.toString().trim().split("\n").filter(Boolean)) {
    const snapshot = git("show", `${hash}:${path}`);
    if (snapshot.exitCode !== 0) return [historyWarning];
    let previous: RulesDocument;
    try {
      previous = JSON.parse(snapshot.stdout.toString());
      if (!previous?.info || typeof previous.info.version !== "string") return [historyWarning];
    } catch {
      return [historyWarning];
    }
    const prior = rulesVersionPattern.exec(previous.info.version);
    if (!prior || BigInt(current[1]!) > BigInt(prior[1]!)) return [];
    if (previous.info.version !== document.info.version ||
        !isDeepStrictEqual(content, contentForVersionCheck(previous))) {
      return [{
        field: "info.version",
        message: `The rules at ${hash.slice(0, 7)} already use ${previous.info.version}. Manually increment info.version for this update.`,
      }];
    }
  }
  return [];
}
