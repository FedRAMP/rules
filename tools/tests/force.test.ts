import { expect, test } from "bun:test";

import { findForceIssues } from "../src/keywords";
import { loadRulesDocument } from "../src/rules";

test("all force values match the first normative keyword in each statement", () => {
  const issues = findForceIssues(loadRulesDocument());
  expect(issues).toEqual([]);
});
