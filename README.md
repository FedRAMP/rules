# rules

This repository contains structured machine-readable rules for FedRAMP.

These rules previously lived in the [https://github.com/fedramp/docs](docs) repository
but we're moving them over to here to keep machine-readable rule management separate
from documentation.

This is a work in progress as of April 2026 as we push towards Consolidated Rules for
2026. Apologies for any related inconvenience.

The canonical dataset and schema locations are declared in
`/Users/pwx/github/pete-gov/rules/fedramp-rules.config.json`.

The tooling lives in `/Users/pwx/github/pete-gov/rules/tools` and now shares one
configuration-backed loading path for schema validation, ID alignment checks,
primary keyword validation, and terms synchronization.

