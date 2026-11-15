import {
  getApplicableClasses,
  getRuleSubsets,
  resolveClassContent,
} from "./class-content";
import { visitRequirements, visitIndicators } from "./traversal";
import type {
  ClassKey,
  ClassContent,
  ContentClassKey,
  RulesDocument,
} from "./types";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import type { AnySchema, ErrorObject } from "ajv";

import { loadRulesDocument, loadSchemaDocument } from "./rules";

export function validateSchema(
  document = loadRulesDocument(),
  schemaDocument = loadSchemaDocument(),
) {
  const ajv = new Ajv2020({
    strict: true,
    allErrors: true,
  });
  addFormats(ajv as any);

  const schema = schemaDocument as AnySchema;
  const validate = ajv.compile(schema);
  const structurallyValid = validate(document);
  const errors = [...(validate.errors ?? [])];
  if (structurallyValid) {
    const effective = ajv.compile({
      $defs: (schemaDocument as { $defs: unknown }).$defs,
      $ref: "#/$defs/effective_rule_content",
    });
    const check = (
      entry: ClassContent & {
        varies_by_class?: Partial<Record<ContentClassKey, ClassContent>>;
      },
      location: string,
      classes: string[],
    ) => {
      for (const name of classes) {
        const key = name.toLowerCase() as ClassKey;
        if (!effective(resolveClassContent(entry, key))) {
          for (const error of effective.errors ?? []) {
            errors.push({
              ...error,
              instancePath: `/${location.replaceAll(".", "/")}/varies_by_class/${key}${error.instancePath}`,
            });
          }
        }
      }
    };
    visitRequirements(
      document as RulesDocument,
      ({ requirement, location }) => {
        const subsets = getRuleSubsets(document as RulesDocument, location);
        const classes = subsets.length
          ? [...getApplicableClasses(requirement, subsets)]
          : requirement.varies_by_class
            ? Object.keys(requirement.varies_by_class)
            : ["a"];
        check(requirement, location, classes);
      },
    );
    visitIndicators(document as RulesDocument, ({ indicator, location }) =>
      check(indicator, location, ["a", "b", "c", "d"]),
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    humanReadableErrors: formatSchemaErrors(errors, document),
  };
}

export function formatSchemaFailureSummary(
  result: ReturnType<typeof validateSchema>,
): string | null {
  if (result.valid) return null;
  const count = result.humanReadableErrors.length;
  return [
    `Schema validation failed with ${count} ${count === 1 ? "issue" : "issues"}:`,
    ...result.humanReadableErrors.map((message) => `  - ${message}`),
  ].join("\n");
}

export function formatSchemaErrors(
  errors: ErrorObject[],
  _document: unknown,
): string[] {
  const messages: string[] = [];
  const errorsByPath = Map.groupBy(errors, (error) => error.instancePath);

  for (const [instancePath, pathErrors] of errorsByPath) {
    const location = formatJsonPointerLocation(instancePath);

    const propertyNameMessage = formatPropertyNameErrors(pathErrors, location);
    if (propertyNameMessage) {
      messages.push(propertyNameMessage);
    }

    for (const error of pathErrors) {
      if (propertyNameMessage && isPropertyNameCompanionError(error)) {
        continue;
      }

      messages.push(formatSchemaError(error, location));
    }
  }

  return messages;
}

function formatPropertyNameErrors(
  errors: ErrorObject[],
  location: string,
): string | null {
  const propertyNames = unique(
    errors
      .filter((error) => error.keyword === "propertyNames")
      .map(getInvalidPropertyName)
      .filter((name): name is string => name !== null),
  );

  if (propertyNames.length === 0) {
    return null;
  }

  const propertyNameLabel =
    propertyNames.length === 1 ? "property name" : "property names";
  let message = `${location} has invalid ${propertyNameLabel}: ${formatList(propertyNames)}.`;

  const allowedValues = getAllowedEnumValues(errors);
  if (allowedValues.length > 0) {
    message += ` Allowed names are: ${formatList(allowedValues)}.`;
  }

  return message;
}

function isPropertyNameCompanionError(error: ErrorObject): boolean {
  if (error.keyword === "propertyNames") {
    return true;
  }

  if (error.keyword === "enum" && Array.isArray(error.params.allowedValues)) {
    return true;
  }

  return (
    ["anyOf", "oneOf", "allOf"].includes(error.keyword) &&
    error.schemaPath === `#/${error.keyword}`
  );
}

function formatSchemaError(error: ErrorObject, location: string): string {
  if (error.keyword === "required") {
    const missingProperty = String(error.params.missingProperty);
    return `${location} is missing required property ${missingProperty}.`;
  }

  if (error.keyword === "additionalProperties") {
    const additionalProperty = String(error.params.additionalProperty);
    return `${location} has unexpected property ${additionalProperty}.`;
  }

  return `${location} ${error.message ?? "does not match the schema"}.`;
}

function getInvalidPropertyName(error: ErrorObject): string | null {
  const propertyName = error.params.propertyName;
  return typeof propertyName === "string" ? propertyName : null;
}

function getAllowedEnumValues(errors: ErrorObject[]): string[] {
  for (const error of errors) {
    const allowedValues = error.params.allowedValues;
    if (!Array.isArray(allowedValues)) {
      continue;
    }

    const strings = allowedValues.filter(
      (value): value is string => typeof value === "string",
    );
    if (strings.length > 0) {
      return strings;
    }
  }

  return [];
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function formatList(values: string[]): string {
  return values.join(", ");
}

function formatJsonPointerLocation(pointer: string): string {
  if (pointer === "") {
    return "Document";
  }

  return pointer
    .slice(1)
    .split("/")
    .map(unescapeJsonPointerSegment)
    .map(formatLocationSegment)
    .join("");
}

function formatLocationSegment(segment: string, index: number): string {
  if (/^(0|[1-9]\d*)$/.test(segment)) {
    return `[${segment}]`;
  }

  return index === 0 ? segment : `.${segment}`;
}

function unescapeJsonPointerSegment(segment: string): string {
  return segment.replaceAll("~1", "/").replaceAll("~0", "~");
}
