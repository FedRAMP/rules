import { expect, test } from "bun:test";

import { collectIdAlignmentIssues } from "../src/id-alignment";
import { loadRulesDocument } from "../src/rules";

test("all requirement IDs align with their parent containers", () => {
  const issues = collectIdAlignmentIssues(loadRulesDocument());
  expect(issues).toEqual([]);
});
