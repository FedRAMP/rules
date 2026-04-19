import { spawnSync } from "node:child_process";

import { green } from "./src/cli";

const commands = ["test:schema", "test:ids", "test:keywords", "test:terms", "test:order"];

for (const command of commands) {
  const result = spawnSync("bun", ["run", command], {
    cwd: import.meta.dir,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(green("All tests have passed."));
