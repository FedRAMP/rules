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
  const valid = validate(document);

  return {
    valid: Boolean(valid),
    errors: validate.errors ?? [],
    humanReadableErrors: formatSchemaErrors(validate.errors ?? [], document),
  };
}

export function formatSchemaErrors(
  errors: ErrorObject[],
  document: unknown,
): string[] {
  const messages: string[] = [];
  const errorsByPath = Map.groupBy(errors, (error) => error.instancePath);

  for (const [instancePath, pathErrors] of errorsByPath) {
    const value = getValueAtJsonPointer(document, instancePath);
    const location = formatJsonPointerLocation(instancePath);

    if (hasOwn(value, "varies_by_class") && hasOwn(value, "force")) {
      messages.push(
        `${location} has both varies_by_class and top-level force, and that's not allowed. Put force inside each varies_by_class entry instead.`,
      );
      continue;
    }

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

  if (
    error.keyword === "enum" &&
    Array.isArray(error.params.allowedValues)
  ) {
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

function getValueAtJsonPointer(document: unknown, pointer: string): unknown {
  if (pointer === "") {
    return document;
  }

  return pointer
    .slice(1)
    .split("/")
    .map(unescapeJsonPointerSegment)
    .reduce<unknown>((current, segment) => {
      if (current === null || typeof current !== "object") {
        return undefined;
      }

      return (current as Record<string, unknown>)[segment];
    }, document);
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

function hasOwn(value: unknown, property: string): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    Object.hasOwn(value, property)
  );
}
