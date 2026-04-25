import { expect, test } from "bun:test";

import { validateSchema } from "../src/schema-validation";

test("the consolidated rules document matches the configured schema", () => {
  const result = validateSchema();

  if (!result.valid) {
    throw new Error(
      [
        "The consolidated rules document does not match the schema:",
        ...result.humanReadableErrors.map((error) => `- ${error}`),
      ].join("\n"),
    );
  }

  expect(result.valid).toBe(true);
});
