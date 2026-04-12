import { getResolvedPaths } from "./src/config";
import { hasFlag } from "./src/cli";
import { applyTermSync, collectTermSyncChanges } from "./src/terms";
import { loadRulesDocument, writeRulesDocument } from "./src/rules";

const updateMode = hasFlag("--update") || hasFlag("--write");
const { configPath, rulesPath } = getResolvedPaths();
const document = loadRulesDocument();

console.log(`Using config: ${configPath}`);
console.log(`Rules file: ${rulesPath}`);
console.log(updateMode ? "Mode: UPDATE" : "Mode: CHECK");

const changes = updateMode ? applyTermSync(document) : collectTermSyncChanges(document);

if (changes.length === 0) {
  console.log("Terms are already synchronized.");
  process.exit(0);
}

for (const change of changes) {
  console.log(`[${updateMode ? "UPDATED" : "DRIFT"}] ${change.kind} ${change.id}`);
  console.log(`  Location: ${change.location}`);
  console.log(`  Current:  ${JSON.stringify(change.currentTerms)}`);
  console.log(`  Expected: ${JSON.stringify(change.nextTerms)}`);
}

if (updateMode) {
  writeRulesDocument(document);
  console.log(`Updated terms for ${changes.length} entries.`);
} else {
  console.error(`Found ${changes.length} entries with out-of-sync terms.`);
  process.exit(1);
}
