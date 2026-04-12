import { getResolvedPaths } from "./src/config";
import { getOptionValue, hasFlag, writeJsonFile } from "./src/cli";
import { fixIdAlignment } from "./src/id-alignment";
import { cloneDocument, loadRulesDocument, writeRulesDocument } from "./src/rules";

const inPlace = hasFlag("--in-place");
const writeMode = hasFlag("--write") || inPlace;
const reportPath = getOptionValue("--report");
const dateOverride = getOptionValue("--date");
const outputPath = getOptionValue("--output");

const { configPath, rulesPath } = getResolvedPaths();
const source = loadRulesDocument();
const working = cloneDocument(source);
const entryDate = dateOverride ?? source.info.last_updated;

const result = fixIdAlignment(working, {
  entryDate,
  updateDocument: writeMode,
});

console.log(`Using config: ${configPath}`);
console.log(`Rules file: ${rulesPath}`);
console.log(writeMode ? "Mode: FIX" : "Mode: CHECK");

if (result.issues.length === 0) {
  console.log("All IDs are aligned with their parent keys.");
  process.exit(0);
}

for (const issue of result.issues) {
  const label = issue.status === "fixed" ? "FIX" : "ISSUE";
  console.log(`[${label}] ${issue.oldKey} -> ${issue.newKey}`);
  console.log(`  Parent:   ${issue.parent}`);
  console.log(`  Location: ${issue.path}`);
}

if (reportPath) {
  writeJsonFile(reportPath, {
    input: rulesPath,
    output: writeMode ? (inPlace || !outputPath ? rulesPath : outputPath) : null,
    fix_count: result.fixedCount,
    skipped_collision_count: result.skippedCount,
    fixes: result.issues,
  });
}

if (!writeMode) {
  console.error(`Found ${result.issues.length} ID alignment issues.`);
  process.exit(1);
}

if (inPlace || !outputPath) {
  writeRulesDocument(working);
  console.log(`Applied ${result.fixedCount} ID fixes in place.`);
} else {
  writeJsonFile(outputPath, working);
  console.log(`Wrote updated rules file to ${outputPath}.`);
}
