# Instructions For AI Agents

## Primary Scope

When analyzing this repository, focus on only these files:

- [fedramp-consolidated-rules.json](fedramp-consolidated-rules.json)
- [schemas/fedramp-consolidated-rules.schema.json](schemas/fedramp-consolidated-rules.schema.json)

The rest of the repository is supporting infrastructure. The `tools` directory,
tests, and READMEs can help with validation and orientation, but they are not
the rules and should not be treated as authoritative rule content.

## Source Of Truth

[fedramp-consolidated-rules.json](fedramp-consolidated-rules.json) is the
source of truth for the FedRAMP Consolidated Rules for 2026 Public Preview.

[schemas/fedramp-consolidated-rules.schema.json](schemas/fedramp-consolidated-rules.schema.json)
is the source of truth for the expected data shape.

## Rules JSON Edit Guardrail

Do not modify
[fedramp-consolidated-rules.json](fedramp-consolidated-rules.json) unless the
user specifically instructs you to edit that file.

If a task appears to require changing
[fedramp-consolidated-rules.json](fedramp-consolidated-rules.json), stop before
editing it. Propose a concise plan that identifies the specific rule,
definition, indicator, metadata, or structural paths you intend to change, then
wait for the user's explicit confirmation before making those edits.

Analysis, validation, structured reads, and reports may use
[fedramp-consolidated-rules.json](fedramp-consolidated-rules.json) without
additional permission. The guardrail applies to file modifications.

## Test Creation Guardrail

When the user asks to add or update tests for the tooling, test harness, or
validation behavior, assume the requested test may expose existing rules data
issues, warnings, or intentionally failing cases. That is often the reason the
test is being added.

Do not fix test failures or warnings by editing
[fedramp-consolidated-rules.json](fedramp-consolidated-rules.json) unless the
user explicitly asks for rule-content changes. If a newly added test reports
errors or warnings against the current rules file, report the result and keep
the change scoped to test or tooling support.

If a test cannot be made meaningful without changing the rules JSON, stop before
editing it. Explain the specific rule, definition, indicator, metadata, or
structural path that would need to change and wait for explicit confirmation.

## Dataset Structure

The JSON file has four top-level sections:

- `info`
  Dataset metadata, including title, description, version, `last_updated`, and
  default artifact expectations.
- `FRD`
  FedRAMP Definitions. Use these definitions to resolve terms used in rules and
  indicators.
- `FRR`
  FedRAMP Rules process documents. These contain process-oriented requirements
  and recommendations.
- `KSI`
  Key Security Indicators. These describe security capabilities and evidence
  expectations.

### FRD

`FRD` entries are controlled definitions. Definition IDs follow `FRD-XXX`.
Important fields include `term`, `definition`, `alts`, references, notes, and
`updated` history.

The FRD data container uses applicability buckets. Shared definitions live under
`FRD.data.all`; framework-specific definitions, if present, live under
`FRD.data.20x` or `FRD.data.rev5`.

FRD effective metadata may be common (`FRD.info.effective`) or split into
paired framework-specific blocks (`FRD.info.20x.effective` and
`FRD.info.rev5.effective`).

When a defined term appears in an FRR rule or KSI indicator, use the FRD
definition instead of assuming the plain-language meaning.

### FRR

`FRR` is keyed by process short names such as `VDR`, `FRC`, `CCM`, and `SCN`.
Each process contains:

- `info`
  Rule metadata, purpose, status, effective metadata, subset definitions, and
  optional flow descriptions. Effective metadata may be common
  (`info.effective`) or split into paired framework-specific blocks
  (`info.20x.effective` and `info.rev5.effective`). Subsets and flows may also
  be common or framework-specific.
- `data`
  The rule tree.

The rule tree is organized as:

```text
FRR -> process -> data -> applicability -> subset -> requirement ID
```

Applicability keys are `all`, `20x`, and `rev5`. Subsets identify actors,
scopes, or process buckets. Requirement IDs follow the
`PROCESS-SUBSET-KEY` pattern, such as `VDR-CSO-123`.

Each requirement contains either:

- a single `statement` and `force`, or
- a `varies_by_class` object with class-specific statements and force values.

Class-specific variants may also include `following_information`, `artifacts`,
notes, effective dates, simple timeframes, and `pain_timeframes`.

Other useful top-level fields include `affects`, `controls`, `artifacts`,
`following_information`, `following_information_bullets`, `examples`,
`notification`, simple timeframes, terms, related rule references, references,
corrective actions, effective dates, and `updated` history.

### KSI

`KSI` is keyed by security theme short names such as `IAM`, `CNA`, `MLA`, and
`SCR`. Indicator IDs follow `KSI-THEME-KEY`.

Indicators describe security capabilities. They include statements or
class-specific variants, mapped controls, optional artifact expectations,
terms, references, and update history.

## Analysis Best Practices

- Parse the JSON with a real JSON parser. Do not analyze it with ad hoc text
  matching when structured access is practical.
- Validate the rules file against the schema before relying on automated
  analysis.
- Select the correct applicability path: `all`, `20x`, or `rev5`; `all`
  means shared across frameworks.
- Check common `info.effective` or the framework-specific
  `info.20x.effective` / `info.rev5.effective` before deciding whether a rule
  applies to a framework or timeline.
- Check each document `status`; `placeholder` and `empty` content should be
  treated differently from `stable` content.
- Resolve relevant terms through `FRD`.
- Resolve FRR subset definitions from common `info.subsets` plus any matching
  framework-specific `info.20x.subsets` or `info.rev5.subsets`.
- Respect `varies_by_class` before applying a rule to a specific service class,
  including class-specific following information, artifacts, notes, and
  timeframes.
- Treat `MUST` and `MUST NOT` as hard requirements, `SHOULD` and `SHOULD NOT`
  as expected practices with possible justified exceptions, and `MAY` as
  optional or permitted behavior.
- Cite stable IDs for every finding, mapping, or recommendation.
- Use `affects`, `controls`, `artifacts`, `default_artifacts`, notifications,
  related rule references, and timeframes as mapping signals. They are aids for
  analysis, not replacements for the rule statement.
- Distinguish evidence found, evidence missing, and conclusions inferred from
  evidence. Do not claim compliance from silence.

## Cloud Code, Codex, And MCP Analysis

For cloud code, infrastructure-as-code, Codex workflows, and MCP servers, use
the rules as a structured mapping source:

- Start with KSI themes for capability review:
  `IAM` for identity and access, `MLA` for monitoring and auditing, `SVC` for
  service configuration, `CNA` for cloud-native architecture, `CMT` for change
  management, `SCR` for supply chain risk, `INR` for incident response, and
  `RPL` for recovery planning.
- Use FRR documents for process obligations such as vulnerability response,
  significant changes, certification, continuous monitoring, incident
  communication, cryptographic modules, and marketplace listing.
- For code repositories, map rule and indicator IDs to concrete evidence:
  configuration files, IaC modules, CI workflows, policy files, access-control
  definitions, logging configuration, vulnerability workflows, dependency
  manifests, deployment pipelines, and operational runbooks.
- For Codex-style agents, produce traceable outputs: scope, assumptions,
  matched IDs, evidence paths, missing evidence, confidence, and recommended
  next actions.
- For MCP servers, pay particular attention to tool permissions,
  authentication, authorization, audit logging, secret handling, data boundary
  controls, dependency provenance, and incident reporting paths.
- Prefer narrowly scoped findings with exact citations over broad claims about
  FedRAMP readiness.

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
  [fedramp-consolidated-rules.json](fedramp-consolidated-rules.json) and
  [schemas/fedramp-consolidated-rules.schema.json](schemas/fedramp-consolidated-rules.schema.json);
  avoid text-only diff analysis for rule content whenever structured access is
  practical.
- Compare the initial branch state to the final branch state, not commit by
  commit, unless a commit-level explanation is specifically requested.
- Detect and highlight breaking changes when summarizing underlying changes to
  [fedramp-consolidated-rules.json](fedramp-consolidated-rules.json) or the
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

## Editing Guidance

If asked to edit the rules:

- Edit [fedramp-consolidated-rules.json](fedramp-consolidated-rules.json) and,
  only when necessary, the schema.
- Keep IDs stable unless the requested change requires a new or corrected ID.
- Preserve schema-driven property order.
- Update `updated` history when changing rule, definition, or indicator
  meaning.
- Run the tooling checks when available.
