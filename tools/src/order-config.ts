import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type OrderDirection = "ascending" | "descending";

interface OrderRuleBase {
  paths: string[];
}

export interface KeyOrderRule extends OrderRuleBase {
  by: "key";
  direction: OrderDirection;
}

export interface PropertyOrderRule extends OrderRuleBase {
  by: "property";
  property: string;
  direction: OrderDirection;
}

export interface ExplicitOrderRule extends OrderRuleBase {
  by: "explicit";
  keys: string[];
}

export type OrderRule = KeyOrderRule | PropertyOrderRule | ExplicitOrderRule;

export interface OrderConfig {
  objectKeys: OrderRule[];
  arrayItems: OrderRule[];
}

const SOURCE_DIR = dirname(fileURLToPath(import.meta.url));
const ORDER_CONFIG_PATH = resolve(dirname(SOURCE_DIR), "order-config.json");

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseOrderRule(
  value: unknown,
  collection: keyof OrderConfig,
  index: number,
): OrderRule {
  if (!isRecord(value)) {
    throw new Error(`Order config ${collection}[${index}] must be an object.`);
  }

  const { path, paths: configuredPaths, by, property, keys, direction } = value;
  const paths =
    typeof path === "string"
      ? [path]
      : Array.isArray(configuredPaths)
        ? configuredPaths
        : [];
  if (
    paths.length === 0 ||
    paths.some(
      (configuredPath) =>
        typeof configuredPath !== "string" || configuredPath.length === 0,
    )
  ) {
    throw new Error(
      `Order config ${collection}[${index}] must define a non-empty path string or paths array.`,
    );
  }
  if (by !== "key" && by !== "property" && by !== "explicit") {
    throw new Error(
      `Order config ${collection}[${index}].by must be "key", "property", or "explicit".`,
    );
  }

  if (by === "explicit") {
    if (
      !Array.isArray(keys) ||
      keys.some((key) => typeof key !== "string") ||
      new Set(keys).size !== keys.length
    ) {
      throw new Error(
        `Order config ${collection}[${index}].keys must be an array of unique strings.`,
      );
    }

    return {
      paths: paths as string[],
      by,
      keys: keys as string[],
    };
  }

  if (by === "property" && typeof property !== "string") {
    throw new Error(
      `Order config ${collection}[${index}].property is required for property ordering.`,
    );
  }
  if (direction !== "ascending" && direction !== "descending") {
    throw new Error(
      `Order config ${collection}[${index}].direction must be "ascending" or "descending".`,
    );
  }

  if (by === "property") {
    return {
      paths: paths as string[],
      by,
      property: property as string,
      direction,
    };
  }

  return {
    paths: paths as string[],
    by,
    direction,
  };
}

function parseOrderRules(
  value: unknown,
  collection: keyof OrderConfig,
): OrderRule[] {
  if (!Array.isArray(value)) {
    throw new Error(`Order config ${collection} must be an array.`);
  }

  return value.map((rule, index) => parseOrderRule(rule, collection, index));
}

export function getOrderConfigPath(): string {
  return ORDER_CONFIG_PATH;
}

export function loadOrderConfig(): OrderConfig {
  const config = JSON.parse(
    readFileSync(ORDER_CONFIG_PATH, "utf-8"),
  ) as unknown;
  if (!isRecord(config)) {
    throw new Error("Order config must be an object.");
  }

  return {
    objectKeys: parseOrderRules(config.objectKeys, "objectKeys"),
    arrayItems: parseOrderRules(config.arrayItems, "arrayItems"),
  };
}

function pathMatches(pattern: string, path: string): boolean {
  const patternSegments = pattern === "" ? [] : pattern.split(".");
  const pathSegments = path === "" ? [] : path.split(".");

  function matchesFrom(patternIndex: number, pathIndex: number): boolean {
    if (patternIndex === patternSegments.length) {
      return pathIndex === pathSegments.length;
    }

    const segment = patternSegments[patternIndex];
    if (segment === "**") {
      return (
        matchesFrom(patternIndex + 1, pathIndex) ||
        (pathIndex < pathSegments.length &&
          matchesFrom(patternIndex, pathIndex + 1))
      );
    }

    return (
      pathIndex < pathSegments.length &&
      (segment === "*" || segment === pathSegments[pathIndex]) &&
      matchesFrom(patternIndex + 1, pathIndex + 1)
    );
  }

  return matchesFrom(0, 0);
}

function findOrderRule(rules: OrderRule[], path: string): OrderRule | null {
  return (
    rules.find((rule) =>
      rule.paths.some((pattern) => pathMatches(pattern, path)),
    ) ?? null
  );
}

export function findObjectKeyOrderRule(
  config: OrderConfig,
  path: string,
): OrderRule | null {
  return findOrderRule(config.objectKeys, path);
}

export function findArrayItemOrderRule(
  config: OrderConfig,
  path: string,
): OrderRule | null {
  return findOrderRule(config.arrayItems, path);
}
