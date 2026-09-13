# FedRAMP Rules Maintenance Tools

This directory contains internal Bun and TypeScript tooling for FedRAMP
developers maintaining the rules dataset, schema, and supporting tools. Most
users consuming the information should use the [root README](../README.md)
and can ignore this directory.

The [rules JSON](../fedramp-consolidated-rules.json) defines the content;
the [schema](../schemas/fedramp-consolidated-rules.schema.json) defines its
shape. Tooling supports those files. **Maintenance agents must read
[AGENTS-TOOLS.md](AGENTS-TOOLS.md)** for edit guardrails, testing guidance, and
changelog instructions.

## Setup

Run the commands in this guide from `tools/`. Use Bun 1.3.14 to match the
current [CI workflow](../.github/workflows/check.yml).

```bash
bun install --frozen-lockfile
```

Installation writes local dependencies and may require network access. The
current check suite uses local files and does not make live rule-schema URL
requests once dependencies are installed.

## Configuration And Implementation

[fedramp-rules.config.json](fedramp-rules.config.json) centralizes the canonical
paths, resolved relative to that configuration file:

| Setting      | Value                                               |
| ------------ | --------------------------------------------------- |
| `rulesFile`  | `../fedramp-consolidated-rules.json`                |
| `schemaFile` | `../schemas/fedramp-consolidated-rules.schema.json` |

Standard object property order follows each schema object's `properties` order.
[order-config.json](order-config.json) owns repository-specific ordering for
dynamic object keys and array items.

| Area                                       | Implementation                                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Test runner and final reports              | [test.ts](test.ts)                                                                                           |
| Fix CLI and shared planning/application    | [fix.ts](fix.ts), [src/fix.ts](src/fix.ts)                                                                   |
| Spreadsheet export                         | [export-spreadsheet.ts](export-spreadsheet.ts)                                                               |
| Paths and document loading/cloning/writing | [src/config.ts](src/config.ts), [src/rules.ts](src/rules.ts)                                                 |
| FRD, FRR, and KSI traversal                | [src/traversal.ts](src/traversal.ts)                                                                         |
| Schema constraints and validation          | [src/schema-metadata.ts](src/schema-metadata.ts), [src/schema-validation.ts](src/schema-validation.ts)       |
| Consistency checks and metadata freshness  | [src/consistency.ts](src/consistency.ts), [src/metadata-freshness.ts](src/metadata-freshness.ts)             |
| Property and dynamic ordering              | [src/property-order.ts](src/property-order.ts), [src/order-config.ts](src/order-config.ts)                   |
| IDs, normative force, and terms            | [src/id-alignment.ts](src/id-alignment.ts), [src/keywords.ts](src/keywords.ts), [src/terms.ts](src/terms.ts) |
| Types and CLI helpers                      | [src/types.ts](src/types.ts), [src/cli.ts](src/cli.ts)                                                       |

Command definitions are in [package.json](package.json); tests are in
[tests/](tests/).

## Checks

These commands inspect the project without rewriting the canonical files:

| Command             | Behavior                                                                  |
| ------------------- | ------------------------------------------------------------------------- |
| `bun run check`     | Runs typechecking, then the full test runner if typechecking passes.      |
| `bun run typecheck` | Runs `tsc --noEmit`.                                                      |
| `bun run test`      | Runs all Bun tests through `test.ts`, then prints additional diagnostics. |

Run `bun run check` for changes to rules, schema, tooling, or tests. Coverage
includes schema validation, formatting, ID/container alignment, subset
applicability, effective dates, normative force, terms, property and array
ordering, artifact applicability, update history, text hygiene, class variants,
controlled vocabulary, cross-references, and fix behavior.

The runner prints human-readable consistency and property-order failure reports.
It also reports advisory warnings for metadata freshness, FRR subset force
ordering, and unused subsets; those warnings alone do not make the command fail.

Use focused aliases while working:

| Command                          | Focus                                                |
| -------------------------------- | ---------------------------------------------------- |
| `bun run test:schema`            | Dataset/schema validation and schema contract cases. |
| `bun run test:schema-validation` | Schema error messages and locations.                 |
| `bun run test:formatting`        | Prettier formatting of both canonical JSON files.    |
| `bun run test:ids`               | Requirement ID alignment.                            |
| `bun run test:effective-dates`   | Certification-specific timing rules.                 |
| `bun run test:force`             | Statement/force consistency.                         |
| `bun run test:terms`             | Definition casing and term synchronization.          |
| `bun run test:order`             | Schema-driven and configured ordering.               |
| `bun run test:consistency`       | Cross-entry consistency and related reporting.       |
| `bun run test:fix`               | Fix planning and application.                        |

Focused aliases invoke Bun directly and do not include the full runner's final
reports. Artifact-applicability and metadata-warning tests are included in the
full suite and can also be run directly with `bun test` and their test paths.

## Fixes

**Fix commands write to the configured rules JSON by default.** They also run
Prettier on that file even when no normalization is needed. There is no CLI
dry-run mode. Maintenance agents must follow the rules-edit guardrail in
[AGENTS-TOOLS.md](AGENTS-TOOLS.md) before any direct or indirect rules edit.

`bun run fix` selects the `auto` scope, which applies the supported
normalizations. Focused aliases select individual scopes:

| Command                      | Normalization                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------- |
| `bun run fix:terms`          | Definition title casing and `terms` synchronization.                            |
| `bun run fix:ids`            | Renames requirement keys to match their parent subsets; collisions are skipped. |
| `bun run fix:order`          | Schema property order and configured dynamic key/array order.                   |
| `bun run fix:related`        | Adds missing related-rule references found in text.                             |
| `bun run fix:display-names`  | Repairs inline rule IDs and their parenthesized display names.                  |
| `bun run fix:subset-affects` | Aligns FRR subset applicability `affects` with its requirements.                |

Pass flags after `--`:

| Flag                      | Behavior                                                                                                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--scope <scope>`         | Selects `auto`, `terms`, `ids`, `order`, `related`, `display-names`, or `subset-affects`; aliases set this automatically.                                              |
| `--output <path>`         | Writes changed rules to that path and skips in-place formatting. Use a separate path to leave the source untouched. If no fixes are needed, no output file is created. |
| `--report <path>`         | Writes the ID fix report when ID fixes are needed; supported only with the `ids` scope. It does not prevent rules edits.                                               |
| `-comment` or `--comment` | Adds the standard term-sync history comment when term synchronization changes are written; supported only with `auto` or `terms`.                                      |
| `--date <YYYY-MM-DD>`     | Overrides dates used in generated fix metadata; defaults to the source dataset's `info.last_updated`, not today's date.                                                |

For example, generate a separate candidate and an ID report:

```bash
bun run fix:ids -- --output ./fedramp-consolidated-rules.fixed.json --report ./id-report.json
```

For an authorized in-place term update with history comments:

```bash
bun run fix:terms -- -comment --date 2026-09-13
```

Review the output and diff. Fixers normalize supported issues; they do not
resolve every consistency finding or decide substantive rule changes. After
applying authorized changes to the canonical files, run `bun run check` again.
Checks still read the canonical paths in the configuration, even when a fixer
has written a separate candidate.

ID fixes also record entry history and update dataset version/date metadata.
They do not rewrite references to renamed IDs; inspect references when reviewing
an ID change.

## Exports

`bun run export` writes `../fedramp-consolidated-rules.xlsx` by default. To choose
another destination:

```bash
bun run export -- --output ./fedramp-consolidated-rules.xlsx
```

The workbook contains `FRD Definitions`, `FRR Requirements`, and `KSI Indicators`
sheets. Export reads the dataset and writes the spreadsheet without changing the
rules or schema. Output paths are relative to the current working directory;
an existing destination file is overwritten. The spreadsheet is a flattened
view; use the JSON for complete nested information.

## Git Hooks And CI

Install the repository hook configuration with:

```bash
bun run hooks:install
```

This sets `core.hooksPath` to `.githooks`. On every commit, the
[pre-commit hook](../.githooks/pre-commit):

1. Runs Prettier in write mode on both the rules JSON and schema.
2. Stages both files with `git add`.
3. Runs `bun check` from `tools/`.

These writes and staging changes occur even for documentation or tooling
commits. The hook can include existing edits to the canonical files in the
commit, and a failed check does not undo its earlier formatting or staging.
Inspect the working tree and staged diff before committing. The hook's
`bunx prettier` invocation may need network access if Prettier is not available
locally; this is separate from the check suite.

The [CI workflow](../.github/workflows/check.yml) runs on pushes with Bun 1.3.14,
installs dependencies using `bun install --frozen-lockfile`, and runs
`bun run check` from `tools/`.

## Troubleshooting

- **Stale URL-test alias:** `package.json` still defines `test:schema-urls`,
  but its target `tests/schema-urls.test.ts` is absent. It is not a supported
  focused check, and the full suite does not test live schema URL reachability.
- **Bun version mismatch:** [.tool-versions](.tool-versions) currently specifies
  Bun 1.3.1, while CI uses 1.3.14. Use the CI version when reproducing checks.
- **Warnings or data failures during tooling work:** Report the affected IDs
  and paths. Keep existing rules issues separate from tooling regressions;
  do not edit the dataset merely to clear a warning or make a new test pass.
- **Skipped ID collisions or remaining fix issues:** Review the report and
  source entries before deciding on a manual correction. A fixer is not
  authorization to rename or merge rules.
- **Documentation-only changes:** Check links, command references, and
  `git diff --check`. Do not use fix commands to validate documentation.
