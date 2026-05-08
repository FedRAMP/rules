import { readFile } from "node:fs/promises";
import { relative } from "node:path";

import { test } from "bun:test";
import { check } from "prettier";

import { getRepoRoot, getResolvedPaths } from "../src/config";

const { rulesPath, schemaPath } = getResolvedPaths();

const formattedJsonFiles = [rulesPath, schemaPath];

for (const filePath of formattedJsonFiles) {
  const repoRelativePath = relative(getRepoRoot(), filePath);

  test(`${repoRelativePath} is formatted with Prettier`, async () => {
    const source = await readFile(filePath, "utf-8");
    const isFormatted = await check(source, { filepath: filePath });

    if (!isFormatted) {
      throw new Error(
        `${repoRelativePath} is not formatted with Prettier. Run: bun run prettier --write ../${repoRelativePath}`,
      );
    }
  });
}
