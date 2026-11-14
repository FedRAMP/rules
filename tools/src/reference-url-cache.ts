import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ReferenceUrlTarget } from "./reference-urls";

export function referenceUrlHash(targets: ReferenceUrlTarget[]): string {
  const urls = [...new Set(targets.map(({ url }) => url))].sort();
  return createHash("sha256").update(JSON.stringify(urls)).digest("hex");
}

export function hasRecentReferenceUrlCheck(
  path: string,
  urlHash: string,
  now = Date.now(),
): boolean {
  try {
    const cached = JSON.parse(readFileSync(path, "utf8"));
    return (
      cached?.urlHash === urlHash &&
      typeof cached.completedAt === "number" &&
      now >= cached.completedAt &&
      now - cached.completedAt < 60 * 60 * 1000
    );
  } catch {
    return false;
  }
}

export function recordReferenceUrlCheck(
  path: string,
  urlHash: string,
  completedAt = Date.now(),
): void {
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({ completedAt, urlHash }) + "\n");
  } catch {
    // Caching is optional; an unwritable cache must not fail the check.
  }
}
