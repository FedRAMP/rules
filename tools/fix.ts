import { green, getOptionValue, hasFlag, writeJsonFile } from "./src/cli";
import { getResolvedPaths } from "./src/config";
import {
  applyAutoFixes,
  applyIdsFix,
  applyOrderFix,
  applyTermsFix,
  collectAutoFixPlan,
  collectIdsFixPlan,
  collectOrderFixPlan,
  collectTermsFixPlan,
  isFixScope,
} from "./src/fix";
import { cloneDocument, loadRulesDocument, loadSchemaDocument, writeRulesDocument } from "./src/rules";
import type { RulesDocument } from "./src/types";

function printAutoCheck(label: string, count: number, fixCommand: string): void {
  if (count === 0) {
    console.log(`[CHECK] ${label}: clean`);
    return;
  }

  console.log(`[CHECK] ${label}: ${count} issue${count === 1 ? "" : "s"} -> ${fixCommand}`);
}

function writeDocument(document: RulesDocument, outputPath?: string): void {
  if (outputPath) {
    writeJsonFile(outputPath, document);
    console.log(green(`Wrote updated rules file to ${outputPath}.`));
    return;
  }

  writeRulesDocument(document);
}

const scopeValue = getOptionValue("--scope") ?? "auto";
if (!isFixScope(scopeValue)) {
  console.error(`Unsupported fix scope "${scopeValue}". Expected one of: auto, terms, ids, order.`);
  process.exit(1);
}

const scope = scopeValue;
const commentMode = hasFlag("-comment") || hasFlag("--comment");
const dateOverride = getOptionValue("--date");
const outputPath = getOptionValue("--output");
const reportPath = getOptionValue("--report");

if (reportPath && scope !== "ids") {
  console.error("--report is only supported with --scope ids.");
  process.exit(1);
}

if (commentMode && scope !== "auto" && scope !== "terms") {
  console.error("-comment/--comment is only supported with --scope auto or --scope terms.");
  process.exit(1);
}

const { configPath, rulesPath, schemaPath } = getResolvedPaths();
const source = loadRulesDocument();
const schema = loadSchemaDocument();
const entryDate = dateOverride ?? source.info.last_updated;

console.log(`Using config: ${configPath}`);
console.log(`Rules file: ${rulesPath}`);
console.log(`Schema file: ${schemaPath}`);
console.log("Mode: FIX");
console.log(`Scope: ${scope.toUpperCase()}`);
if (commentMode) {
  console.log("Updated history comments: ENABLED");
}

if (scope === "auto") {
  const plan = collectAutoFixPlan(source, schema);

  printAutoCheck("test:terms (definition title casing)", plan.definitionTermIssueCount, "fix:terms");
  printAutoCheck("test:terms (terms sync)", plan.termSyncIssueCount, "fix:terms");
  printAutoCheck("test:ids", plan.idIssueCount, "fix:ids");
  printAutoCheck("test:order", plan.propertyOrderIssueCount, "fix:order");

  if (!plan.needsTermsFix && !plan.needsIdsFix && !plan.needsOrderFix) {
    console.log(green("No automatic fixes were needed."));
    process.exit(0);
  }

  const result = applyAutoFixes(cloneDocument(source), schema, {
    addTermComments: commentMode,
    entryDate,
  });

  writeDocument(result.document, outputPath);

  if (result.idFixedCount > 0 || result.idSkippedCount > 0) {
    console.log(
      `[FIX] fix:ids applied ${result.idFixedCount} fix${result.idFixedCount === 1 ? "" : "es"}`
        + ` and skipped ${result.idSkippedCount} collision${result.idSkippedCount === 1 ? "" : "s"}.`,
    );
  }
  if (result.definitionTermFixedCount > 0 || result.termSyncFixedCount > 0) {
    console.log(
      `[FIX] fix:terms applied ${result.definitionTermFixedCount} definition title fix${
        result.definitionTermFixedCount === 1 ? "" : "es"
      } and synchronized ${result.termSyncFixedCount} entr${result.termSyncFixedCount === 1 ? "y" : "ies"}.`,
    );
  }
  if (result.propertyOrderFixedCount > 0) {
    console.log(
      `[FIX] fix:order applied ${result.propertyOrderFixedCount} property order fix${
        result.propertyOrderFixedCount === 1 ? "" : "es"
      }.`,
    );
  }

  const remaining = collectAutoFixPlan(result.document, schema);
  if (remaining.needsTermsFix || remaining.needsIdsFix || remaining.needsOrderFix) {
    console.error("Automatic fixes completed, but some fixable issues still remain.");
    process.exit(1);
  }

  console.log(green("Applied all needed automatic fixes."));
  process.exit(0);
}

if (scope === "terms") {
  const plan = collectTermsFixPlan(source);
  if (!plan.needsFix) {
    console.log(green("Terms are already synchronized."));
    process.exit(0);
  }

  const result = applyTermsFix(cloneDocument(source), {
    addComment: commentMode,
    entryDate,
  });
  writeDocument(result.document, outputPath);
  console.log(
    green(
      `Applied ${result.definitionTermFixedCount} definition fixes and synchronized ${result.termSyncFixedCount} entries.`,
    ),
  );
  process.exit(0);
}

if (scope === "ids") {
  const plan = collectIdsFixPlan(source);
  if (!plan.needsFix) {
    console.log(green("All IDs are aligned with their parent keys."));
    process.exit(0);
  }

  const result = applyIdsFix(cloneDocument(source), { entryDate });

  if (reportPath) {
    writeJsonFile(reportPath, {
      input: rulesPath,
      output: outputPath ?? rulesPath,
      fix_count: result.fixedCount,
      skipped_collision_count: result.skippedCount,
      fixes: result.issues,
    });
  }

  writeDocument(result.document, outputPath);
  console.log(green(`Applied ${result.fixedCount} ID fixes.`));
  process.exit(0);
}

const plan = collectOrderFixPlan(source, schema);
if (!plan.needsFix) {
  console.log(green("All object properties follow the schema-defined order."));
  process.exit(0);
}

const result = applyOrderFix(cloneDocument(source), schema);
writeDocument(result.document, outputPath);
console.log(green(`Applied ${result.fixedCount} property order fixes.`));
