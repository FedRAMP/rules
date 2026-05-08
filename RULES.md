# FedRAMP Rules Summary

Generated from `fedramp-consolidated-rules.json` (version 2026.05.04.01-preview, last updated 2026-05-04).

`fedramp-consolidated-rules.json` is the source of truth for the Consolidated Rules for 2026 Public Preview. This file is generated for quick review; update the JSON and run `bun run summary` from `tools` to refresh it.

## Dataset Overview

- 67 FRD definitions
- 15 FRR process documents
- 222 FRR requirement records
- 10 KSI themes
- 46 KSI indicators

## FRR Process Summary

Requirement counts are the leaf records under each `FRR.*.data` tree. Keyword counts include top-level requirements and class-specific variants when a requirement uses `varies_by_class`.

| Short Name | Name | Document Status | Requirements | Rev5 Status | Rev5 Obtain | Rev5 Maintain | Rev5 Grace Ends | 20x Status | 20x Obtain | 20x Maintain | 20x Grace Ends | MUST | MUST NOT | SHOULD | SHOULD NOT | MAY | Most Recently Updated |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AGU | Agency Use of FedRAMP Certified Cloud Services (Needs Review) | placeholder | 24 | - | N/A | N/A | N/A | - | N/A | N/A | N/A | 13 | 1 | 9 | 0 | 1 | 2026-05-04 |
| CCM | Collaborative Continuous Monitoring | stable | 23 | Consolidated Rules for 2026 | 2027-01-01 | 2027-04-02 | 2027-10-01 | Consolidated Rules for 2026 | 2026-07-04 | 2027-01-01 | 2027-05-04 | 11 | 3 | 7 | 1 | 4 | 2026-05-04 |
| CDS | Certification Data Sharing | stable | 18 | Consolidated Rules for 2026 | 2027-01-01 | 2027-08-01 | 2028-02-01 | Consolidated Rules for 2026 | 2026-07-04 | 2027-01-01 | 2027-05-04 | 18 | 0 | 3 | 0 | 3 | 2026-05-04 |
| FRC | FedRAMP Certification | placeholder | 45 | Consolidated Rules for 2026 | 2027-01-01 | 2027-01-01 | 2027-01-01 | Consolidated Rules for 2026 | 2026-07-04 | 2027-05-04 | 2027-05-04 | 40 | 2 | 6 | 0 | 5 | 2026-05-04 |
| FSI | FedRAMP Security Inbox | stable | 16 | - | N/A | N/A | N/A | - | N/A | N/A | N/A | 13 | 0 | 2 | 0 | 1 | 2026-05-04 |
| IAP | Independent Assessment Plan | empty | 0 | Consolidated Rules for 2026 | 2027-01-01 | 2027-08-01 | 2028-02-01 | Consolidated Rules for 2026 | 2026-07-04 | 2027-01-01 | 2027-05-04 | 0 | 0 | 0 | 0 | 0 | - |
| IAR | Independent Assessment Report | empty | 0 | Consolidated Rules for 2026 | 2027-01-01 | 2027-08-01 | 2028-02-01 | Consolidated Rules for 2026 | 2026-07-04 | 2027-01-01 | 2027-05-04 | 0 | 0 | 0 | 0 | 0 | - |
| ICP | Incident Communications Procedures | placeholder | 10 | Consolidated Rules for 2026 | 2027-01-01 | 2027-01-01 | 2027-06-01 | Consolidated Rules for 2026 | 2026-07-04 | 2027-01-01 | 2027-05-04 | 14 | 0 | 2 | 0 | 0 | 2026-05-04 |
| MAS | Minimum Assessment Scope | stable | 5 | Consolidated Rules for 2026 | 2027-01-01 | 2027-01-01 | N/A | Consolidated Rules for 2026 | 2026-07-04 | 2027-01-01 | 2027-05-04 | 4 | 0 | 0 | 0 | 1 | 2026-05-04 |
| MKT | Marketplace Listing | placeholder | 14 | Consolidated Rules for 2026 | 2027-01-01 | 2027-01-01 | 2027-06-01 | Consolidated Rules for 2026 | 2026-07-04 | 2027-01-01 | 2027-05-04 | 13 | 1 | 0 | 0 | 0 | 2026-05-04 |
| SCG | Secure Configuration Guide | stable | 9 | - | N/A | N/A | N/A | - | N/A | N/A | N/A | 2 | 0 | 7 | 0 | 0 | 2026-05-04 |
| SCN | Significant Change Notifications | stable | 17 | Consolidated Rules for 2026 | 2027-01-01 | 2027-01-01 | 2027-06-01 | Consolidated Rules for 2026 | 2026-07-04 | 2027-01-01 | 2027-05-04 | 11 | 0 | 1 | 1 | 4 | 2026-05-04 |
| SDR | Security Decision Record | empty | 0 | Consolidated Rules for 2026 | 2027-01-01 | 2027-08-01 | 2028-02-01 | Consolidated Rules for 2026 | 2026-07-04 | 2027-01-01 | 2027-05-04 | 0 | 0 | 0 | 0 | 0 | - |
| UCM | Using Cryptographic Modules | placeholder | 3 | Consolidated Rules for 2026 | 2027-01-01 | 2027-01-01 | 2027-06-01 | Consolidated Rules for 2026 | 2026-07-04 | 2027-01-01 | 2027-05-04 | 2 | 0 | 2 | 0 | 2 | 2026-05-04 |
| VDR | Vulnerability Detection and Response | stable | 38 | Consolidated Rules for 2026 | 2027-01-01 | 2027-06-01 | 2028-01-01 | Consolidated Rules for 2026 | 2026-07-04 | 2027-01-01 | 2027-05-04 | 11 | 1 | 37 | 3 | 10 | 2026-05-04 |
