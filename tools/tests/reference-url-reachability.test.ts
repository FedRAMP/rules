import { test } from "bun:test";
import {
  collectReferenceUrls,
  collectReferenceUrlIssues,
  formatReferenceUrlReport,
} from "../src/reference-urls";
import { loadRulesDocument } from "../src/rules";

const rulesDocument = loadRulesDocument();
const referenceCount = collectReferenceUrls(rulesDocument).length;
const requestTimeoutMs = 10_000;

test(
  `check ${referenceCount} reference URLs and warn about reachability issues`,
  async () => {
    const issues = await collectReferenceUrlIssues(rulesDocument, {
      timeoutMs: requestTimeoutMs,
    });
    if (issues.length > 0) {
      console.warn(formatReferenceUrlReport(issues));
    }
  },
  // Allow every request its full deadline, plus runner overhead. Requests are
  // concurrent and deduplicated, so this is a conservative upper bound.
  referenceCount * requestTimeoutMs + 5_000,
);
