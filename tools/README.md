# Tools

This directory contains the Bun and TypeScript tooling for the FedRAMP
consolidated rules repository.

The tooling now follows a simpler shape:

- `bun run test` checks the dataset and the tooling behavior
- `bun run fix` applies the fixable normalizations
- `bun run summary` regenerates derived output files

All shared implementation lives under
[tools/src](/Users/pwx/github/pete-gov/rules/tools/src), and the only primary
TypeScript entrypoints at the top of `tools` are
[fix.ts](/Users/pwx/github/pete-gov/rules/tools/fix.ts:1) and
[summary.ts](/Users/pwx/github/pete-gov/rules/tools/summary.ts:1).

## Setup

From [tools](/Users/pwx/github/pete-gov/rules/tools):

```bash
bun install
```

Install the repo Git hooks:

```bash
bun run hooks:install
```

This configures
[`.githooks/pre-commit`](/Users/pwx/github/pete-gov/rules/.githooks/pre-commit:1)
to run `bun test` from `tools`.

## Configuration

All commands read the canonical file locations from
[fedramp-rules.config.json](/Users/pwx/github/pete-gov/rules/tools/fedramp-rules.config.json:1).

That config points to:

- the consolidated rules JSON file
- the consolidated rules schema file

Because every command uses the same config, there is one consistent source of
truth for checking, fixing, and summary generation.

## Core Workflow

Most day-to-day work should use these three commands:

### `bun run test`

Runs the Bun test suite in
[tools/tests](/Users/pwx/github/pete-gov/rules/tools/tests).

This is the main repo verification command. It covers:

- schema correctness
- ID alignment
- primary keyword correctness
- term title casing and term synchronization
- schema-driven property order
- auto-fix behavior
- summary rendering behavior

Use this before and after editing the rules, schema, or tooling.

### `bun run fix`

Runs the combined fixer in
[fix.ts](/Users/pwx/github/pete-gov/rules/tools/fix.ts:1).

By default it checks the current rules file for the fixable categories and then
applies only the fixes that are needed:

- term title casing and `terms` synchronization
- ID alignment
- property ordering

Useful variants:

```bash
bun run fix -- -comment
bun run fix -- --date 2026-04-19
```

`-comment` adds the standard term-sync history comment when term updates are
written. `--date` overrides the date used for fix metadata.

### `bun run summary`

Runs the combined summary runner in
[summary.ts](/Users/pwx/github/pete-gov/rules/tools/summary.ts:1).

Today this regenerates:

- [RULES.md](/Users/pwx/github/pete-gov/rules/RULES.md:1)

through the current `rules` summary scope.

## Common Developer Flow

1. Edit the rules JSON, schema, or tooling.
2. Run `bun run test`.
3. If the failure is fixable, run `bun run fix`.
4. Run `bun run test` again.
5. If your change affects generated output, run `bun run summary`.

## Focused Commands

The top-level commands are the normal workflow, but there are a few targeted
aliases when you want to narrow the scope.

### Focused Tests

- `bun run test:schema`
  Runs only the schema test file.
- `bun run test:ids`
  Runs only the ID-alignment test file.
- `bun run test:keywords`
  Runs only the primary-keyword test file.
- `bun run test:terms`
  Runs only the term-related test file.
- `bun run test:order`
  Runs only the property-order test file.

These are all thin aliases around Bun test files. They do not rely on separate
validation entrypoint scripts.

### Focused Fixes

- `bun run fix:terms`
  Alias for `bun run fix -- --scope terms`
- `bun run fix:ids`
  Alias for `bun run fix -- --scope ids`
- `bun run fix:order`
  Alias for `bun run fix -- --scope order`

Useful variants:

```bash
bun run fix:terms -- -comment
bun run fix:ids -- --report ./id-report.json
bun run fix:ids -- --output ./fedramp-consolidated-rules.fixed.json
bun run fix:order -- --output ./fedramp-consolidated-rules.ordered.json
```

### Focused Summaries

- `bun run summary:rules`
  Alias for `bun run summary -- --scope rules`

## File Structure

### Primary Entrypoints

- [fix.ts](/Users/pwx/github/pete-gov/rules/tools/fix.ts:1)
  Single CLI entrypoint for all fix flows.
- [summary.ts](/Users/pwx/github/pete-gov/rules/tools/summary.ts:1)
  Single CLI entrypoint for all summary flows.

### Shared Implementation

- [src/config.ts](/Users/pwx/github/pete-gov/rules/tools/src/config.ts:1)
  Resolves repository paths and shared config.
- [src/rules.ts](/Users/pwx/github/pete-gov/rules/tools/src/rules.ts:1)
  Loads, clones, and writes the configured rules and schema documents.
- [src/fix.ts](/Users/pwx/github/pete-gov/rules/tools/src/fix.ts:1)
  Shared fix planning and fix application logic.
- [src/schema-validation.ts](/Users/pwx/github/pete-gov/rules/tools/src/schema-validation.ts:1)
  Schema test logic.
- [src/id-alignment.ts](/Users/pwx/github/pete-gov/rules/tools/src/id-alignment.ts:1)
  ID-alignment detection and rewrite logic.
- [src/keywords.ts](/Users/pwx/github/pete-gov/rules/tools/src/keywords.ts:1)
  Primary-keyword detection logic.
- [src/terms.ts](/Users/pwx/github/pete-gov/rules/tools/src/terms.ts:1)
  Term extraction, casing, and synchronization logic.
- [src/property-order.ts](/Users/pwx/github/pete-gov/rules/tools/src/property-order.ts:1)
  Schema-driven property-order logic.
- [src/summary.ts](/Users/pwx/github/pete-gov/rules/tools/src/summary.ts:1)
  Summary scope registry and orchestration.
- [src/summary-rules.ts](/Users/pwx/github/pete-gov/rules/tools/src/summary-rules.ts:1)
  `RULES.md` generation logic.
- [src/traversal.ts](/Users/pwx/github/pete-gov/rules/tools/src/traversal.ts:1)
  Shared FRD, FRR, and KSI traversal helpers.
- [src/types.ts](/Users/pwx/github/pete-gov/rules/tools/src/types.ts:1)
  Shared tooling types.
- [src/cli.ts](/Users/pwx/github/pete-gov/rules/tools/src/cli.ts:1)
  Small CLI helpers for flags, colors, and JSON output.

### Tests and Package Surface

- [tests](/Users/pwx/github/pete-gov/rules/tools/tests)
  Bun tests for both the configured dataset and the tooling behavior.
- [package.json](/Users/pwx/github/pete-gov/rules/tools/package.json:1)
  Bun command surface for testing, fixing, summaries, and hook setup.
- [fedramp-rules.config.json](/Users/pwx/github/pete-gov/rules/tools/fedramp-rules.config.json:1)
  Shared file-location config used by all commands.
