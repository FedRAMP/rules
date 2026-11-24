# FedRAMP Consolidated Rules

This repository contains the machine-readable FedRAMP Consolidated Rules for
2026. Use it to read, analyze, and integrate structured definitions, process
rules, and security indicators.

## Repository Contents

- [fedramp-consolidated-rules.json](fedramp-consolidated-rules.json) is the
  canonical rules dataset. It contains dataset metadata (`info`), FedRAMP
  Definitions (`FRD`), FedRAMP Rules (`FRR`), Key Security Indicators (`KSI`),
  and control metadata, guidance, and parameters (`CTL`, an optional schema section).
- [schemas/fedramp-consolidated-rules.schema.json](schemas/fedramp-consolidated-rules.schema.json)
  defines the dataset's expected structure, required fields, and allowed values.

The JSON defines the rule content; the schema defines its machine-readable
shape. Other files in this repository provide supporting documentation and
maintenance infrastructure.

## Using The Information

Start with the dataset and schema for structured analysis. Definitions explain
terms used in the rules. Process rules describe requirements and recommendations;
security indicators describe capabilities and evidence expectations. Account for
framework applicability, service class, document status, and effective dates
when interpreting the information.

**AI agents:** Read [AGENTS.md](AGENTS.md) before ingesting or analyzing the
information. For maintenance tasks, also read
[tools/AGENTS-TOOLS.md](tools/AGENTS-TOOLS.md).

## Class-Specific Metadata

The meaning of `varies_by_class` depends on the section:

| Section | Class keys | Contract |
| --- | --- | --- |
| FRD | None | Definitions have no structured class overrides. |
| FRR | `a`, `b`, `c`, `d` | Optional partial content overrides; optional `applicable` boolean adjusts subset class membership. |
| KSI | `a`, `b`, `c`, `d` | Optional partial content overrides, including `force`; effective statements and forces are required for all four classes. |
| CTL | `b`, `c`, `d` | All three class entries and their `force` values are required. Each control also requires `assess_yearly_by_class` booleans for all three classes. |

### FRR And KSI Overrides

Top-level content supplies defaults. A class entry replaces only the fields it
contains; missing fields inherit the top-level value. A missing class entry
inherits all common content. It does not mean that the rule is inapplicable.
When a value is absent both at the top level and in that class, it remains
absent; never copy another class's value. Class-only content is allowed if
required effective statements and forces are available for the applicable
classes.

Each override replaces the entire field. Arrays are not concatenated, and
objects such as `artifacts`, `schema`, `rev5_controls_list`, and `pain_timeframes`
are not recursively merged. Empty arrays replace inherited arrays where the
schema permits them; null is not an instruction to remove a field.

This illustrative fragment gives Class A a different force and timeframe while
other classes inherit the defaults:

```json
{
  "statement": "Shared capability statement.",
  "force": "MUST",
  "timeframe_type": "days",
  "timeframe_num": 30,
  "varies_by_class": {
    "a": { "force": "MAY", "timeframe_num": 60 }
  }
}
```

This is a content fragment, not a complete rule or indicator. Identity, history,
and other required fields still follow the schema. The complete override field
list is in the [maintenance guide](tools/README.md#class-content).

### FRR Class Applicability

Resolve subset applicability first, then read
`varies_by_class.<class>.applicable`:

| Value | Meaning |
| --- | --- |
| `true` | Include the class even if the subset does not include it. |
| `false` | Exclude the class even if the subset includes it. |
| Omitted | Inherit the subset's class membership. |

Omit the property to leave it unspecified; null and empty strings are invalid.
A class entry may contain only `applicable`. This changes class membership,
not framework, certification path, or actor applicability. Subset-level
`applicability` and the requirement's `affects` remain relevant.

`applicable` is supported only in FRR. KSI and CTL do not accept this flag.
A `MAY` force does not mean `applicable: false`.

### Rev5 Control Metadata

CTL stores explicit `varies_by_class.<class>.force` for B, C, and D: `MUST`
when the control is listed in
`FRR.FRC.data.rev5.CSF.FRC-CSF-BSL.varies_by_class.<class>.rev5_controls_list`,
and `MAY` otherwise. Do not substitute a top-level force or omit a class because
all three forces happen to match.

Each control also stores `assess_yearly_by_class.b`, `.c`, and `.d` at the
control's top level, outside `varies_by_class`. Each boolean is true when the
control is listed in
`FRR.IVV.data.rev5.CSF.IVV-CSF-AIA.varies_by_class.<class>.rev5_controls_list`,
and false otherwise. False means absence from that annual-assessment list;
it does not establish an exemption from other assessment requirements.

These two rules are the sources of truth. Source IDs such as `AC-02 (01)` map
to CTL keys such as `CTL.AC.AC-02-01`; base controls and enhancements have
separate membership. CTL includes metadata-only entries for source-listed
controls without guidance or parameters. Common `guidance` and `parameters`
remain valid alongside class-specific guidance and parameters. The FRR/KSI
whole-field replacement contract does not define how to combine CTL guidance
and parameters.

### Compatibility And Validation

The current schema rejects `force_by_class`, rule-level `applicability`, and
class-level `applies` or `applicability.add`/`applicability.exclude`. Their
replacements are class `force` overrides and FRR's optional `applicable` flag.
Subset-level `applicability` is unchanged. Historical `updated` comments may
still mention former field names; those comments are not the current contract.
Use the schema shipped with the dataset version you consume.

JSON Schema checks the stored shapes and KSI statement/force coverage. Full
validation also requires resolving FRR applicability, checking effective
content and timeframe dependencies after inheritance, and comparing CTL
metadata with its source rules. The maintenance tools perform these additional
checks; schema validity alone does not prove source agreement or compliance.

## Related Resources

- [FedRAMP/2026](https://github.com/fedramp/2026) contains the narrative content
  and website project that accompanies the structured rules.
- [FedRAMP/2026-markdown](https://github.com/fedramp/2026-markdown) provides
  generated Markdown combining the structured rules and narrative content for
  direct reading and AI ingestion. Its `_sources.json` records source commits.
- [FedRAMP community discussions](https://github.com/FedRAMP/community/discussions/)
  and [FedRAMP 2026 discussions](https://github.com/FedRAMP/2026/discussions/)
  provide additional discussion and context.
- [FedRAMP Help](https://help.fedramp.gov) provides help articles and support.

Related resources can reflect different revisions. Check their source versions
and dates when comparing them with this dataset.

## Maintenance

The [tools/](tools/) directory is internal maintenance infrastructure for
FedRAMP developers. Most users and agents analyzing the information should
ignore it; installing or running these tools is not required to consume the
dataset.

FedRAMP developers can use [tools/README.md](tools/README.md) for setup,
validation, normalization, tests, and Git hooks. Maintenance agents
must also follow [tools/AGENTS-TOOLS.md](tools/AGENTS-TOOLS.md).

## Releases and versioned downloads

Formal releases are published manually through the **Release FedRAMP Consolidated Rules** workflow.
Each release includes a ZIP with the original rules/schema and `.min.json`
variants. The `2026` tag follows the newest published release. GitHub Pages serves
minified current (`-2026`) and permanent versioned JSON/schema files.

See [the release guide](tools/release/README.md) for previewing, publishing,
consumer URL patterns, setup, and recovery. Commits alone do not publish releases.
