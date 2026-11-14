import { loadRulesDocument, loadSchemaDocument } from "../rules";
import { requireStringEnum } from "../schema-metadata";
import { validateSchema } from "../schema-validation";
import type { CertificationType, ClassName, RulesDocument } from "../types";
import { collectOverall, renderOverall } from "./overall";
import { collectProfile, renderProfile } from "./profile";

interface ReportContext {
  document: RulesDocument;
  schema: unknown;
}

interface ReportDefinition {
  name: string;
  usage: string;
  description: string;
  argumentCount: number;
  run: (context: ReportContext, args: string[]) => string;
}

function enumArgument(
  schema: unknown,
  pointer: string,
  input: string,
  label: string,
): string {
  const values = requireStringEnum(schema, pointer);
  const value = values.find(
    (candidate) => candidate.toLowerCase() === input.toLowerCase(),
  );
  if (!value)
    throw new Error(
      `Unknown ${label} "${input}". Expected: ${values.join(", ")}.`,
    );
  return value;
}

export const reports: readonly ReportDefinition[] = [
  {
    name: "profile",
    usage: "bun report profile <type> <class>",
    description:
      "List FRR rules matching a certification type and class, with force and affected-party totals.",
    argumentCount: 2,
    run: ({ document, schema }, args) => {
      const type = enumArgument(
        schema,
        "#/$defs/certification_type",
        args[0]!,
        "type",
      ) as CertificationType;
      const className = enumArgument(
        schema,
        "#/$defs/class_name",
        args[1]!,
        "class",
      ) as ClassName;
      return [
        `Profile: ${type} Class ${className}`,
        "Filters: type and class only; all actors and paths; status and effective dates are not filtered.",
        "",
        renderProfile(collectProfile(document, type, className), className),
      ].join("\n");
    },
  },
  {
    name: "overall",
    usage: "bun report overall",
    description:
      "Count rulesets, populated subsets, rules, KSI indicators, and controls.",
    argumentCount: 0,
    run: ({ document }) => renderOverall(collectOverall(document)),
  },
];

// Injectable loading keeps error handling testable without changing configured files.
export function runReport(
  args: string[],
  load: () => ReportContext = () => ({
    document: loadRulesDocument(),
    schema: loadSchemaDocument(),
  }),
): string {
  if (!args.length || (args.length === 1 && args[0] === "--help")) {
    return reports
      .map((report) => `${report.usage}\n  ${report.description}`)
      .join("\n\n");
  }
  const report = reports.find((entry) => entry.name === args[0]);
  if (!report)
    throw new Error(`Unknown report "${args[0]}". Run bun report --help.`);
  const reportArgs = args.slice(1);
  if (reportArgs.length === 1 && reportArgs[0] === "--help")
    return `${report.usage}\n${report.description}`;
  if (
    reportArgs.length !== report.argumentCount ||
    reportArgs.includes("--help")
  )
    throw new Error(`Usage: ${report.usage}`);
  const context = load();
  const validation = validateSchema(context.document, context.schema);
  if (!validation.valid)
    throw new Error(
      `Schema validation failed:\n${validation.humanReadableErrors.join("\n")}`,
    );
  const body = report.run(context, reportArgs);
  return `Dataset: ${context.document.info.version} (updated ${context.document.info.last_updated})\n\n${body}`;
}
