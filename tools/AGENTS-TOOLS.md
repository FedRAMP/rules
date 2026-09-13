# Instructions For Maintenance Agents

This guide is for AI agents supporting FedRAMP developers during maintenance of
the dataset, schema, tooling, tests, documentation, and branch changelogs.
For information analysis, use the root [AGENTS.md](../AGENTS.md); most consumers
can ignore this directory.

Read this guide before maintenance work, including work on files outside
`tools/`. It is explicitly linked from the root guide; do not assume the custom
filename `AGENTS-TOOLS.md` is automatically loaded by your agent environment.
See [README.md](README.md) for setup, command syntax, flags, and troubleshooting.

## Rules JSON Edit Guardrail

Do not modify
[fedramp-consolidated-rules.json](../fedramp-consolidated-rules.json) unless the
user specifically instructs you to edit that file.

If a task appears to require changing
[fedramp-consolidated-rules.json](../fedramp-consolidated-rules.json), stop before
editing it. Propose a concise plan that identifies the specific rule,
definition, indicator, metadata, or structural paths you intend to change, then
wait for the user's explicit confirmation before making those edits.

Analysis, validation, structured reads, and reports may use
[fedramp-consolidated-rules.json](../fedramp-consolidated-rules.json) without
additional permission. The guardrail applies to file modifications.

## Test Creation Guardrail

When the user asks to add or update tests for the tooling, test harness, or
validation behavior, assume the requested test may expose existing rules data
issues, warnings, or intentionally failing cases. That is often the reason the
test is being added.

Do not fix test failures or warnings by editing
[fedramp-consolidated-rules.json](../fedramp-consolidated-rules.json) unless the
user explicitly asks for rule-content changes. If a newly added test reports
errors or warnings against the current rules file, report the result and keep
the change scoped to test or tooling support.

If a test cannot be made meaningful without changing the rules JSON, stop before
editing it. Explain the specific rule, definition, indicator, metadata, or
structural path that would need to change and wait for explicit confirmation.

## Editing Guidance

If asked to edit the rules:

- Edit [fedramp-consolidated-rules.json](../fedramp-consolidated-rules.json) and,
  only when necessary, the schema.
- Keep IDs stable unless the requested change requires a new or corrected ID.
- Preserve schema-driven property order.
- Update `updated` history when changing rule, definition, or indicator
  meaning.
- Run the tooling checks when available.

## Implementation Boundaries

- The [rules JSON](../fedramp-consolidated-rules.json) defines rule content.
  The [schema](../schemas/fedramp-consolidated-rules.schema.json) defines the
  data contract, including required fields, object shapes, scalar constraints,
  and controlled vocabularies. Tooling and test expectations are not rule content.
- Reuse [src/schema-metadata.ts](src/schema-metadata.ts) to read schema-owned
  constraints. Standard object property order follows the schema's `properties`
  order; repository-specific dynamic key and array ordering belongs in
  [order-config.json](order-config.json).
- Resolve canonical file paths through [src/config.ts](src/config.ts) and
  [fedramp-rules.config.json](fedramp-rules.config.json). Use
  [src/rules.ts](src/rules.ts) for loading and cloning documents and
  [src/traversal.ts](src/traversal.ts) for FRD, FRR, and KSI traversal.
- Keep validation read-only. Reuse [src/schema-validation.ts](src/schema-validation.ts)
  and [src/consistency.ts](src/consistency.ts); keep fix planning and application
  in [src/fix.ts](src/fix.ts), with CLI orchestration in [fix.ts](fix.ts).
- Use in-memory fixtures or cloned documents for tooling tests. A failing test
  can be the requested result when it exposes a data issue; report the issue
  with stable IDs and paths without changing the canonical rules to make it pass.

## Commands And Side Effects

Run maintenance commands from `tools/`; consult [README.md](README.md) for the
full reference.

- `bun run check` runs typechecking and the test runner without rewriting the
  canonical files. Use focused tests while developing and the full check for
  changes to rules, schema, tooling, or tests.
- `bun run fix` and every `fix:*` alias write to the configured rules JSON by
  default. They also format that file even when no normalization is needed.
  There is no CLI dry-run mode. An alternate `--output` path can produce a
  separate candidate when fixes are needed; it does not authorize replacing the
  canonical file. Apply the Rules JSON Edit Guardrail to direct and indirect edits.
- `bun run export` writes a spreadsheet. `bun run hooks:install` changes the
  repository's Git hook configuration.
- The [pre-commit hook](../.githooks/pre-commit) formats and stages **both** the
  rules JSON and schema before running checks, even for a documentation or
  tooling commit. Inspect its potential changes before committing; the hook
  does not grant permission to change the rules JSON.

For documentation-only work, verify links, command references, and the diff;
do not run fixers or add tests solely to check prose. For other maintenance,
run checks appropriate to the change and report commands, failures, and warnings.
Keep existing data findings separate from regressions introduced by the change.
Metadata freshness, subset force order, and unused subset warnings are advisory;
they do not authorize rules edits. Review the final diff for unintended data
changes, generated files, and staging changes.

## Changelog Generation

When asked to generate a changelog for the active branch, produce a screen-only
summary of the branch delta against `main`; do not create a changelog file
unless the user explicitly asks for one.

- Output the changelog as copy/pasteable Markdown. When responding in chat,
  place the changelog itself inside a fenced `markdown` code block; keep any
  explanatory notes outside the block.
- Use plain repository paths inside the changelog instead of clickable Markdown
  file links so the copied text remains portable.
- Use the branch merge base with `main` as the starting point and the current
  branch tip as the ending point. Prefer `git diff main...HEAD`,
  `git diff --name-status main...HEAD`, and
  `git log --reverse --format='%h %s' main..HEAD`.
- If `main` is missing or stale and network access is available, fetch it first;
  otherwise state which local ref was used.
- Treat committed branch changes as the changelog scope by default. Mention
  uncommitted workspace changes separately only when they affect the requested
  analysis or the user asks to include them.
- Validate the rules file against the schema before relying on automated JSON
  analysis. If validation cannot be run, say so and continue carefully.
- Parse JSON with a real JSON parser when comparing
  [fedramp-consolidated-rules.json](../fedramp-consolidated-rules.json) and
  [schemas/fedramp-consolidated-rules.schema.json](../schemas/fedramp-consolidated-rules.schema.json);
  avoid text-only diff analysis for rule content whenever structured access is
  practical.
- Compare the initial branch state to the final branch state, not commit by
  commit, unless a commit-level explanation is specifically requested.
- Detect and highlight breaking changes when summarizing underlying changes to
  [fedramp-consolidated-rules.json](../fedramp-consolidated-rules.json) or the
  schema. Use the software compatibility meaning of breaking change: a
  backwards-incompatible change to the machine-readable public contract that
  would make existing parsers, validators, exporters, queries, or integrations
  fail, reject previously valid data, silently misread data, or require code
  changes to continue processing the dataset. Examples include renamed or
  removed properties such as `primary_key_word` to `force`, changed required
  fields, changed property types, changed statement shapes, changed ID formats,
  controlled vocabulary changes that invalidate existing values, renamed
  top-level sections, renamed applicability or subset bucket keys when those
  keys are part of the schema contract, or stricter validation rules that reject
  files accepted by the previous schema.
- Do not mark rule-content taxonomy changes as breaking merely because a rule,
  definition, or indicator moves to a different ruleset, process, applicability
  path, subset, or ID. Treat those as Rules Content Changes and describe the
  user-visible mapping or migration impact. Only mark such movement as breaking
  when it also changes the documented data shape, schema vocabulary, required
  fields, or other machine-readable contract in a way that breaks existing
  tooling.
- Mark every breaking change bullet with `**Breaking:**` at the start of the
  bullet in the relevant changelog section. Include the old shape and the new
  shape when known, and briefly state the practical impact. For example,
  changing FRR metadata from `info.labels` to `info.subsets` is breaking
  because tools or consumers that still look for `labels` will fail to find the
  declarations and may reject or misread the FRR data until updated.
- Use stable IDs in every rule-content bullet: `FRD-XXX`, `FRR` requirement IDs
  such as `VDR-CSO-123`, and `KSI-THEME-KEY`.
- For each substantively changed rule, definition, or indicator, write one
  sentence describing the user-visible change. Include additions, removals,
  renamed terms, wording changes, actor/scope changes, applicability moves,
  artifact changes, control mappings, examples, notifications, related rule
  references, external references, timeframes, and class-specific variants.
- Group purely mechanical metadata churn, such as mass `updated` date resets or
  property ordering changes, instead of listing every affected rule separately.
- Separate evidence from inference. When a conclusion comes from schema shape,
  property names, or structural movement rather than explicit wording, label it
  as structural.
- Use exactly these changelog sections, in this order:
  1. `Rules Content Changes`
     Summarize changes inside `fedramp-consolidated-rules.json` itself. Focus
     on rule, definition, indicator, FRR document, and metadata meaning changes.
  2. `Schema And Structure Changes`
     Summarize changes to
     `schemas/fedramp-consolidated-rules.schema.json` and corresponding
     structural changes in the rules JSON, such as top-level `info` changes,
     property additions, renamed applicability buckets, required fields,
     controlled vocabularies, and object shapes.
  3. `Tooling And Test Changes`
     Summarize support-code changes, CLI behavior, validators, fixers,
     package scripts, test harnesses, and test coverage.
- Keep bullets simple and high signal. Prefer a single line per bullet unless
  the change is complex enough that a short second sentence prevents ambiguity.
- End with a brief validation note naming the commands run, such as
  `bun run check`, or explain why validation was not run.
