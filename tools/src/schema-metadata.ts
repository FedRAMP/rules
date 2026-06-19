export type JsonObject = Record<string, unknown>;
export type JsonSchema = Record<string, unknown>;

export function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function decodeJsonPointerSegment(segment: string): string {
  return segment.replaceAll("~1", "/").replaceAll("~0", "~");
}

export function resolveSchemaPointer(
  rootSchema: JsonSchema,
  pointer: string,
): unknown {
  if (pointer === "#") {
    return rootSchema;
  }
  if (!pointer.startsWith("#/")) {
    return undefined;
  }

  let current: unknown = rootSchema;
  for (const segment of pointer
    .slice(2)
    .split("/")
    .map(decodeJsonPointerSegment)) {
    if (!isJsonObject(current) || !(segment in current)) {
      return undefined;
    }
    current = current[segment];
  }

  return current;
}

export function dereferenceSchema(
  rootSchema: JsonSchema,
  schema: unknown,
): JsonSchema | null {
  if (!isJsonObject(schema)) {
    return null;
  }

  let current: JsonSchema | null = schema;
  const seenRefs = new Set<string>();

  while (current && typeof current.$ref === "string") {
    const ref = current.$ref;
    if (seenRefs.has(ref)) {
      return null;
    }

    seenRefs.add(ref);
    const resolved = resolveSchemaPointer(rootSchema, ref);
    current = isJsonObject(resolved) ? resolved : null;
  }

  return current;
}

export function getSchemaAtPointer(
  schemaDocument: unknown,
  pointer: string,
): JsonSchema | null {
  if (!isJsonObject(schemaDocument)) {
    return null;
  }

  return dereferenceSchema(
    schemaDocument,
    resolveSchemaPointer(schemaDocument, pointer),
  );
}

export function getStringEnum(
  schemaDocument: unknown,
  pointer: string,
): string[] {
  const schema = getSchemaAtPointer(schemaDocument, pointer);
  if (!schema || !Array.isArray(schema.enum)) {
    return [];
  }

  return schema.enum.filter(
    (value): value is string => typeof value === "string",
  );
}

export function requireStringEnum(
  schemaDocument: unknown,
  pointer: string,
): string[] {
  const values = getStringEnum(schemaDocument, pointer);
  if (values.length === 0) {
    throw new Error(`Schema is missing a string enum at ${pointer}.`);
  }

  return values;
}

export function getSchemaProperties(
  schemaDocument: unknown,
  pointer: string,
): JsonObject | null {
  const schema = getSchemaAtPointer(schemaDocument, pointer);
  return schema && isJsonObject(schema.properties) ? schema.properties : null;
}

export function getSchemaPattern(
  schemaDocument: unknown,
  pointer: string,
): string | null {
  const schema = getSchemaAtPointer(schemaDocument, pointer);
  return schema && typeof schema.pattern === "string" ? schema.pattern : null;
}

export function getSchemaPropertyOrder(
  schemaDocument: unknown,
  pointer: string,
): string[] {
  return Object.keys(getSchemaProperties(schemaDocument, pointer) ?? {});
}
