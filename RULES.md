# FedRAMP Rules Summary

Generated from `fedramp-consolidated-rules.json` (version 2026.05.22.01-preview, last updated 2026-05-22).

`fedramp-consolidated-rules.json` is the source of truth for the Consolidated Rules for 2026 Public Preview. This file is generated for quick review; update the JSON and run `bun run build` from `tools` to refresh it.

## Dataset Overview

- 67 FRD definitions
- 16 FRR process documents
- 232 FRR requirement records
- 10 KSI themes
- 46 KSI indicators

## FRR Process Summary

Requirement counts are the leaf records under each `FRR.*.data` tree. Keyword counts include top-level requirements and class-specific variants when a requirement uses `varies_by_class`.

| Short Name | Name | Document Status | Requirements | Rev5 Obtain | Rev5 Maintain | Rev5 Grace Ends | 20x Obtain | 20x Maintain | 20x Grace Ends | MUST | MUST NOT | SHOULD | SHOULD NOT | MAY | Most Recently Updated |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AGU | Agency Use of FedRAMP Certified Cloud Services (Needs Review) | placeholder | 18 | 2026-07-04 | 2026-07-04 | 2026-07-04 | 2026-07-04 | 2026-07-04 | 2026-07-04 | 10 | 1 | 7 | 0 | 0 | 2026-05-04 |
| CCM | Collaborative Continuous Monitoring | stable | 23 | 2027-01-01 | 2027-04-02 | 2027-10-01 | 2026-07-04 | 2027-01-01 | 2027-05-04 | 11 | 3 | 7 | 1 | 4 | 2026-05-04 |
| CDS | Certification Data Sharing | stable | 20 | 2027-01-01 | 2027-08-01 | 2028-02-01 | 2026-07-04 | 2027-01-01 | 2027-05-04 | 21 | 0 | 4 | 0 | 4 | 2026-05-04 |
| FRC | FedRAMP Certification | placeholder | 45 | 2027-01-01 | 2027-01-01 | 2027-01-01 | 2026-07-04 | 2027-05-04 | 2027-05-04 | 40 | 2 | 6 | 0 | 5 | 2026-05-04 |
| FSI | FedRAMP Security Inbox | stable | 16 | 2026-01-05 | 2026-01-05 | 2026-07-01 | 2026-01-05 | 2026-01-05 | 2026-07-01 | 13 | 0 | 2 | 0 | 1 | 2026-05-04 |
| IAP | Independent Assessment Plan | empty | 0 | 2027-01-01 | 2027-08-01 | 2028-02-01 | 2026-07-04 | 2027-01-01 | 2027-05-04 | 0 | 0 | 0 | 0 | 0 | - |
| IAR | Independent Assessment Report | empty | 0 | 2027-01-01 | 2027-08-01 | 2028-02-01 | 2026-07-04 | 2027-01-01 | 2027-05-04 | 0 | 0 | 0 | 0 | 0 | - |
| ICP | Incident Communications Procedures | placeholder | 8 | 2027-01-01 | 2027-01-01 | 2027-06-01 | 2026-07-04 | 2027-01-01 | 2027-05-04 | 13 | 0 | 4 | 0 | 0 | 2026-05-04 |
| MAS | Minimum Assessment Scope | stable | 5 | 2027-01-01 | 2027-01-01 | N/A | 2026-07-04 | 2027-01-01 | 2027-05-04 | 4 | 0 | 0 | 0 | 1 | 2026-05-04 |
| MKT | Marketplace Listing | placeholder | 14 | 2027-01-01 | 2027-01-01 | 2027-06-01 | 2026-07-04 | 2027-01-01 | 2027-05-04 | 13 | 1 | 0 | 0 | 0 | 2026-05-04 |
| REC | FedRAMP Recognition of Independent Assessment Services | placeholder | 16 | 2026-07-04 | 2026-07-04 | 2026-07-04 | 2026-07-04 | 2026-07-04 | 2026-07-04 | 13 | 3 | 0 | 0 | 0 | 2026-05-04 |
| SCG | Secure Configuration Guide | stable | 9 | 2026-03-01 | 2026-03-01 | 2026-07-01 | 2026-03-01 | 2026-03-01 | 2026-07-01 | 2 | 0 | 7 | 0 | 0 | 2026-05-04 |
| SCN | Significant Change Notifications | stable | 17 | 2027-01-01 | 2027-01-01 | 2027-06-01 | 2026-07-04 | 2027-01-01 | 2027-05-04 | 11 | 0 | 1 | 1 | 4 | 2026-05-04 |
| SDR | Security Decision Record | empty | 0 | 2027-01-01 | 2027-08-01 | 2028-02-01 | 2026-07-04 | 2027-01-01 | 2027-05-04 | 0 | 0 | 0 | 0 | 0 | - |
| UCM | Using Cryptographic Modules | placeholder | 3 | 2027-01-01 | 2027-01-01 | 2027-06-01 | 2026-07-04 | 2027-01-01 | 2027-05-04 | 2 | 0 | 2 | 0 | 2 | 2026-05-04 |
| VDR | Vulnerability Detection and Response | stable | 38 | 2027-01-01 | 2027-06-01 | 2028-01-01 | 2026-07-04 | 2027-01-01 | 2027-05-04 | 11 | 1 | 37 | 3 | 10 | 2026-05-04 |
