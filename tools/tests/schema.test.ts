import { expect, test } from "bun:test";

import { validateSchema } from "../src/schema-validation";

test("the consolidated rules document matches the configured schema", () => {
  const result = validateSchema();
  expect(result.errors).toEqual([]);
  expect(result.valid).toBe(true);
});
