import { readFileSync, writeFileSync } from "node:fs";

import { getResolvedPaths } from "./config";
import type { RulesDocument } from "./types";

export function loadRulesDocument(): RulesDocument {
  const { rulesPath } = getResolvedPaths();
  return JSON.parse(readFileSync(rulesPath, "utf-8")) as RulesDocument;
}

export function loadSchemaDocument(): unknown {
  const { schemaPath } = getResolvedPaths();
  return JSON.parse(readFileSync(schemaPath, "utf-8")) as unknown;
}

export function writeRulesDocument(document: RulesDocument): void {
  const { rulesPath } = getResolvedPaths();
  writeFileSync(rulesPath, `${JSON.stringify(document, null, 2)}\n`, "utf-8");
}

export function cloneDocument<T>(value: T): T {
  return structuredClone(value);
}
