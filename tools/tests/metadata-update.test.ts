import { test } from "bun:test";

import { getRepoRoot } from "../src/config";
import { loadRulesDocument } from "../src/rules";

function latestCommitMetadata():
  | { date: string; shortHash: string }
  | { warning: string } {
  const result = Bun.spawnSync({
    cmd: ["git", "log", "-1", "--format=%cs%n%h"],
    cwd: getRepoRoot(),
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

function versionDatePrefix(version: string): string | undefined {
  return version.match(/^\d{4}\.\d{2}\.\d{2}/)?.[0];
}

test("info.last_updated and info.version reflect the most recent git commit date", () => {
  const document = loadRulesDocument();

  const commit = latestCommitMetadata();
  if ("warning" in commit) {
    console.warn(`Metadata freshness warning: ${commit.warning}`);
    return;
  }

  const commitVersionDate = commit.date.replaceAll("-", ".");
  const lastUpdated = document.info.last_updated;
  const version = document.info.version;
  const versionDate = versionDatePrefix(version);
  const warnings: string[] = [];

  if (lastUpdated !== commit.date) {
    warnings.push(
      `info.last_updated is ${JSON.stringify(
        lastUpdated,
      )}; expected ${JSON.stringify(commit.date)} from commit ${commit.shortHash}.`,
    );
  }

  if (versionDate !== commitVersionDate) {
    warnings.push(
      `info.version is ${JSON.stringify(
        version,
      )}; expected a ${JSON.stringify(commitVersionDate)} date prefix from commit ${commit.shortHash}.`,
    );
  }

  if (warnings.length > 0) {
    console.warn(
      [
        "Metadata freshness warning:",
        ...warnings.map((warning) => `- ${warning}`),
        "Update fedramp-consolidated-rules.json metadata before publishing this branch.",
      ].join("\n"),
    );
  }
});
