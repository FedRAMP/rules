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

When asked to generate a changelog for the active branch, produce two separate,
screen-only outputs of the branch delta against `main`: the Markdown changelog
and a YAML entry as specified below. Do not create or modify a changelog file!

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
- Parse JSON with a real JSON parser when comparing
  [fedramp-consolidated-rules.json](../fedramp-consolidated-rules.json) and
  [schemas/fedramp-consolidated-rules.schema.json](../schemas/fedramp-consolidated-rules.schema.json);
  avoid text-only diff analysis for rule content whenever structured access is
  practical.
- Compare the initial branch state to the final branch state, not commit by
  commit, unless a commit-level explanation is specifically requested.
- When commit messages mention an issue #, investigate that issue to see if the
  main comment contains a link to a FedRAMP discussion or comment such as "source"
  or "credit" or "src" etc., then analyze that
  discussion link and determine the users involved in the discussion and the link
  to the most important comment that generated the issue. Then at the end of the
  update summary add a message acknowledging the github user and their comment,
  using "(flagged by @github-user in [2026/##](comment))" or similar. If it can't
  be identified then skip this.
- For object items changed inside the `fedramp-consolidated-rules.json`
  such as FRR FRD KSI CTL etc.:
    - Start with the ID followed by the name in parentheses, i.e. "MKT-FRP-SOF (Scope of FedRAMP):"
    - Use the most recent `updated` `comment` from the current most recent commit and do
    - not generate your own summary. If the `updated` date is more than a week in the past
      then instead generate a summary and at the end add "(the `updated` array was not updated
      for this change)"
    - add a link to the `issue` if exists.
    - add acknowledgements and thread link if it exists
- Generally, large-scale mechanical changes to the JSON data itself are unexpected
  and should not happen, but if you notice a situation where a significant number
  of large-scale changes occur (such as the addition of a new metadata field within
  the JSON data) then summarize those changes in logical groups instead of listing
  them item by item. For example, a new object key named `example `being added to
  every FRD might be summarized as "Every FRD item had a new key added named `example`
  that [describe the changes]."
    - This should specifically include when more than 5 items have changes to the
      `controls` array - just summarize overall the number of items that were changed
      and that some number of controls were added (or explain the pattern if it is
      clear, such as the same control being added to a number of items)
- Do not mention the following specific mechanical changes that aren't important to
  humans:
  - if a term is added to `terms`
  - if something is added to `related`
  - if a `reference` or `reference_url` is added/changed/removed
  - changes to `info.version` or `info.last_updated`
- Use exactly these Markdown changelog sections, in this order:
  1. `Rules Changes`
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
- Also mention how long it took to run in a separate comment (don't include it in
  the changelog itself)

### YAML Output

After the unchanged Markdown output, print a separate fenced `yaml` code block
so each format can be copied independently. The YAML contains only the dataset
changelog: rules and schema/structure changes, without tooling/test changes,
runtime, explanatory notes, or Markdown section headings.

The destination YAML document has a top-level `fedramp-consolidated-rules` key
whose value is a sequence of release entries. Output exactly one new sequence
entry to paste beneath that existing key; **do not repeat the top-level key**.
No existing changelog file is needed to generate this output. Use this field
order and structure:

- `version`: the string from `info.version` in the branch-tip rules JSON.
- `last_updated`: the string from `info.last_updated` in that same JSON, not the
  date when the changelog is generated.
- `rules`: a sequence of strings corresponding to the Markdown `Rules Changes`
  bullets, with the Markdown bullet markers removed.
- `schema`: a sequence of strings corresponding to the Markdown
  `Schema And Structure Changes` bullets, with the bullet markers removed.

Reuse the same summaries, grouping, exclusions, IDs, names, issue links,
acknowledgements, and stale-`updated` notices as the Markdown output. Preserve
Markdown links and backticks as literal text inside the YAML strings. Do not
add a `tooling` field. If a category has no changes, use `rules: []` or
`schema: []` instead of a placeholder string or a null value.

Use spaces, never tabs. Start the release-entry dash with **two leading
spaces**, align its remaining field names at four spaces, and indent the
`rules` and `schema` sequence dashes by six spaces. Double-quote all scalar
values, including the version and date, and escape embedded double quotes,
backslashes, and line breaks correctly for YAML. Keep each summary on one
physical line. The copy/paste block must have this indentation (the values
below are illustrative):

```yaml
  - version: "2026.10.31.01"
    last_updated: "2026-10-31"
    rules:
      - "FRD-ABC (Example Definition): Summary of the rule change."
    schema:
      - "Summary of the schema or structure change."
```

Before printing, parse the proposed block with a YAML parser after prepending
`fedramp-consolidated-rules:\n`. Verify that it produces one release entry with
string `version` and `last_updated` values and string arrays for `rules` and
`schema`. If parsing cannot be run, disclose that limitation outside both code
blocks.
