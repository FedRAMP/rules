import { getResolvedPaths } from "./src/config";
import { green, hasFlag } from "./src/cli";
import {
  applyDefinitionTermTitleChanges,
  applyTermSync,
  collectDefinitionTermTitleChanges,
  collectTermSyncChanges,
} from "./src/terms";
import { loadRulesDocument, writeRulesDocument } from "./src/rules";

const updateMode = hasFlag("--update") || hasFlag("--write");
const commentMode = hasFlag("-comment") || hasFlag("--comment");
const { configPath, rulesPath } = getResolvedPaths();
const document = loadRulesDocument();

console.log(`Using config: ${configPath}`);
console.log(`Rules file: ${rulesPath}`);
console.log(updateMode ? "Mode: UPDATE" : "Mode: CHECK");
if (updateMode) {
  console.log(`Updated history comments: ${commentMode ? "ENABLED" : "DISABLED"}`);
}

const titleChanges = updateMode
  ? applyDefinitionTermTitleChanges(document)
  : collectDefinitionTermTitleChanges(document);
const syncChanges = updateMode
  ? applyTermSync(document, { addComment: commentMode })
  : collectTermSyncChanges(document);

if (titleChanges.length === 0 && syncChanges.length === 0) {
  console.log(green("Terms are already synchronized."));
  process.exit(0);
}

for (const change of titleChanges) {
  console.log(`[${updateMode ? "FIXED" : "WARN"}] definition ${change.id}`);
  console.log(`  Location: ${change.location}`);
  console.log(`  Current:  ${JSON.stringify(change.currentTerm)}`);
  console.log(`  Expected: ${JSON.stringify(change.nextTerm)}`);
}

for (const change of syncChanges) {
  console.log(`[${updateMode ? "UPDATED" : "DRIFT"}] ${change.kind} ${change.id}`);
  console.log(`  Location: ${change.location}`);
  console.log(`  Current:  ${JSON.stringify(change.currentTerms)}`);
  console.log(`  Expected: ${JSON.stringify(change.nextTerms)}`);
}

if (updateMode) {
  writeRulesDocument(document);
  console.log(green(`Updated ${titleChanges.length} definitions and synchronized ${syncChanges.length} entries.`));
} else {
  console.error(
    `Found ${titleChanges.length} definition title issues and ${syncChanges.length} entries with out-of-sync terms.`,
  );
  process.exit(1);
}
