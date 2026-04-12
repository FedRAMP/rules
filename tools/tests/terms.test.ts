import { expect, test } from "bun:test";

import { loadRulesDocument } from "../src/rules";
import { applyTermSync, collectTermSyncChanges } from "../src/terms";
import type { RulesDocument } from "../src/types";

test("all terms arrays match the structured term extraction rules", () => {
  const changes = collectTermSyncChanges(loadRulesDocument());
  expect(changes).toEqual([]);
});

test("term sync prepends an updated entry when the date is not already present", () => {
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
  expect(document.FRR.MAS.data.both.CSO["MAS-CSO-TST"].updated).toEqual([
    {
      date: "2026-04-12",
      comment: "Updated the related terms.",
    },
    {
      date: "2026-02-04",
      comment: "Existing note.",
    },
  ]);
});

test("term sync appends to an existing comment when the same updated date is already present", () => {
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

  const changes = applyTermSync(document, { entryDate: "2026-04-12" });

  expect(changes).toHaveLength(1);
  expect(document.FRR.MAS.data.both.CSO["MAS-CSO-TST"].updated).toEqual([
    {
      date: "2026-04-12",
      comment: "Reviewed wording. Updated the related terms.",
    },
  ]);
});
