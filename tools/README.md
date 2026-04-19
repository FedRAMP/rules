# Tools

This directory contains the TypeScript tooling used to validate and maintain the
FedRAMP consolidated rules dataset.

All commands in this directory load the repository's shared configuration from
[fedramp-rules.config.json](/Users/pwx/github/pete-gov/rules/tools/fedramp-rules.config.json:1),
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

This runs the validation runner in
[tools/validate.ts](/Users/pwx/github/pete-gov/rules/tools/validate.ts:1),
which executes all of the following checks and prints a final success message
when they all pass:

- `bun run test:schema`
  Validates the configured consolidated rules JSON against the configured schema.
- `bun run test:ids`
  Checks that rule IDs nested under `data` blocks align with their parent keys.
- `bun run test:keywords`
  Checks that each `primary_key_word` matches the first normative keyword in the
  associated statement.
- `bun run test:terms`
  Checks that each FRD `term` uses the default title casing and that each
  `terms` array matches the current structured term extraction logic.

### Summary Commands

Summary generators follow the `summary:*` naming pattern so additional summary
scripts can be added over time without colliding with the validation commands.

Run summary generation from `/Users/pwx/github/pete-gov/rules/tools`:

```bash
bun run summary:rules
```

This runs
[tools/summary-rules.ts](/Users/pwx/github/pete-gov/rules/tools/summary-rules.ts:1),
which reads the configured consolidated rules JSON, summarizes each FRR
document, and writes the output to
[RULES.md](/Users/pwx/github/pete-gov/rules/RULES.md:1).

Use this whenever you want to refresh the root summary after editing
`fedramp-consolidated-rules.json`.

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
FRD term title fixes and `terms` array updates back to the configured rules
JSON. By default, this command does not add a new `updated` history comment to
the entries it changes.

If you also want term synchronization changes to add the standard
`"Updated the related terms."` comment to the matching `updated` entry for the
current day, pass `-comment`:

```bash
bun run terms:update -- -comment
```

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
bun run validate-terms.ts
```

Apply term synchronization directly:

```bash
bun run validate-terms.ts --write
```

Apply term synchronization directly and add `updated` history comments:

```bash
bun run validate-terms.ts --write -comment
```

Check primary keyword alignment without modifying the file:

```bash
bun run validate-primary-key-word.ts
```

Validate the configured rules file against the schema directly:

```bash
bun run validate-schema.ts
```

## Project Layout

- [tools/fedramp-rules.config.json](/Users/pwx/github/pete-gov/rules/tools/fedramp-rules.config.json:1)
  Declares the canonical rules JSON file and schema file for all tools.
- [tools/validate.ts](/Users/pwx/github/pete-gov/rules/tools/validate.ts:1)
  Runs the full validation suite and prints a final pass/fail summary.
- [tools/validate-schema.ts](/Users/pwx/github/pete-gov/rules/tools/validate-schema.ts:1)
  Validates the configured consolidated rules JSON against the configured schema.
- [tools/validate-item-ids.ts](/Users/pwx/github/pete-gov/rules/tools/validate-item-ids.ts:1)
  Checks and optionally fixes rule IDs nested under `data` blocks.
- [tools/validate-primary-key-word.ts](/Users/pwx/github/pete-gov/rules/tools/validate-primary-key-word.ts:1)
  Checks that each `primary_key_word` matches the first normative keyword in the
  associated statement.
- [tools/validate-terms.ts](/Users/pwx/github/pete-gov/rules/tools/validate-terms.ts:1)
  Checks FRD term title casing and FRR/KSI term synchronization, and can write
  fixes back to the configured rules JSON.
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
3. If terms need normalization, run `bun run terms:update`.
4. If IDs need normalization, run `bun run ids:fix`.
5. Run `bun run validate` again before committing.
