import { expect, test } from "bun:test";

import { loadRulesDocument } from "../src/rules";
import {
  TERM_UPDATE_COMMENT,
  applyDefinitionTermTitleChanges,
  applyTermSync,
  collectDefinitionTermTitleChanges,
  collectTermSyncChanges,
  toDefaultTitleCase,
  type TermSyncChange,
} from "../src/terms";
import type { RulesDocument } from "../src/types";

function createTermSyncDocument(ignoreInTerms?: boolean): RulesDocument {
  return {
    info: {
      title: "Test",
      description: "Test",
      version: "1.0.0",
      last_updated: "2026-09-13",
    },
    FRD: {
      info: {},
      data: {
        all: {
          "FRD-MST": {
            term: "MUST",
            alts: ["required"],
            ...(ignoreInTerms === undefined
              ? {}
              : { ignore_in_terms: ignoreInTerms }),
            definition: "Test definition",
          },
          "FRD-AGY": {
            term: "Agency",
            definition: "Test definition",
          },
          "FRD-PVD": {
            term: "Provider",
            alts: ["providers"],
            ignore_in_terms: false,
            definition: "Test definition",
          },
        },
      },
    },
    FRR: {
      MAS: {
        info: {},
        data: {
          all: {
            CSO: {
              "MAS-CSO-TST": {
                name: "Test requirement",
                affects: ["Providers"],
                statement: "Providers MUST notify an agency.",
                force: "MUST",
                terms: [],
              },
            },
          },
        },
      },
    },
    KSI: {
      IAM: {
        id: "KSI-IAM",
        name: "Test theme",
        web_name: "Test theme",
        short_name: "Test",
        theme: "Test",
        indicators: {
          "KSI-IAM-TST": {
            name: "Test indicator",
            varies_by_class: {
              b: { statement: "Providers are required to notify an agency." },
              c: { statement: "Providers are required to notify an agency." },
            },
            terms: [],
          },
        },
      },
    },
  };
}

test.each([
  ["absent", undefined],
  ["false", false],
  ["true", true],
] as const)("term sync honors ignore_in_terms=%s for terms and aliases", (_, ignoreInTerms) => {
  const document = createTermSyncDocument(ignoreInTerms);
  const expectedTerms = ignoreInTerms === true
    ? ["Agency", "Provider"]
    : ["Agency", "MUST", "Provider"];
  const expectedChanges: TermSyncChange[] = [
    {
      id: "MAS-CSO-TST",
      location: "FRR.MAS.data.all.CSO.MAS-CSO-TST",
      kind: "requirement",
      currentTerms: [],
      nextTerms: expectedTerms,
    },
    {
      id: "KSI-IAM-TST",
      location: "KSI.IAM.indicators.KSI-IAM-TST",
      kind: "indicator",
      currentTerms: [],
      nextTerms: expectedTerms,
    },
  ];
  const original = structuredClone(document);

  expect(collectTermSyncChanges(document)).toEqual(expectedChanges);
  expect(document).toEqual(original);
  expect(applyTermSync(document)).toEqual(expectedChanges);
  expect(collectTermSyncChanges(document)).toEqual([]);
  expect(applyTermSync(document)).toEqual([]);
});

test.each(["all", "20x", "rev5"])("term sync removes ignored definitions from %s even when their text still matches", (scope) => {
  const document = createTermSyncDocument(true);
  const definitions = document.FRD.data.all!;
  document.FRD.data = { [scope]: definitions };
  const requirement = document.FRR.MAS!.data.all!.CSO!["MAS-CSO-TST"]!;
  const indicator = Object.values(document.KSI.IAM!.indicators)[0]!;
  requirement.terms = ["Agency", "MUST", "Provider"];
  indicator.varies_by_class = {
    b: { statement: "This behavior is required." },
    c: { statement: "This behavior is required." },
  };
  indicator.terms = ["MUST"];

  const changes = collectTermSyncChanges(document);

  expect(changes).toHaveLength(2);
  expect(changes[0]!.nextTerms).toEqual(["Agency", "Provider"]);
  expect(changes[1]!.nextTerms).toEqual([]);
  expect(applyTermSync(document)).toEqual(changes);
  expect(requirement.terms).toEqual(["Agency", "Provider"]);
  expect(indicator.terms).toEqual([]);
  expect(collectTermSyncChanges(document)).toEqual([]);
});

test("all FRD terms use the default title casing", () => {
  const changes = collectDefinitionTermTitleChanges(loadRulesDocument());
  expect(changes).toEqual([]);
});

test("all terms arrays match the structured term extraction rules", () => {
  const changes = collectTermSyncChanges(loadRulesDocument());
  expect(changes).toEqual([]);
});

test("default title casing capitalizes title words while preserving intentional mixed case", () => {
  expect(toDefaultTitleCase("Top-level administrative account")).toBe("Top-Level Administrative Account");
  expect(toDefaultTitleCase("FedRAMP Security Inbox")).toBe("FedRAMP Security Inbox");
});

test("definition title fixes update the term without appending to updated history", () => {
  const document: RulesDocument = {
    info: {
      title: "Test",
      description: "Test",
      version: "1.0.0",
      last_updated: "2026-04-12",
    },
    FRD: {
      info: {},
      data: {
        all: {
          "FRD-TLA": {
            term: "Top-level administrative account",
            definition: "Test definition",
            updated: [
              {
                date: "2026-02-04",
                comment: "Existing note.",
              },
            ],
          },
        },
      },
    },
    FRR: {},
    KSI: {},
  };

  const changes = applyDefinitionTermTitleChanges(document);

  expect(changes).toEqual([
    {
      id: "FRD-TLA",
      location: "FRD.data.all.FRD-TLA",
      currentTerm: "Top-level administrative account",
      nextTerm: "Top-Level Administrative Account",
    },
  ]);
  expect(document.FRD.data.all!["FRD-TLA"]!.term).toBe("Top-Level Administrative Account");
  expect(document.FRD.data.all!["FRD-TLA"]!.updated).toEqual([
    {
      date: "2026-02-04",
      comment: "Existing note.",
    },
  ]);
});

test("term sync updates terms without appending to updated history by default", () => {
  const document: RulesDocument = {
    info: {
      title: "Test",
      description: "Test",
      version: "1.0.0",
      last_updated: "2026-04-12",
    },
    FRD: {
      info: {},
      data: {
        all: {
          "FRD-AGY": {
            term: "Agency",
            definition: "Test definition",
            alts: ["agency"],
          },
        },
      },
    },
    FRR: {
      MAS: {
        info: {},
        data: {
          all: {
            CSO: {
              "MAS-CSO-TST": {
                name: "Test requirement",
                affects: ["Providers"],
                statement: "Providers MUST notify an agency.",
                force: "MUST",
                terms: [],
                updated: [
                  {
                    date: "2026-02-04",
                    comment: "Existing note.",
                  },
                ],
              },
            },
          },
        },
      },
    },
    KSI: {},
  };

  const changes = applyTermSync(document, { entryDate: "2026-04-12" });

  expect(changes).toHaveLength(1);
  expect(document.FRR.MAS!.data.all!.CSO!["MAS-CSO-TST"]!.terms).toEqual(["Agency"]);
  expect(document.FRR.MAS!.data.all!.CSO!["MAS-CSO-TST"]!.updated).toEqual([
    {
      date: "2026-02-04",
      comment: "Existing note.",
    },
  ]);
});

test("term sync prepends an updated entry when comment mode is enabled", () => {
  const document: RulesDocument = {
    info: {
      title: "Test",
      description: "Test",
      version: "1.0.0",
      last_updated: "2026-04-12",
    },
    FRD: {
      info: {},
      data: {
        all: {
          "FRD-AGY": {
            term: "Agency",
            definition: "Test definition",
            alts: ["agency"],
          },
        },
      },
    },
    FRR: {
      MAS: {
        info: {},
        data: {
          all: {
            CSO: {
              "MAS-CSO-TST": {
                name: "Test requirement",
                affects: ["Providers"],
                statement: "Providers MUST notify an agency.",
                force: "MUST",
                terms: [],
                updated: [
                  {
                    date: "2026-02-04",
                    comment: "Existing note.",
                  },
                ],
              },
            },
          },
        },
      },
    },
    KSI: {},
  };

  const changes = applyTermSync(document, { addComment: true, entryDate: "2026-04-12" });

  expect(changes).toHaveLength(1);
  expect(document.FRR.MAS!.data.all!.CSO!["MAS-CSO-TST"]!.updated).toEqual([
    {
      date: "2026-04-12",
      comment: TERM_UPDATE_COMMENT,
    },
    {
      date: "2026-02-04",
      comment: "Existing note.",
    },
  ]);
});

test("term sync appends to an existing comment when comment mode is enabled and the same date is already present", () => {
  const document: RulesDocument = {
    info: {
      title: "Test",
      description: "Test",
      version: "1.0.0",
      last_updated: "2026-04-12",
    },
    FRD: {
      info: {},
      data: {
        all: {
          "FRD-AGY": {
            term: "Agency",
            definition: "Test definition",
            alts: ["agency"],
          },
        },
      },
    },
    FRR: {
      MAS: {
        info: {},
        data: {
          all: {
            CSO: {
              "MAS-CSO-TST": {
                name: "Test requirement",
                affects: ["Providers"],
                statement: "Providers MUST notify an agency.",
                force: "MUST",
                terms: [],
                updated: [
                  {
                    date: "2026-04-12",
                    comment: "Reviewed wording.",
                  },
                ],
              },
            },
          },
        },
      },
    },
    KSI: {},
  };

  const changes = applyTermSync(document, { addComment: true, entryDate: "2026-04-12" });

  expect(changes).toHaveLength(1);
  expect(document.FRR.MAS!.data.all!.CSO!["MAS-CSO-TST"]!.updated).toEqual([
    {
      date: "2026-04-12",
      comment: `Reviewed wording. ${TERM_UPDATE_COMMENT}`,
    },
  ]);
});
