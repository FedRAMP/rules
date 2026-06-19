import type { PropertyOrderIssue, RulesDocument } from "./types";
import {
  dereferenceSchema,
  isJsonObject,
  type JsonObject,
  type JsonSchema,
} from "./schema-metadata";

const isRecord = isJsonObject;

function getPropertiesSchema(schema: JsonSchema | null): JsonObject | null {
  if (!schema || !isRecord(schema.properties)) {
    return null;
  }

  return schema.properties;
}

function getPatternPropertiesSchema(
  schema: JsonSchema | null,
): JsonObject | null {
  if (!schema || !isRecord(schema.patternProperties)) {
    return null;
  }

  return schema.patternProperties;
}

function getAdditionalPropertiesSchema(
  schema: JsonSchema | null,
): JsonSchema | null {
  if (!schema || !isRecord(schema.additionalProperties)) {
    return null;
  }

  return schema.additionalProperties;
}

function getItemsSchema(schema: JsonSchema | null): JsonSchema | null {
  if (!schema || !isRecord(schema.items)) {
    return null;
  }

  return schema.items;
}

function getPropertyNamesSchema(schema: JsonSchema | null): JsonSchema | null {
  if (!schema || !isRecord(schema.propertyNames)) {
    return null;
  }

  return schema.propertyNames;
}

function getOrderedNamesFromSchema(
  rootSchema: JsonSchema,
  schema: unknown,
): string[] | null {
  const resolvedSchema = dereferenceSchema(rootSchema, schema);
  if (!resolvedSchema) {
    return null;
  }

  if (Array.isArray(resolvedSchema.enum)) {
    const enumValues = resolvedSchema.enum.filter(
      (value): value is string => typeof value === "string",
    );
    if (enumValues.length > 0) {
      return enumValues;
    }
  }

  if (typeof resolvedSchema.const === "string") {
    return [resolvedSchema.const];
  }

  for (const keyword of ["anyOf", "oneOf", "allOf"] as const) {
    const entries = resolvedSchema[keyword];
    if (!Array.isArray(entries)) {
      continue;
    }

    const orderedNames: string[] = [];
    for (const entry of entries) {
      const childNames = getOrderedNamesFromSchema(rootSchema, entry);
      if (!childNames) {
        continue;
      }

      for (const name of childNames) {
        if (!orderedNames.includes(name)) {
          orderedNames.push(name);
        }
      }
    }

    if (orderedNames.length > 0) {
      return orderedNames;
    }
  }

  return null;
}

function getStringProperty(value: unknown, property: string): string | null {
  if (!isRecord(value) || typeof value[property] !== "string") {
    return null;
  }

  return value[property];
}

function compareEntriesByProperty(
  left: [string, unknown],
  right: [string, unknown],
  property: string,
): number {
  const leftValue = getStringProperty(left[1], property) ?? left[0];
  const rightValue = getStringProperty(right[1], property) ?? right[0];
  const valueComparison = leftValue.localeCompare(rightValue);

  return valueComparison === 0
    ? left[0].localeCompare(right[0])
    : valueComparison;
}

function compareKeysAlphabetically(left: string, right: string): number {
  return left.localeCompare(right);
}

function getCustomKeyOrder(
  schema: JsonSchema | null,
  value: JsonObject,
): string[] | null {
  if (!schema || !isRecord(schema["x-key-order"])) {
    return null;
  }

  const order = schema["x-key-order"];
  const direction = order.direction === "descending" ? -1 : 1;
  const entries = Object.entries(value);

  if (order.by === "key") {
    return entries
      .map(([key]) => key)
      .sort(
        (left, right) => direction * compareKeysAlphabetically(left, right),
      );
  }

  if (order.by === "property" && typeof order.property === "string") {
    return entries
      .sort(
        (left, right) =>
          direction *
          compareEntriesByProperty(left, right, order.property as string),
      )
      .map(([key]) => key);
  }

  return null;
}

function formatPropertyList(values: string[]): string {
  return values.join(", ");
}

export function formatPropertyOrderReport(
  issues: PropertyOrderIssue[],
): string {
  const issueLabel = issues.length === 1 ? "issue" : "issues";

  return [
    `Property order failed with ${issues.length} ${issueLabel}:`,
    ...issues.map(
      (issue) =>
        `- ${issue.path}: expected order ${formatPropertyList(
          issue.expectedOrder,
        )}; found order ${formatPropertyList(issue.actualOrder)}.`,
    ),
  ].join("\n");
}

function getPreferredOrder(
  rootSchema: JsonSchema,
  schema: JsonSchema | null,
  value: JsonObject,
  _path: string,
): string[] {
  const customOrder = getCustomKeyOrder(schema, value);
  if (customOrder) {
    return customOrder;
  }

  const properties = getPropertiesSchema(schema);
  const propertyNameSchema = getPropertyNamesSchema(schema);
  const propertyNameOrder = propertyNameSchema
    ? (getOrderedNamesFromSchema(rootSchema, propertyNameSchema) ?? [])
    : [];

  const preferredKeys = properties ? Object.keys(properties) : [];
  const orderedKeys = [...preferredKeys];

  for (const key of propertyNameOrder) {
    if (!orderedKeys.includes(key)) {
      orderedKeys.push(key);
    }
  }

  if (orderedKeys.length === 0) {
    return Object.keys(value);
  }

  const presentPreferredKeys = orderedKeys.filter((key) => key in value);
  const remainingKeys = Object.keys(value).filter(
    (key) => !orderedKeys.includes(key),
  );

  return [...presentPreferredKeys, ...remainingKeys];
}

function getChildSchema(
  rootSchema: JsonSchema,
  parentSchema: JsonSchema | null,
  key: string,
): JsonSchema | null {
  const properties = getPropertiesSchema(parentSchema);
  if (properties && isRecord(properties[key])) {
    return properties[key];
  }

  const patternProperties = getPatternPropertiesSchema(parentSchema);
  if (patternProperties) {
    for (const [pattern, schema] of Object.entries(patternProperties)) {
      if (new RegExp(pattern).test(key) && isRecord(schema)) {
        return schema;
      }
    }
  }

  const additionalProperties = getAdditionalPropertiesSchema(parentSchema);
  if (additionalProperties) {
    return additionalProperties;
  }

  return null;
}

function collectIssuesForValue(
  value: unknown,
  schema: unknown,
  rootSchema: JsonSchema,
  path: string,
  issues: PropertyOrderIssue[],
): void {
  const resolvedSchema = dereferenceSchema(rootSchema, schema);

  if (Array.isArray(value)) {
    const itemsSchema = getItemsSchema(resolvedSchema);
    if (!itemsSchema) {
      return;
    }

    value.forEach((item, index) => {
      collectIssuesForValue(
        item,
        itemsSchema,
        rootSchema,
        `${path}[${index}]`,
        issues,
      );
    });
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  const actualOrder = Object.keys(value);
  const expectedOrder = getPreferredOrder(
    rootSchema,
    resolvedSchema,
    value,
    path,
  );

  if (
    actualOrder.length > 1 &&
    actualOrder.some((key, index) => key !== expectedOrder[index])
  ) {
    issues.push({
      path,
      actualOrder,
      expectedOrder,
    });
  }

  for (const [key, childValue] of Object.entries(value)) {
    const childSchema = getChildSchema(rootSchema, resolvedSchema, key);
    if (!childSchema) {
      continue;
    }

    const childPath = path ? `${path}.${key}` : key;
    collectIssuesForValue(
      childValue,
      childSchema,
      rootSchema,
      childPath,
      issues,
    );
  }
}

function reorderValue(
  value: unknown,
  schema: unknown,
  rootSchema: JsonSchema,
  path: string,
  issues: PropertyOrderIssue[],
): unknown {
  const resolvedSchema = dereferenceSchema(rootSchema, schema);

  if (Array.isArray(value)) {
    const itemsSchema = getItemsSchema(resolvedSchema);
    if (!itemsSchema) {
      return value;
    }

    return value.map((item, index) =>
      reorderValue(item, itemsSchema, rootSchema, `${path}[${index}]`, issues),
    );
  }

  if (!isRecord(value)) {
    return value;
  }

  const withReorderedChildren: JsonObject = {};

  for (const [key, childValue] of Object.entries(value)) {
    const childSchema = getChildSchema(rootSchema, resolvedSchema, key);
    withReorderedChildren[key] = childSchema
      ? reorderValue(
          childValue,
          childSchema,
          rootSchema,
          path ? `${path}.${key}` : key,
          issues,
        )
      : childValue;
  }

  const actualOrder = Object.keys(withReorderedChildren);
  const expectedOrder = getPreferredOrder(
    rootSchema,
    resolvedSchema,
    withReorderedChildren,
    path,
  );

  if (
    actualOrder.length > 1 &&
    actualOrder.some((key, index) => key !== expectedOrder[index])
  ) {
    issues.push({
      path,
      actualOrder,
      expectedOrder,
    });
  }

  const reorderedObject: JsonObject = {};
  for (const key of expectedOrder) {
    reorderedObject[key] = withReorderedChildren[key];
  }

  return reorderedObject;
}

export function collectPropertyOrderIssues(
  document: RulesDocument,
  schemaDocument: unknown,
): PropertyOrderIssue[] {
  const rootSchema = dereferenceSchema(
    schemaDocument as JsonSchema,
    schemaDocument,
  );
  if (!rootSchema) {
    return [];
  }

  const issues: PropertyOrderIssue[] = [];
  collectIssuesForValue(document, rootSchema, rootSchema, "", issues);
  return issues;
}

export function fixPropertyOrder(
  document: RulesDocument,
  schemaDocument: unknown,
): {
  document: RulesDocument;
  issues: PropertyOrderIssue[];
  fixedCount: number;
} {
  const rootSchema = dereferenceSchema(
    schemaDocument as JsonSchema,
    schemaDocument,
  );
  if (!rootSchema) {
    return {
      document,
      issues: [],
      fixedCount: 0,
    };
  }

  const issues: PropertyOrderIssue[] = [];
  const reorderedDocument = reorderValue(
    document,
    rootSchema,
    rootSchema,
    "",
    issues,
  ) as RulesDocument;

  return {
    document: reorderedDocument,
    issues,
    fixedCount: issues.length,
  };
}
