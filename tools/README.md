# FedRAMP Rules Tooling

This directory contains the Bun and TypeScript tooling used to maintain the
FedRAMP Consolidated Rules dataset.

The tools validate, normalize, test, and export the canonical files:

- [../fedramp-consolidated-rules.json](../fedramp-consolidated-rules.json)
- [../schemas/fedramp-consolidated-rules.schema.json](../schemas/fedramp-consolidated-rules.schema.json)

The tooling is support infrastructure. It does not define the rules; the JSON
dataset and schema do.

## Setup

From this directory:

```bash
bun install
```

Install the repository Git hooks:

```bash
bun run hooks:install
```

The hook runs `bun check` before commits.

## Configuration

All commands read canonical file locations from
[fedramp-rules.config.json](fedramp-rules.config.json).

Current configuration:

- rules file: `../fedramp-consolidated-rules.json`
- schema file: `../schemas/fedramp-consolidated-rules.schema.json`

Keeping these paths centralized ensures that tests and fixes operate on the
same dataset.

## Primary Commands

### `bun run check`

Runs the full local verification suite:

1. `bun run typecheck`
2. `bun run test`

Use this before committing changes to the rules JSON, schema, tests, or
tooling.

### `bun run test`

Runs the Bun test suite through [test.ts](test.ts). Coverage includes:

- schema validity
- JSON formatting
- ID alignment
- FRD, FRR, and KSI container alignment
- FRR subset declaration consistency
- force consistency
- term casing and synchronization
- schema-driven property ordering
- alphabetical FRR and KSI primary object ordering
- update history checks
- text hygiene
- class-variant sanity checks
- FRR subset force ordering warnings
- FRR unused subset warnings
- controlled vocabulary consistency
- internal cross-reference integrity
- fix planning and application behavior

When consistency validation fails, the runner prints a human-readable summary
after the regular Bun output.

### `bun run typecheck`

Runs `tsc --noEmit` against the TypeScript project.

### `bun run fix`

Runs [fix.ts](fix.ts), which plans and applies fixable normalizations:

- term title casing and `terms` synchronization
- ID alignment
- inline rule display names
- related rule references
- schema-driven property ordering and alphabetical FRR/KSI primary object ordering

Useful variants:

```bash
bun run fix -- -comment
bun run fix -- --date 2026-05-04
```

`-comment` adds the standard term-sync update comment when term changes are
written. `--date` overrides the date used in generated fix metadata.

## Common Workflow

1. Edit the rules JSON, schema, or tooling.
2. Run `bun run check`.
3. Run `bun run fix` if the check reports fixable normalization issues.
4. Run `bun run check` again.

## Focused Commands

Focused test aliases:

- `bun run test:fix`
- `bun run test:formatting`
- `bun run test:schema`
- `bun run test:schema-validation`
- `bun run test:ids`
- `bun run test:force`
- `bun run test:terms`
- `bun run test:order`
- `bun run test:consistency`

Focused fix aliases:

- `bun run fix:terms`
- `bun run fix:ids`
- `bun run fix:order`
- `bun run fix:related`
- `bun run fix:display-names`

Examples:

```bash
bun run fix:terms -- -comment
bun run fix:ids -- --report ./id-report.json
bun run fix:ids -- --output ./fedramp-consolidated-rules.fixed.json
bun run fix:order -- --output ./fedramp-consolidated-rules.ordered.json
bun run fix:related
bun run fix:display-names
```

## File Structure

Primary entrypoints:

- [test.ts](test.ts)
  Test runner used by `bun run test`.
- [fix.ts](fix.ts)
  CLI entrypoint for all fix flows.

Shared implementation:

- [src/config.ts](src/config.ts)
  Resolves repository paths and shared configuration.
- [src/rules.ts](src/rules.ts)
  Loads, clones, and writes configured rules and schema documents.
- [src/fix.ts](src/fix.ts)
  Shared fix planning and application logic.
- [src/consistency.ts](src/consistency.ts)
  Read-only consistency validation checks and reporting.
- [src/schema-validation.ts](src/schema-validation.ts)
  Schema validation logic and error formatting.
- [src/id-alignment.ts](src/id-alignment.ts)
  ID alignment detection and rewrite logic.
- [src/keywords.ts](src/keywords.ts)
  Force consistency logic.
- [src/terms.ts](src/terms.ts)
  Term extraction, casing, and synchronization logic.
- [src/property-order.ts](src/property-order.ts)
  Schema-driven property-order and FRR/KSI primary object ordering logic.
- [src/traversal.ts](src/traversal.ts)
  Shared FRD, FRR, and KSI traversal helpers.
- [src/types.ts](src/types.ts)
  Shared TypeScript types.
- [src/cli.ts](src/cli.ts)
  CLI helpers for flags, colors, and JSON output.

Tests live in [tests](tests). Command definitions live in
[package.json](package.json).
