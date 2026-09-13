# Instructions For Information Analysis

## Start Here

Use these two authoritative files:

- [fedramp-consolidated-rules.json](fedramp-consolidated-rules.json): the
  FedRAMP Consolidated Rules for 2026, including definitions and indicators.
- [schemas/fedramp-consolidated-rules.schema.json](schemas/fedramp-consolidated-rules.schema.json):
  the expected data shape and allowed values, using JSON Schema Draft 2020-12.

Default to read-only analysis. Parse the JSON with a real JSON parser and
validate it against the local schema before relying on automated analysis.
If validation fails or cannot be run, disclose that limitation and avoid
unsupported conclusions. Read the relevant entries with their surrounding
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
| `CTL` (optional) | Control guidance and parameters                                         | `CTL.<family>.<control ID>`                                    |

For `CTL`, read each control's common `guidance` and `parameters` and any
`varies_by_class` entries. Schema support does not imply that every optional
field or class variant is populated; inspect the JSON before drawing conclusions.

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
and KSI indicators and their class variants do not have a `force` field.

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
4. **Select the statement shape.** FRR has either top-level `statement` and
   `force`, or `varies_by_class` with statements and forces inside each class.
   KSI has either a top-level `statement` or class-specific statements.
   Class keys are lowercase `a`, `b`, `c`, and `d`; not all are necessarily
   present. Do not invent missing variants or copy another class's statement.
   Read class-specific following information, notes, artifacts, control lists,
   effective dates, and timeframes where the schema permits them, together with
   the entry's common information.
5. **Respect the force.** In FRR, `MUST` and `MUST NOT` are hard requirements;
   `SHOULD` and `SHOULD NOT` are expected practices with possible justified
   exceptions; `MAY` is optional or permitted behavior. Interpret KSI through
   its capability statement and applicable process rules without inventing a
   normative force.
6. **Read the supporting details.** Include following information and bullets,
   notes, examples, corrective actions, notifications, references, related IDs,
   and timeframes as relevant. Consult `info.default_artifacts.FRR` or
   `info.default_artifacts.KSI` and applicable entry/class `artifacts` buckets
   (`all`, `20x`, `rev5`). Control mappings and artifact lists are analysis
   signals; they do not replace the statement or prove implementation.

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
Compare source commits and dates with the dataset version; generated content
and discussions may describe a different revision. Report discrepancies rather
than silently replacing local rule content with external text.
