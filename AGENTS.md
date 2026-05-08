# Instructions For AI Agents

## Primary Scope

When analyzing this repository, focus on only these files:

- [fedramp-consolidated-rules.json](fedramp-consolidated-rules.json)
- [schemas/fedramp-consolidated-rules.schema.json](schemas/fedramp-consolidated-rules.schema.json)

The rest of the repository is supporting infrastructure. The `tools` directory,
tests, generated summaries, and READMEs can help with validation and
orientation, but they are not the rules and should not be treated as
authoritative rule content.

## Source Of Truth

[fedramp-consolidated-rules.json](fedramp-consolidated-rules.json) is the
source of truth for the FedRAMP Consolidated Rules for 2026 Public Preview.

[schemas/fedramp-consolidated-rules.schema.json](schemas/fedramp-consolidated-rules.schema.json)
is the source of truth for the expected data shape.

[RULES.md](RULES.md) is generated from the JSON file. Use it only as a quick
summary, never as the primary source for analysis.

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

When a defined term appears in an FRR rule or KSI indicator, use the FRD
definition instead of assuming the plain-language meaning.

### FRR

`FRR` is keyed by process short names such as `VDR`, `FRC`, `CCM`, and `SCN`.
Each process contains:

- `info`
  Rule metadata, purpose, status, effective metadata, and label definitions.
- `data`
  The rule tree.

The rule tree is organized as:

```text
FRR -> process -> data -> applicability -> label -> requirement ID
```

Applicability keys are `both`, `20x`, and `rev5`. Labels identify actors,
scopes, or process buckets. Requirement IDs follow the
`PROCESS-LABEL-KEY` pattern, such as `VDR-CSO-123`.

Each requirement contains either:

- a single `statement` and `primary_key_word`, or
- a `varies_by_class` object with class-specific statements and keywords.

Other useful fields include `affects`, `controls`, `artifacts`,
`following_information`, `examples`, `notification`, timeframes, terms,
references, and `updated` history.

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
- Select the correct applicability path: `both`, `20x`, or `rev5`.
- Check `info.effective` before deciding whether a rule applies to a framework
  or timeline.
- Check each document `status`; `placeholder` and `empty` content should be
  treated differently from `stable` content.
- Resolve relevant terms through `FRD`.
- Respect `varies_by_class` before applying a rule to a specific service class.
- Treat `MUST` and `MUST NOT` as hard requirements, `SHOULD` and `SHOULD NOT`
  as expected practices with possible justified exceptions, and `MAY` as
  optional or permitted behavior.
- Cite stable IDs for every finding, mapping, or recommendation.
- Use `affects`, `controls`, `artifacts`, and `default_artifacts` as mapping
  signals. They are aids for analysis, not replacements for the rule statement.
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

## Editing Guidance

If asked to edit the rules:

- Edit [fedramp-consolidated-rules.json](fedramp-consolidated-rules.json) and,
  only when necessary, the schema.
- Keep IDs stable unless the requested change requires a new or corrected ID.
- Preserve schema-driven property order.
- Update `updated` history when changing rule or definition meaning.
- Regenerate [RULES.md](RULES.md) through the tooling rather than editing it by
  hand.
- Run the tooling checks when available.
