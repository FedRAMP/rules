import { test } from "bun:test";
import { resolve } from "node:path";
import {
  hasRecentReferenceUrlCheck,
  recordReferenceUrlCheck,
  referenceUrlHash,
} from "../src/reference-url-cache";
import {
  collectReferenceUrls,
  collectReferenceUrlIssues,
  formatReferenceUrlReport,
} from "../src/reference-urls";
import { loadRulesDocument } from "../src/rules";

const rulesDocument = loadRulesDocument();
const targets = collectReferenceUrls(rulesDocument);
const referenceCount = targets.length;
const cachePath = resolve(
  import.meta.dir,
  "../node_modules/.cache/reference-url-check",
);
const urlHash = referenceUrlHash(targets);
const recentlyChecked = hasRecentReferenceUrlCheck(cachePath, urlHash);
const requestTimeoutMs = 10_000;

(recentlyChecked ? test.skip : test)(
  `check ${referenceCount} reference URLs and warn about reachability issues${recentlyChecked ? " (unchanged URLs checked within the last hour)" : ""}`,
  async () => {
    const issues = await collectReferenceUrlIssues(rulesDocument, {
      timeoutMs: requestTimeoutMs,
    });
    if (issues.length > 0) {
      console.warn(formatReferenceUrlReport(issues));
    }
    recordReferenceUrlCheck(cachePath, urlHash);
  },
  // Allow every request its full deadline, plus runner overhead. Requests are
  // concurrent and deduplicated, so this is a conservative upper bound.
  referenceCount * requestTimeoutMs + 5_000,
);
