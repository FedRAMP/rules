import { expect, test } from "bun:test";

import { loadRulesDocument } from "../src/rules";
import { buildRulesSummaryMarkdown } from "../src/summary-rules";

test("the rules summary renderer includes the current dataset metadata", () => {
  const document = loadRulesDocument();
  const markdown = buildRulesSummaryMarkdown(document);

  expect(markdown).toContain("# FedRAMP Rules Summary");
  expect(markdown).toContain(`version ${document.info.version}`);
  expect(markdown).toContain(`last updated ${document.info.last_updated}`);
});
