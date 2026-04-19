import { green, getOptionValue } from "./src/cli";
import { isSummaryScope, runSummaries } from "./src/summary";

const scopeValue = getOptionValue("--scope");
if (scopeValue && !isSummaryScope(scopeValue)) {
  console.error(`Unsupported summary scope "${scopeValue}". Expected: rules.`);
  process.exit(1);
}

const completedScopes = runSummaries(scopeValue);

if (completedScopes.length === 1) {
  console.log(green(`Completed ${completedScopes[0]} summary successfully.`));
  process.exit(0);
}

console.log(green("All summary commands completed successfully."));
