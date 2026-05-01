import {
  collectConsistencyChecks,
  formatConsistencyReport,
} from "./src/consistency";
import { loadRulesDocument } from "./src/rules";

const testResult = Bun.spawnSync({
  cmd: ["bun", "test"],
  stdout: "inherit",
  stderr: "inherit",
});

const consistencyChecks = collectConsistencyChecks(loadRulesDocument());
const consistencyFailed = consistencyChecks.some((check) => check.issues.length > 0);

if (consistencyFailed) {
  console.error("Final consistency validation summary:");
  console.error("");
  console.error(formatConsistencyReport(consistencyChecks));
}

process.exit(testResult.exitCode ?? 1);
