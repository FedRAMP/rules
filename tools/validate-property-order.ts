import { getResolvedPaths } from "./src/config";
import { getOptionValue, green, hasFlag, writeJsonFile } from "./src/cli";
import { fixPropertyOrder } from "./src/property-order";
import { cloneDocument, loadRulesDocument, loadSchemaDocument, writeRulesDocument } from "./src/rules";

const writeMode = hasFlag("--write");
const outputPath = getOptionValue("--output");

const { configPath, rulesPath, schemaPath } = getResolvedPaths();
const source = loadRulesDocument();
const schema = loadSchemaDocument();
const working = cloneDocument(source);

const result = fixPropertyOrder(working, schema);

console.log(`Using config: ${configPath}`);
console.log(`Rules file: ${rulesPath}`);
console.log(`Schema file: ${schemaPath}`);
console.log(writeMode ? "Mode: FIX" : "Mode: CHECK");

if (result.issues.length === 0) {
  console.log(green("All object properties follow the schema-defined order."));
  process.exit(0);
}

for (const issue of result.issues) {
  console.log(`[${writeMode ? "FIX" : "ISSUE"}] ${issue.path || "<root>"}`);
  console.log(`  Current:  ${JSON.stringify(issue.actualOrder)}`);
  console.log(`  Expected: ${JSON.stringify(issue.expectedOrder)}`);
}

if (!writeMode) {
  console.error(`Found ${result.issues.length} property order issues.`);
  process.exit(1);
}

if (outputPath) {
  writeJsonFile(outputPath, result.document);
  console.log(green(`Wrote reordered rules file to ${outputPath}.`));
} else {
  writeRulesDocument(result.document);
  console.log(green(`Applied ${result.fixedCount} property order fixes in place.`));
}
