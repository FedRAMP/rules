import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import type { AnySchema, ErrorObject } from "ajv";

import { loadRulesDocument, loadSchemaDocument } from "./rules";

export function validateSchema() {
  const ajv = new Ajv2020({
    strict: true,
    allErrors: true,
  });
  addFormats(ajv);

  const schema = loadSchemaDocument() as AnySchema;
  const document = loadRulesDocument();
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

    if (hasOwn(value, "varies_by_class") && hasOwn(value, "primary_key_word")) {
      messages.push(
        `${location} has both varies_by_class and top-level primary_key_word, and that's not allowed. Put primary_key_word inside each varies_by_class entry instead.`,
      );
      continue;
    }

    for (const error of pathErrors) {
      messages.push(formatSchemaError(error, location));
    }
  }

  return messages;
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
