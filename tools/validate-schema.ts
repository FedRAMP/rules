import { green } from "./src/cli";
import { getResolvedPaths } from "./src/config";
import { validateSchema } from "./src/schema-validation";

const { configPath, rulesPath, schemaPath } = getResolvedPaths();
const result = validateSchema();

console.log(`Using config: ${configPath}`);
console.log(`Rules file: ${rulesPath}`);
console.log(`Schema file: ${schemaPath}`);

if (result.valid) {
  console.log(green("Schema validation passed."));
  process.exit(0);
}

console.error("Schema validation failed:");
console.error(JSON.stringify(result.errors, null, 2));
process.exit(1);
