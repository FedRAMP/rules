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
unit tests use local files and mocked HTTP responses. `bun run check` and
`bun run test` also check live reference URLs; unavailable network access produces warnings.
They do not fetch rule-schema URLs.

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
| Paths and document loading/cloning/writing | [src/config.ts](src/config.ts), [src/rules.ts](src/rules.ts)                                                 |
| FRR/KSI class resolution | [src/class-content.ts](src/class-content.ts) |
| CTL source agreement | [src/control-metadata.ts](src/control-metadata.ts) |
| FRD, FRR, and KSI traversal                | [src/traversal.ts](src/traversal.ts)                                                                         |
| Schema constraints and validation          | [src/schema-metadata.ts](src/schema-metadata.ts), [src/schema-validation.ts](src/schema-validation.ts)       |
| Consistency checks and metadata freshness  | [src/consistency.ts](src/consistency.ts), [src/metadata-freshness.ts](src/metadata-freshness.ts)             |
| Property and dynamic ordering              | [src/property-order.ts](src/property-order.ts), [src/order-config.ts](src/order-config.ts)                   |
| IDs, normative force, and terms            | [src/id-alignment.ts](src/id-alignment.ts), [src/keywords.ts](src/keywords.ts), [src/terms.ts](src/terms.ts) |
| Reference URL reachability                 | [src/reference-urls.ts](src/reference-urls.ts)                                                               |
| Types and CLI helpers                      | [src/types.ts](src/types.ts), [src/cli.ts](src/cli.ts)                                                       |

Command definitions are in [package.json](package.json); tests are in
[tests/](tests/).

## Class Content

FRR and KSI share optional class content overrides in `varies_by_class.a` through
`.d`. Each supplied field replaces the whole inherited value; nested objects
are not merged and arrays are not concatenated. Missing fields inherit common
content. Class-only statements and forces remain valid when every applicable
class has effective content. KSI requires effective statements and forces for
A–D and does not support `applicable`. FRD has no structured class overrides. CTL uses
the separate contract below.

The shared override fields are `statement`, `following_information`,
`following_information_bullets`, `force`, `notes`, `schema`, `note`, `artifacts`,
`timeframe_type`, `timeframe_num`, `timeframe_num_min`, `timeframe_num_max`,
`rev5_controls_list`, `pain_timeframes`, and `effective_date`. These are also
allowed as top-level defaults. Names, identity, and history are not overridden.
FRR additionally permits `applicable` in each class entry. True includes that
class, false excludes it, and omission inherits subset membership. Omission
must not be converted to false through a truthiness check; null and empty
strings are invalid. Class `force` and class membership are separate concepts.

Use [src/class-content.ts](src/class-content.ts) for FRR/KSI field resolution
and FRR class membership. It removes `applicable` from resolved content.
Do not use this resolver for CTL guidance or parameters. See the
[root README](../README.md#class-specific-metadata) for consumer examples.

Legacy `force_by_class`, rule-level `applicability`, and class-level `applies`
or `applicability.add`/`applicability.exclude` are rejected. Subset applicability
is unchanged. Historical comments retain the terminology used when written.

The JSON Schema validates stored fields and KSI statement/force coverage.
`validateSchema` also resolves FRR subset/class applicability and validates
required effective statements, forces, and timeframe dependencies after
inheritance. A class can override a timeframe number while inheriting its type.
Raw JSON Schema validation alone does not perform this cross-entry resolution.

Term extraction retains its existing scope: top-level statements and supporting
text, plus class-specific statements. It does not newly index class-specific
supporting text. Shared supporting text remains in its existing variants when
lifting it would change derived term lists.

### Rev5 Control Metadata

Every CTL entry has `varies_by_class.b/c/d.force` (`MUST` or `MAY`) and
`assess_yearly_by_class.b/c/d` (booleans). The force is `MUST` exactly when the
control appears in `FRC-CSF-BSL.varies_by_class.<class>.rev5_controls_list`;
otherwise it is `MAY`. The full source rule is
`FRR.FRC.data.rev5.CSF.FRC-CSF-BSL`. The annual flag is true exactly when the
control appears in
`FRR.IVV.data.rev5.CSF.IVV-CSF-AIA.varies_by_class.<class>.rev5_controls_list`.
False means absence from that list, not exemption from other assessments.
All three class forces and annual booleans are mandatory; the annual object
is outside `varies_by_class`, and CTL has no top-level force or `applicable`.
Control enhancement IDs are normalized from source notation such as `AC-02 (01)` to CTL keys such as `AC-02-01`.

`bun run check` includes `tests/control-metadata.test.ts` and a read-only
consistency check against both source rules. Missing controls, missing source
lists, missing metadata, and incorrect forces or annual flags fail validation.
The final output includes class totals and the mismatch count; failures name
the control field and source rule. Metadata-only entries cover source-listed
controls without inventing guidance, parameters, or history. Common guidance
and parameters remain valid alongside class metadata. The checker is
[src/control-metadata.ts](src/control-metadata.ts); it is registered with
[src/consistency.ts](src/consistency.ts). The final runner summary includes
control count, issue count, MUST/MAY totals, and annual-assessment totals by
class. Run the focused suite with `bun test tests/control-metadata.test.ts`;
use `bun run check` for integrated final diagnostics. Checks do not rewrite
sources or derived metadata.

## Reports

Reports read the configured rules and schema, validate the dataset, and print
plain text without modifying files. Each report includes the dataset version
and update date. Run these commands from `tools/`:

```sh
bun report profile 20x a
bun report profile rev5 c
bun report overall
bun report --help
bun report profile --help
```

Type and class arguments are case-insensitive and use the local schema's
allowed values. Missing/extra arguments, unknown values, invalid schema data,
and report errors exit nonzero with diagnostics on stderr.

### Profile

The profile report lists each matching FRR rule as `ID (Name)`, ordered by
force: MUST, MUST NOT, SHOULD, SHOULD NOT, MAY, then unspecified. Rules retain
dataset order within each force group, with a force header above each nonempty
group. It considers `data.all` and the requested framework's bucket. Common
subset metadata applies to both; framework-specific subset metadata applies
to rules in that framework's bucket. If both declare a subset, their values
are combined. `varies_by_class.<class>.applicable: true` includes a class;
`applicable: false` excludes it. Omit `applicable` to inherit subset applicability;
null and empty strings are invalid. Types, paths,
and actors cannot be adjusted per rule. Both type and class must match.
Empty lists match nothing, and class additions do not cross framework data buckets.

Profiles include only rules whose own `affects` array contains `Providers`,
including rules that also affect other parties. `Everyone` alone does not
match this filter. Profiles include all certification paths without filtering
status or effective dates. They describe type/class matches, not a determination of
every obligation currently applicable to a particular offering.

Force counts use the primary `force` field, selecting the requested class
override where present and otherwise inheriting the top-level force. A matching
rule without an effective force is counted as `unspecified` by the collector;
the report runner rejects missing required effective content during validation.
Secondary forces
within statement text are not separately counted. Missing subset declarations
or duplicate rule IDs cause an error.

Each force header includes its rule count, for example `MUST (41):`, followed
by a blank line and the rules. Empty groups are omitted. There are no trailing
party or force summaries. A profile with no matches prints `0 rules`.

### Overall

| Total | Counted entries |
| --- | --- |
| Rulesets | All FRR process entries, including empty rulesets |
| Subsets | Nonempty subset buckets in each ruleset/data scope; repeated subset keys in different scopes count separately |
| Rules | FRR requirement entries; class variants count as one rule |
| KSIs | Indicator entries across KSI themes |
| Controls | Control entries across CTL families; absent CTL counts as zero |

The CLI is [report.ts](report.ts); the registry and individual report modules
are in [src/reports/](src/reports/). See [AGENTS-TOOLS.md](AGENTS-TOOLS.md#reporting-framework)
for extension guidance.

## Checks

These commands inspect the project without rewriting the canonical files:

| Command             | Behavior                                                                       |
| ------------------- | ------------------------------------------------------------------------------ |
| `bun run check`     | Runs typechecking, then the full test runner if typechecking passes.           |
| `bun run typecheck` | Runs `tsc --noEmit`.                                                           |
| `bun run test`      | Runs all Bun tests, including live reference URLs, then prints final diagnostics. |

Run `bun run check` for changes to rules, schema, tooling, or tests. Coverage
includes schema validation, formatting, ID/container alignment, subset
applicability, effective dates, normative force, terms, property and array
ordering, artifact applicability, update history, text hygiene, class variants,
controlled vocabulary, cross-references, CTL/source agreement, and fix behavior.

The runner orders suites approximately fastest to slowest, with live reference
URL checks last, and separates Bun's final duration summary with a blank line.
New test files are discovered automatically. This ordering and spacing apply to
`bun run test` and `bun run check`; direct `bun test` uses Bun's default output.

The runner prints human-readable schema, consistency, and property-order failure
reports after the test totals, including full paths for schema errors.
A final Rev5 control summary reports class force and annual-assessment totals
and the mismatch count. CTL/source mismatches fail the command.
It also reports advisory warnings for metadata freshness, FRR subset force
ordering, and unused subsets; those warnings alone do not make the command fail.

Live reference URL checks run in `tests/reference-url-reachability.test.ts`,
reporting advisory warnings before the test totals. Warnings include
the full JSON path, original URL, and HTTP status or connection error. The check covers
`reference_url` and legacy `referenceurl` fields throughout the dataset. It
follows redirects, tries GET when HEAD returns an unsuccessful status, and
checks each distinct URL once (ignoring fragments). Four requests run at a time,
with a 10-second deadline per URL. Fragment anchors are not validated.

The test skips live requests for one hour after a completed run, including runs
with warnings. It stores the completion time and a hash of the sorted, distinct
URL strings in `node_modules/.cache/reference-url-check`. Changed URLs trigger
an immediate check; missing or unreadable cache files also trigger a check.
Fresh CI installations have no cache. Run `bun run test:reference-urls` to check
immediately without using the cache, or delete the cache file to reset it.

Non-successful responses, including access-denied/rate-limit responses, and
network failures produce warnings without making the command fail. Invalid or
unsupported reference URLs are also advisory. This applies to the full test
suite and the standalone `test:reference-urls` command. Access-denied and connection failures
are reported as unverified reachability, not proof that the URL is broken.
Notification targets, schema URLs, and URLs embedded in prose are outside this
check's scope. `bun test` also includes the live check; select focused unit-test
files (for example, `bun test tests/reference-urls.test.ts`) to avoid network requests.

Use focused aliases while working:

| Command                          | Focus                                                       |
| -------------------------------- | ----------------------------------------------------------- |
| `bun run test:schema`            | Dataset/schema validation and schema contract cases.        |
| `bun run test:schema-validation` | Schema error messages and locations.                        |
| `bun run test:formatting`        | Prettier formatting of both canonical JSON files.           |
| `bun run test:ids`               | Requirement ID alignment.                                   |
| `bun run test:effective-dates`   | Certification-specific timing rules.                        |
| `bun run test:force`             | Statement/force consistency.                                |
| `bun run test:terms`             | Definition casing and term synchronization.                 |
| `bun run test:order`             | Schema-driven and configured ordering.                      |
| `bun run test:consistency`       | Cross-entry consistency and related reporting.              |
| `bun run test:reference-urls`    | Live reference URL checks with a standalone warning report. |
| `bun run test:fix`               | Fix planning and application.                               |

Focused unit-test aliases invoke Bun directly and do not include the full
runner's final reports. `test:reference-urls` runs the live checker directly.
Artifact-applicability and metadata-warning tests are included in the full suite and can also be run directly with `bun test` and their test paths.

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

Term synchronization excludes definitions with `ignore_in_terms: true`,
including their aliases, from FRR and KSI `terms` arrays. The term check reports
existing entries for these definitions, and the fixer removes them. An absent
or `false` flag keeps normal matching behavior.

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

When the ID fixer renames one or more keys, it records each rename in entry history
and sets `info.last_updated` to the entry date. The entry date defaults to the existing
`info.last_updated` and can be overridden with `--date`.
The fixer does not rewrite references to renamed IDs; inspect references when reviewing
an ID change.

Only a maintainer increments `info.version`. The check warns when the working
rules have changed since the last committed rules snapshot without a higher minor
version. It also checks the latest committed rules update when the working copy
matches it. Formatting and changes to `info.last_updated` alone do not require
a version bump.

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
