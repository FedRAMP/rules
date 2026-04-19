import { expect, test } from "bun:test";

import { loadRulesDocument } from "../src/rules";
import {
  TERM_UPDATE_COMMENT,
  applyDefinitionTermTitleChanges,
  applyTermSync,
  collectDefinitionTermTitleChanges,
  collectTermSyncChanges,
  toDefaultTitleCase,
} from "../src/terms";
import type { RulesDocument } from "../src/types";

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
        both: {
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
      location: "FRD.data.both.FRD-TLA",
      currentTerm: "Top-level administrative account",
      nextTerm: "Top-Level Administrative Account",
    },
  ]);
  expect(document.FRD.data.both["FRD-TLA"].term).toBe("Top-Level Administrative Account");
  expect(document.FRD.data.both["FRD-TLA"].updated).toEqual([
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
        both: {
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
          both: {
            CSO: {
              "MAS-CSO-TST": {
                name: "Test requirement",
                affects: ["Providers"],
                statement: "Providers MUST notify an agency.",
                primary_key_word: "MUST",
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
  expect(document.FRR.MAS.data.both.CSO["MAS-CSO-TST"].terms).toEqual(["Agency"]);
  expect(document.FRR.MAS.data.both.CSO["MAS-CSO-TST"].updated).toEqual([
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
        both: {
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
          both: {
            CSO: {
              "MAS-CSO-TST": {
                name: "Test requirement",
                affects: ["Providers"],
                statement: "Providers MUST notify an agency.",
                primary_key_word: "MUST",
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
  expect(document.FRR.MAS.data.both.CSO["MAS-CSO-TST"].updated).toEqual([
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
        both: {
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
          both: {
            CSO: {
              "MAS-CSO-TST": {
                name: "Test requirement",
                affects: ["Providers"],
                statement: "Providers MUST notify an agency.",
                primary_key_word: "MUST",
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
  expect(document.FRR.MAS.data.both.CSO["MAS-CSO-TST"].updated).toEqual([
    {
      date: "2026-04-12",
      comment: `Reviewed wording. ${TERM_UPDATE_COMMENT}`,
    },
  ]);
});
