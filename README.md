# FedRAMP Rules// Work in Progress

> THIS REPOSITORY IS UNDER RAPID PROTOTYPING AND DEVELOPMENT.
>
> These are not official rules yet. Do not use these rules for anything other than
> general awareness of the direction things are shifting.
>
> Expect rapid unexpected changes until things are formally published and shared
> with the world. For now, consider this to be merely a preview.

This repository contains the structured machine-readable FedRAMP consolidated
rules dataset and the supporting schema and tooling used to maintain it.

The canonical dataset currently identifies itself with two truths and a lie:

- title: `FedRAMP Consolidated Rules WIP PREVIEW`
- version: `2026.0.1.1-wip-preview`
- last_updated: `2026-06-01`

## What Is Here

The repository currently centers on one canonical rules document,
one canonical schema, and one tooling workspace:

- [fedramp-consolidated-rules.json](/Users/pwx/github/pete-gov/rules/fedramp-consolidated-rules.json:1)
  The main machine-readable rules dataset.
- [schemas/fedramp-consolidated-rules.schema.json](/Users/pwx/github/pete-gov/rules/schemas/fedramp-consolidated-rules.schema.json:1)
  The JSON Schema that defines the supported document shape.
- [tools](/Users/pwx/github/pete-gov/rules/tools)
  Bun and TypeScript tooling for tests, fixes, and generated summaries.
- [RULES.md](/Users/pwx/github/pete-gov/rules/RULES.md:1)
  A generated summary of the current FRR processes.

## Current Dataset Shape

The top-level dataset has four sections:

- `info`
  File-level metadata such as title, description, version, and `last_updated`.
- `FRD`
  FedRAMP Definitions.
- `FRR`
  FedRAMP Rules documents, including requirements and recommendations.
- `KSI`
  Key Security Indicators.

At the moment, the dataset contains:

- 57 FRD definitions
- 12 FRR process documents
- 46 KSI indicators across 10 KSI themes

The current FRR process set is:

- `CCM` Collaborative Continuous Monitoring
- `CDS` Certification Data Sharing
- `FRC` FedRAMP Certification
- `FSI` FedRAMP Security Inbox
- `ICP` Incident Communications Procedures
- `MAS` Minimum Assessment Scope
- `MKT` Marketplace Listing
- `PVA` Persistent Validation and Assessment
- `SCG` Secure Configuration Guide
- `SCN` Significant Change Notifications
- `UCM` Using Cryptographic Modules
- `VDR` Vulnerability Detection and Response

The current KSI theme set is:

- `CED` Cybersecurity Education
- `CMT` Change Management
- `CNA` Cloud Native Architecture
- `IAM` Identity and Access Management
- `INR` Incident Response
- `MLA` Monitoring, Logging, and Auditing
- `PIY` Policy and Inventory
- `RPL` Recovery Planning
- `SCR` Supply Chain Risk
- `SVC` Service Configuration

## Repository Model

The data model is intentionally opinionated. The schema does not just allow
"some JSON"; it tries to preserve a specific structure that is stable enough
for downstream automation.

Some of the main modeling choices are:

- each FRR document and KSI theme uses compact stable identifiers
- FRD, FRR, and KSI entries use strongly patterned IDs such as `FRD-XXX`,
  `ABC-DEF-123`, and `KSI-ABC-123`
- applicability is modeled explicitly through `both`, `20x`, and `rev5`
  containers rather than inferred from text
- FRR document metadata requires `effective` entries for both `20x` and `rev5`
- `effective` and metadata can now capture dates, status, signup URLs, warnings,
  comments, and class-specific applicability
- FRR requirements and KSI indicators can be single-statement entries or
  `varies_by_class` entries


## FRD, FRR, and KSI At a Glance

### FRD

`FRD` is the controlled vocabulary for the rest of the repository.

Definitions typically include:

- `term`
- `definition`
- `alts`
- optional notes and references
- structured `updated` history

The tooling uses FRD as the source of truth for term synchronization in FRR and
KSI content.

### FRR

`FRR` holds the process-oriented rules documents. Each FRR document contains:

- `info`
  Name, short name, web name, effective status, and front matter
- optional `labels`
  Structured label definitions such as `CSO`, `OCR`, `UTC`, and related scopes
- `data`
  The requirement tree organized by applicability and label

The requirement tree is intentionally layered:

1. applicability: `both`, `20x`, `rev5`
2. label bucket: actor or scope label such as `CSO` or `UTC`
3. requirement ID: a stable key such as `VDR-CSO-...`

Requirements can carry structured details such as:

- `statement`
- `primary_key_word`
- `varies_by_class`
- `affects`
- `following_information`
- `examples`
- `timeframe_type` and `timeframe_num`
- `notification`
- `controls`
- `terms`
- `updated`

### KSI

`KSI` captures security indicators using a similarly structured model.

Indicators include:

- stable indicator IDs
- `name`
- `statement` or `varies_by_class`
- `controls`
- optional references
- `terms`
- `updated`

KSI is meant to support a more structured security-capability view than the FRR
documents alone.

## Effective Metadata

One of the more important current modeling areas is the `info.effective`
structure used by FRD and FRR documents.

Each document records explicit `20x` and `rev5` entries, and each entry can
capture:

- whether the document `is` required, optional, or not applicable
- current status text
- obtain, maintain, and grace-end dates
- comments or warnings
- signup URLs when relevant
- class-specific applicability metadata

For some FRR documents, the schema now supports `class` tracking for classes
`a`, `b`, `c`, and `d`, including whether a class applies in full or only to a
listed subset of requirement IDs.

## Tooling

The supported command model for repository maintenance is:

- `bun run test`
- `bun run fix`
- `bun run summary`

The tooling lives under [tools](/Users/pwx/github/pete-gov/rules/tools), with
shared implementation under `tools/src`.

At a high level:

- `bun run test`
  Verifies schema correctness, ID alignment, keyword consistency, term
  synchronization, property ordering, and tool behavior
- `bun run fix`
  Applies the fixable normalizations
- `bun run summary`
  Regenerates derived outputs such as [RULES.md](/Users/pwx/github/pete-gov/rules/RULES.md:1)

For the detailed tooling reference, see
[tools/README.md](/Users/pwx/github/pete-gov/rules/tools/README.md:1).

## Canonical Paths

The canonical file paths used by the tooling are declared in
[tools/fedramp-rules.config.json](/Users/pwx/github/pete-gov/rules/tools/fedramp-rules.config.json:1).

That configuration currently points the tools at:

- [fedramp-consolidated-rules.json](/Users/pwx/github/pete-gov/rules/fedramp-consolidated-rules.json:1)
- [schemas/fedramp-consolidated-rules.schema.json](/Users/pwx/github/pete-gov/rules/schemas/fedramp-consolidated-rules.schema.json:1)

## Repository Status

This repository is no longer just a placeholder for a future rules file. It now
contains:

- an actively developed consolidated rules dataset
- a strict schema that encodes the intended document model
- generated summary output
- a working Bun-based maintenance toolchain

It is still a working repository, but it already embodies substantial structure
and should be understood as the source-of-truth codebase for the machine-readable
rules work in progress.
