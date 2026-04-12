import { expect, test } from "bun:test";

import { findPrimaryKeywordIssues } from "../src/keywords";
import { loadRulesDocument } from "../src/rules";

test("all primary keywords match the first normative keyword in each statement", () => {
  const issues = findPrimaryKeywordIssues(loadRulesDocument());
  expect(issues).toEqual([]);
});
