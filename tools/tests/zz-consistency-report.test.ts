import { test } from "bun:test";

import {
  collectConsistencyChecks,
  formatConsistencyReport,
} from "../src/consistency";
import { loadRulesDocument } from "../src/rules";

test("consistency validation report", () => {
  const checks = collectConsistencyChecks(loadRulesDocument());

  if (checks.some((check) => check.issues.length > 0)) {
    throw new Error(formatConsistencyReport(checks));
  }
});
