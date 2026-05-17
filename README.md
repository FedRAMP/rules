# FedRAMP Consolidated Rules

This repository contains the machine-readable FedRAMP Consolidated Rules for
the 2026 Public Preview.

The source of truth is:

- [fedramp-consolidated-rules.json](fedramp-consolidated-rules.json)
- [schemas/fedramp-consolidated-rules.schema.json](schemas/fedramp-consolidated-rules.schema.json)

Everything else in this repository supports those two files.

## What Is Here

- [fedramp-consolidated-rules.json](fedramp-consolidated-rules.json)
  The canonical rules dataset.
- [schemas/fedramp-consolidated-rules.schema.json](schemas/fedramp-consolidated-rules.schema.json)
  The schema for the dataset.
- [RULES.md](RULES.md)
  A generated summary of the current FRR process documents.
- [AGENTS.md](AGENTS.md)
  Guidance for AI agents analyzing the dataset.
- [tools](tools)
  Validation, normalization, tests, and generated summary tooling.

## Working With The Repository

Use the JSON file and schema for analysis. Use generated documentation only for
orientation.

From [tools](tools), the primary maintenance commands are:

```bash
bun run check
bun run fix
bun run summary
```

See [tools/README.md](tools/README.md) for the tooling workflow and
[AGENTS.md](AGENTS.md) for agent-focused analysis guidance.
