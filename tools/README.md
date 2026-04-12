# Tools

This directory contains the TypeScript tooling used to validate and maintain the
FedRAMP consolidated rules dataset.

All commands in this directory load the repository's shared configuration from
[fedramp-rules.config.json](/Users/pwx/github/pete-gov/rules/fedramp-rules.config.json:1),
which defines:

- the canonical consolidated rules JSON file
- the canonical JSON schema file

That means the scripts no longer carry their own hard-coded file locations or
legacy project assumptions.

## Setup

From `/Users/pwx/github/pete-gov/rules/tools`:

```bash
bun install
```

## Commands

Run the complete validation suite:

```bash
bun run validate
```

This runs all of the following checks:

- `bun run test:schema`
  Validates the configured consolidated rules JSON against the configured schema.
- `bun run test:ids`
  Checks that rule IDs nested under `data` blocks align with their parent keys.
- `bun run test:keywords`
  Checks that each `primary_key_word` matches the first normative keyword in the
  associated statement.
- `bun run test:terms`
  Checks that each `terms` array matches the current structured term extraction
  logic.

Run the Bun test suite directly:

```bash
bun test
```

This executes the test files in `tools/tests` and is useful when working on the
 tooling itself.

## Maintenance Commands

Update `terms` arrays in the configured rules file:

```bash
bun run terms:update
```

This applies the same logic used by `bun run test:terms`, but writes the updated
`terms` arrays back to the configured rules JSON.

Fix ID alignment issues in place:

```bash
bun run ids:fix
```

This updates mismatched IDs in the configured rules JSON and preserves rename
history using `fka` or `fkas` metadata in the affected objects.

Check ID alignment without modifying the file:

```bash
bun run validate-item-ids.ts
```

Write an ID-alignment report:

```bash
bun run validate-item-ids.ts --report ./id-report.json
```

Write fixed output to a separate file instead of modifying the configured rules
file:

```bash
bun run validate-item-ids.ts --write --output ./fedramp-consolidated-rules.fixed.json
```

Check term synchronization without modifying the file:

```bash
bun run update-frr-terms.ts
```

Apply term synchronization directly:

```bash
bun run update-frr-terms.ts --write
```

## Project Layout

- [tools/src/config.ts](/Users/pwx/github/pete-gov/rules/tools/src/config.ts:1)
  Loads and resolves the shared repository config.
- [tools/src/rules.ts](/Users/pwx/github/pete-gov/rules/tools/src/rules.ts:1)
  Reads and writes the configured rules and schema documents.
- [tools/src/schema-validation.ts](/Users/pwx/github/pete-gov/rules/tools/src/schema-validation.ts:1)
  Provides schema validation logic.
- [tools/src/id-alignment.ts](/Users/pwx/github/pete-gov/rules/tools/src/id-alignment.ts:1)
  Provides ID validation and fixing logic.
- [tools/src/keywords.ts](/Users/pwx/github/pete-gov/rules/tools/src/keywords.ts:1)
  Provides `primary_key_word` validation logic.
- [tools/src/terms.ts](/Users/pwx/github/pete-gov/rules/tools/src/terms.ts:1)
  Provides term extraction and synchronization logic.
- [tools/tests](/Users/pwx/github/pete-gov/rules/tools/tests)
  Contains the Bun tests for the validation routines.

## Typical Workflow

1. Make changes to `/Users/pwx/github/pete-gov/rules/fedramp-consolidated-rules.json`
   or `/Users/pwx/github/pete-gov/rules/schemas/fedramp-consolidated-rules.schema.json`.
2. Run `bun run validate`.
3. If terms are out of sync, run `bun run terms:update`.
4. If IDs need normalization, run `bun run ids:fix`.
5. Run `bun run validate` again before committing.
