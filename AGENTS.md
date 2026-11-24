# Instructions For Information Analysis

## Start Here

Use these two authoritative files:

- [fedramp-consolidated-rules.json](fedramp-consolidated-rules.json): the
  FedRAMP Consolidated Rules for 2026, including definitions and indicators.
- [schemas/fedramp-consolidated-rules.schema.json](schemas/fedramp-consolidated-rules.schema.json):
  the expected data shape and allowed values, using JSON Schema Draft 2020-12.

Default to read-only analysis. Parse the JSON with a real JSON parser and
validate it against the local schema before relying on automated analysis.
Schema validation alone does not resolve FRR applicability or prove CTL/source
agreement. Apply the class-resolution and source-comparison steps below when
those affect the analysis. If validation fails or cannot be run, disclose that
limitation and avoid unsupported conclusions. Read the relevant entries with their surrounding
metadata; this guide is a navigation aid, not a substitute for the source.

The `tools/` directory is only relevant to FedRAMP developers during project
maintenance; most users and information-analysis agents should ignore it.
For maintenance tasks, including edits, tooling support, or branch changelogs,
first read [tools/AGENTS-TOOLS.md](tools/AGENTS-TOOLS.md).

## Locate The Information

The schema requires four top-level sections; the current dataset also includes
the optional `CTL` section:

| Section          | Contents                                                                | Lookup path                                                    |
| ---------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------- |
| `info`           | Dataset title, description, version, update date, and default artifacts | `info`                                                         |
| `FRD`            | Controlled definitions and their metadata                               | `FRD.data.<applicability>.<definition ID>`                     |
| `FRR`            | Process documents, requirements, and recommendations                    | `FRR.<process>.data.<applicability>.<subset>.<requirement ID>` |
| `KSI`            | Security themes and indicators                                          | `KSI.<theme>.indicators.<indicator ID>`                        |
| `CTL` (optional) | Control guidance, parameters, baseline forces, and annual assessment flags | `CTL.<family>.<control ID>` |

For `CTL`, read each control's common `guidance` and `parameters`, its
`varies_by_class.b/c/d.force`, and `assess_yearly_by_class.b/c/d`. Baseline forces
are `MUST` for controls listed in FRC-CSF-BSL for that class and `MAY` otherwise.
Annual assessment flags are true for controls listed in IVV-CSF-AIA for that
class and false otherwise. Those rules remain the sources of truth. Source
notation `AC-02 (01)` maps to CTL key `AC-02-01`. Preserve common and
class-specific guidance and parameters when reading these metadata fields.
Every CTL entry requires all three class forces and all three annual booleans;
`assess_yearly_by_class` is outside `varies_by_class`. A false annual flag means
absence from IVV-CSF-AIA's list, not exemption from other assessments. Compare
against `FRR.FRC.data.rev5.CSF.FRC-CSF-BSL` and
`FRR.IVV.data.rev5.CSF.IVV-CSF-AIA`, using each rule's
`varies_by_class.<class>.rev5_controls_list`. Metadata-only CTL entries are valid;
missing guidance does not imply a missing control.

**Definitions:** IDs follow `FRD-XXX`, such as `FRD-ACV`. Read `term`,
`definition`, `alts`, and any notes or references. Use the FRD meaning whenever
a defined term appears in a rule or indicator; use plain-language meaning when
no definition exists. Shared definitions are in `FRD.data.all`; the schema also
allows framework-specific definitions in `FRD.data.20x` and `FRD.data.rev5`.
Definition IDs are object keys, not an `id` field in each definition.

**Process rules:** Process keys include `VDR`, `FRC`, `CCM`, and `SCN`.
Each process has `info` metadata and a `data` tree. Subsets identify actors,
scopes, or process buckets. Requirement IDs follow `PROCESS-SUBSET-KEY`, with
three-character segments; the final segment can contain letters or digits.
For example, `AFC-FRP-VRE` is at `FRR.AFC.data.all.FRP.AFC-FRP-VRE`.
Requirement IDs are object keys.

**Security indicators:** Theme keys include `IAM`, `CNA`, `MLA`, and `SCR`.
Indicator IDs follow `KSI-THEME-KEY`, such as `KSI-CED-RAT` at
`KSI.CED.indicators.KSI-CED-RAT`. Theme metadata, including `status`, lives
directly on the theme. KSI does not use FRR's `info`/`data`/subset hierarchy,
and KSI indicators use a top-level `force` with optional class overrides, or
class-specific forces.

## Interpret Applicability And Meaning

1. **State the scope.** Record `info.version` and `info.last_updated`, the
   framework (`20x` or `rev5`), certification path, service class, actor, and
   relevant date. Identify unknowns that could change the answer.
2. **Include shared content.** For FRD and FRR, consider `all` plus the matching
   framework bucket when present. `all` means shared across frameworks, not
   universally applicable to every actor or class. Resolve FRR subsets from
   common `info.subsets` plus matching `info.20x.subsets` or
   `info.rev5.subsets`. Read their descriptions and `applicability.types`,
   `paths`, `classes`, and `affects`, together with each requirement's `affects`.
   Preserve schema vocabulary and case: for example, the bucket `rev5` differs
   from the certification type value `Rev5`.
3. **Check status and timing.** FRD and FRR status is under their document
   `info.status`; KSI status is `KSI.<theme>.status`. Distinguish `stable`,
   `placeholder`, and `empty`. For FRD and FRR, effective metadata is either
   common `info.effective` or paired `info.20x.effective` and
   `info.rev5.effective`. Read `is` (`required`, `optional`, or `no`), comments,
   warnings, and the separate obtain, maintain, optional-adoption, and grace
   dates. Check entry-level and class-specific `effective_date` where present.
   Neither `stable` nor an update date alone establishes current applicability.
4. **Resolve class overrides.** FRR and KSI use optional `varies_by_class`
   entries keyed by lowercase `a`, `b`, `c`, and `d`. Each supplied field
   replaces the entire top-level field, including objects and arrays; omitted
   fields inherit the top-level value. A missing class entry inherits common
   content and does not imply exclusion. A field absent at both levels stays
   absent. Do not copy another class's content. Each applicable FRR class and
   every KSI class A–D must have an effective statement and force.
   This applies to statements, forces, following information, notes, schema
   references, artifacts, control lists, effective dates, and timeframes.
   For FRR, start with subset applicability and apply
   `varies_by_class.<class>.applicable: true` or `applicable: false` when
   present: true includes the class, false excludes it, and omission inherits
   subset membership. Null and empty strings are invalid. Rule-level
   type/path/actor adjustments are not supported. KSI and CTL do not accept
   `applicable`; a `MAY` force is not an exclusion. CTL uses explicit forces
   for classes B–D and separate annual-assessment flags, alongside common and class-specific
   guidance and parameters; do not apply FRR/KSI replacement semantics to CTL
   without a separate contract.
5. **Respect the force.** In FRR, `MUST` and `MUST NOT` are hard requirements;
   `SHOULD` and `SHOULD NOT` are expected practices with possible justified
   exceptions; `MAY` is optional or permitted behavior. The `force` field
   identifies the primary force of the rule. A statement may contain a secondary
   force that applies only in relation to implementing the primary statement;
   it is not independently enforceable as a standalone requirement. For example,
   in "Parties MAY do X but MUST do Z if they do," `MAY` is the primary force:
   X is optional, and Z is required only if X is performed. When parsing or
   summarizing rules, preserve this relationship rather than extracting the
   secondary force as an unconditional obligation. See the
   [discussion of primary and secondary force](https://github.com/FedRAMP/community/discussions/193#discussion-11243198).
   For KSI, read the effective `force` after class inheritance together with
   its capability statement and applicable process rules.
6. **Read the supporting details.** Include following information and bullets,
   notes, examples, corrective actions, notifications, references, related IDs,
   and timeframes as relevant. Consult `info.default_artifacts.FRR` or
   `info.default_artifacts.KSI` and applicable entry/class `artifacts` buckets
   (`all`, `20x`, `rev5`). Control mappings and artifact lists are analysis
   signals; they do not replace the statement or prove implementation.

The current contract does not use `force_by_class`, rule-level `applicability`,
or class-level `applies` or `applicability.add`/`applicability.exclude`. Historical
comments may mention them. FRD has no structured class overrides. See the
[root README](README.md#class-specific-metadata) for examples and the distinction
between stored-schema validation and effective-content validation.

## Produce Traceable Analysis

Cite stable definition, rule, or indicator IDs and relevant JSON paths for each
finding, mapping, or recommendation. For document or dataset metadata, cite its
exact path. Resolve related IDs and terms from the dataset instead of guessing.

When reviewing a system, codebase, infrastructure configuration, or operational
process, map IDs to concrete evidence such as configuration, access controls,
logs, tests, policies, or runbooks. State evidence found, evidence missing, and
conclusions inferred, with assumptions, confidence, and next actions where
useful. Prefer narrowly scoped findings; do not claim compliance from silence
or from a control mapping alone.

## Additional Context

Use these resources when the analysis needs information beyond this dataset:

- [FedRAMP/2026](https://github.com/fedramp/2026): narrative text and the website
  project accompanying the structured rules.
- [FedRAMP/2026-markdown](https://github.com/fedramp/2026-markdown): generated
  Markdown combining structured rules and narrative text for reading and AI
  ingestion; `_sources.json` records the source commits.
- [FedRAMP community discussions](https://github.com/FedRAMP/community/discussions/):
  community questions, announcements, and discussion.
- [FedRAMP 2026 discussions](https://github.com/FedRAMP/2026/discussions/):
  discussion associated with the 2026 project.
- [FedRAMP Help](https://help.fedramp.gov): help articles and support information.

Cite the specific page, discussion, or comment when using external context,
and distinguish participant opinions or proposals from published requirements.
Compare source revisions with `info.version` and dates with `info.last_updated`; generated content
and discussions may describe a different revision. Report discrepancies rather
than silently replacing local rule content with external text.
