import { green } from "./src/cli";
import { getResolvedPaths } from "./src/config";
import { findPrimaryKeywordIssues } from "./src/keywords";
import { loadRulesDocument } from "./src/rules";

const { configPath, rulesPath } = getResolvedPaths();
const issues = findPrimaryKeywordIssues(loadRulesDocument());

console.log(`Using config: ${configPath}`);
console.log(`Rules file: ${rulesPath}`);

if (issues.length === 0) {
  console.log(green("No primary keyword mismatches found."));
  process.exit(0);
}

for (const issue of issues) {
  console.log(`[MISMATCH] ${issue.id}`);
  console.log(`  Location: ${issue.location}`);
  console.log(`  ${issue.message}`);
}

console.error(`Found ${issues.length} primary keyword mismatches.`);
process.exit(1);
