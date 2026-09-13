# FedRAMP Consolidated Rules

This repository contains the machine-readable FedRAMP Consolidated Rules for
2026. Use it to read, analyze, and integrate structured definitions, process
rules, and security indicators.

## Repository Contents

- [fedramp-consolidated-rules.json](fedramp-consolidated-rules.json) is the
  canonical rules dataset. It contains dataset metadata (`info`), FedRAMP
  Definitions (`FRD`), FedRAMP Rules (`FRR`), Key Security Indicators (`KSI`),
  and control guidance and parameters (`CTL`, an optional schema section).
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
validation, normalization, tests, exports, and Git hooks. Maintenance agents
must also follow [tools/AGENTS-TOOLS.md](tools/AGENTS-TOOLS.md).
