import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  hasRecentReferenceUrlCheck,
  recordReferenceUrlCheck,
  referenceUrlHash,
} from "../src/reference-url-cache";

test("URL hash ignores order and duplicate locations but detects added, removed, and changed URLs", () => {
  const hash = (urls: string[]) =>
    referenceUrlHash(urls.map((url, i) => ({ url, location: String(i) })));
  expect(hash(["https://example.com/a", "https://example.com/b"])).toBe(
    hash([
      "https://example.com/b",
      "https://example.com/a",
      "https://example.com/a",
    ]),
  );
  const original = hash(["https://example.com/a"]);
  expect(hash([])).not.toBe(original);
  expect(hash(["https://example.com/b"])).not.toBe(original);
  expect(hash(["https://example.com/a", "https://example.com/b"])).not.toBe(
    original,
  );
});

test("cache skips only matching URLs checked less than one hour ago", () => {
  const dir = mkdtempSync(join(tmpdir(), "reference-url-cache-"));
  const path = join(dir, "cache", "check");
  const now = 10_000_000;
  try {
    expect(hasRecentReferenceUrlCheck(path, "hash", now)).toBe(false);
    recordReferenceUrlCheck(path, "hash", now);
    expect(hasRecentReferenceUrlCheck(path, "hash", now)).toBe(true);
    expect(hasRecentReferenceUrlCheck(path, "hash", now + 3_599_999)).toBe(
      true,
    );
    expect(hasRecentReferenceUrlCheck(path, "hash", now + 3_600_000)).toBe(
      false,
    );
    expect(hasRecentReferenceUrlCheck(path, "changed", now)).toBe(false);
    expect(hasRecentReferenceUrlCheck(path, "hash", now - 1)).toBe(false);
    for (const content of [
      "broken",
      "null",
      "{}",
      JSON.stringify({ urlHash: "hash", completedAt: String(now) }),
    ]) {
      writeFileSync(path, content);
      expect(hasRecentReferenceUrlCheck(path, "hash", now)).toBe(false);
    }
    // A directory cannot be read or overwritten as a cache file.
    expect(hasRecentReferenceUrlCheck(dir, "hash", now)).toBe(false);
    expect(() => recordReferenceUrlCheck(dir, "hash", now)).not.toThrow();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
