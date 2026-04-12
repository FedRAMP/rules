import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

import type { RulesRepoConfig } from "./types";

const SOURCE_DIR = dirname(fileURLToPath(import.meta.url));
const TOOLS_DIR = dirname(SOURCE_DIR);
const REPO_ROOT = dirname(TOOLS_DIR);
const CONFIG_PATH = resolve(REPO_ROOT, "fedramp-rules.config.json");

export function getRepoRoot(): string {
  return REPO_ROOT;
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function loadRepoConfig(): RulesRepoConfig {
  return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as RulesRepoConfig;
}

export function resolveFromRepo(relativePath: string): string {
  return resolve(REPO_ROOT, relativePath);
}

export function getResolvedPaths() {
  const config = loadRepoConfig();
  return {
    repoRoot: REPO_ROOT,
    configPath: CONFIG_PATH,
    rulesPath: resolveFromRepo(config.rulesFile),
    schemaPath: resolveFromRepo(config.schemaFile),
  };
}
