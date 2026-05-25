import { expect, test } from "bun:test";

import { cloneDocument, loadRulesDocument } from "../src/rules";
import { buildRulesSummaryMarkdown } from "../src/summary-rules";
import type { RulesDocument } from "../src/types";

test("the rules summary renderer includes the current dataset metadata", () => {
  const document = loadRulesDocument();
  const markdown = buildRulesSummaryMarkdown(document);

  expect(markdown).toContain("# FedRAMP Rules Summary");
  expect(markdown).toContain(`version ${document.info.version}`);
  expect(markdown).toContain(`last updated ${document.info.last_updated}`);
});

function effectiveEntry(
  currentStatus: string,
  obtain: string,
  maintain: string,
  graceEnds: string,
) {
  return {
    is: "required",
    current_status: currentStatus,
    date: {
      obtain,
      maintain,
      grace_ends: graceEnds,
    },
  };
}

test("the rules summary renderer reads common and framework-specific effective info", () => {
  const document = cloneDocument(loadRulesDocument());

  document.FRR = {
    CMN: {
      info: {
        name: "Common Effective",
        status: "stable",
        effective: effectiveEntry(
          "Common status",
          "2026-01-02",
          "2026-01-03",
          "2026-01-04",
        ),
      },
      data: {},
    },
    SPL: {
      info: {
        name: "Split Effective",
        status: "placeholder",
        rev5: {
          effective: effectiveEntry(
            "Rev5 status",
            "2027-02-02",
            "2027-02-03",
            "2027-02-04",
          ),
        },
        "20x": {
          effective: effectiveEntry(
            "20x status",
            "2026-07-02",
            "2026-07-03",
            "2026-07-04",
          ),
        },
      },
      data: {},
    },
  } satisfies RulesDocument["FRR"];

  const markdown = buildRulesSummaryMarkdown(document);

  expect(markdown).toContain(
    "| CMN | Common Effective | stable | 0 | 2026-01-02 | 2026-01-03 | 2026-01-04 | 2026-01-02 | 2026-01-03 | 2026-01-04 | - |",
  );
  expect(markdown).toContain(
    "| SPL | Split Effective | placeholder | 0 | 2027-02-02 | 2027-02-03 | 2027-02-04 | 2026-07-02 | 2026-07-03 | 2026-07-04 | - |",
  );
});
