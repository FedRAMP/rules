import { expect, test } from "bun:test";

import {
  collectConsistencyChecks,
  collectFrr20xSubsetApplicabilityWarnings,
  collectFrrSubsetApplicabilityAffectsIssues,
  collectFrrSubsetDeclarationIssues,
  collectInlineRuleDisplayNameIssues,
  collectRelatedRuleReferenceIssues,
  formatConsistencyReport,
} from "../src/consistency";
import { loadRulesDocument } from "../src/rules";
import type { RulesDocument } from "../src/types";

test("consistency validation report", () => {
  const checks = collectConsistencyChecks(loadRulesDocument());

  if (checks.some((check) => check.issues.length > 0)) {
    throw new Error(formatConsistencyReport(checks));
  }
});

test("FRR subset declarations include certification-specific info subsets", () => {
  const document = {
    FRR: {
      ABC: {
        info: {
          subsets: {
            CSO: { name: "Common", description: "Common subset." },
          },
          "20x": {
            subsets: {
              CSX: { name: "20x", description: "20x subset." },
            },
          },
          rev5: {
            subsets: {
              CSF: { name: "Rev5", description: "Rev5 subset." },
            },
          },
        },
        data: {
          all: {
            CSO: {},
          },
          "20x": {
            CSO: {},
            CSX: {},
          },
          rev5: {
            CSO: {},
            CSF: {},
          },
        },
      },
    },
  } as unknown as RulesDocument;

  expect(collectFrrSubsetDeclarationIssues(document)).toEqual([]);
});

test("FRR subset applicability affects match corresponding requirement affects", () => {
  const document = {
    FRR: {
      ABC: {
        info: {
          subsets: {
            FRP: {
              name: "FedRAMP",
              description: "FedRAMP subset.",
              applicability: {
                types: ["20x", "Rev5"],
                paths: ["Program", "Agency"],
                classes: ["A", "B", "C", "D"],
                affects: ["Providers"],
              },
            },
          },
        },
        data: {
          all: {
            FRP: {
              "ABC-FRP-AAA": {
                name: "FedRAMP Rule",
                statement: "FedRAMP MUST do the thing.",
                primary_key_word: "MUST",
                affects: ["FedRAMP"],
              },
            },
          },
          rev5: {
            FRP: {
              "ABC-FRP-BBB": {
                name: "Agency Rule",
                statement: "Agencies MUST do the thing.",
                primary_key_word: "MUST",
                affects: ["Agencies"],
              },
            },
          },
        },
      },
    },
  } as unknown as RulesDocument;

  expect(collectFrrSubsetApplicabilityAffectsIssues(document)).toEqual([
    {
      location: "FRR.ABC.info.subsets.FRP.applicability.affects",
      message:
        "applicability.affects must match corresponding requirement affects arrays. " +
        "Expected: Agencies, FedRAMP; found: Providers.",
    },
  ]);

  (document.FRR.ABC!.info as any).subsets.FRP.applicability.affects = [
    "Agencies",
    "FedRAMP",
  ];

  expect(collectFrrSubsetApplicabilityAffectsIssues(document)).toEqual([]);
});

test("FRR subset applicability affects require a populated affects array when rules exist", () => {
  const document = {
    FRR: {
      ABC: {
        info: {
          subsets: {
            FRP: {
              name: "FedRAMP",
              description: "FedRAMP subset.",
              applicability: {
                types: ["20x", "Rev5"],
                paths: ["Program", "Agency"],
                classes: ["A", "B", "C", "D"],
                affects: [],
              },
            },
          },
        },
        data: {
          all: {
            FRP: {
              "ABC-FRP-AAA": {
                name: "FedRAMP Rule",
                statement: "FedRAMP MUST do the thing.",
                primary_key_word: "MUST",
                affects: ["FedRAMP"],
              },
            },
          },
        },
      },
    },
  } as unknown as RulesDocument;

  expect(collectFrrSubsetApplicabilityAffectsIssues(document)).toEqual([
    {
      location: "FRR.ABC.info.subsets.FRP.applicability.affects",
      message:
        "applicability.affects must list every party used by corresponding requirement affects arrays. " +
        "Expected: FedRAMP.",
    },
  ]);
});

test("X-suffix FRR subsets warn unless they are 20x Program only", () => {
  const document = {
    FRR: {
      ABC: {
        info: {
          subsets: {
            CSX: {
              name: "20x Provider",
              description: "20x subset.",
              applicability: {
                types: ["20x", "Rev5"],
                paths: ["Program", "Agency"],
                classes: ["A", "B", "C", "D"],
                affects: ["Providers"],
              },
            },
          },
        },
        data: {},
      },
    },
  } as unknown as RulesDocument;

  expect(collectFrr20xSubsetApplicabilityWarnings(document)).toEqual([
    {
      location: "FRR.ABC.info.subsets.CSX.applicability.types",
      message:
        "20x-specific subset warning: subset CSX ends in X, so applicability.types should only include 20x; found: 20x, Rev5.",
    },
    {
      location: "FRR.ABC.info.subsets.CSX.applicability.paths",
      message:
        "20x-specific subset warning: subset CSX ends in X, so applicability.paths should only include Program; found: Program, Agency.",
    },
  ]);

  (document.FRR.ABC!.info as any).subsets.CSX.applicability.types = ["20x"];
  (document.FRR.ABC!.info as any).subsets.CSX.applicability.paths = ["Program"];

  expect(collectFrr20xSubsetApplicabilityWarnings(document)).toEqual([]);
});

test("related rule references cover inline FRR IDs in requirement text fields", () => {
  const document = {
    FRR: {
      ABC: {
        data: {
          all: {
            CSO: {
              "ABC-CSO-AAA": {
                name: "Source Rule",
                statement: "Providers MUST follow ABC-CSO-BBB.",
                note: "Also see ABC-CSO-CCC.",
                notes: [
                  "This note has no rule mention.",
                  "Coordinate with ABC-CSO-DDD.",
                ],
                following_information: ["Map the outcome to ABC-CSO-EEE."],
                following_information_bullets: [
                  "Escalate when ABC-CSO-FFF applies.",
                ],
                primary_key_word: "MUST",
                affects: ["Providers"],
              },
              "ABC-CSO-BBB": {
                name: "Target Rule B",
                statement: "Providers MUST do the thing.",
                primary_key_word: "MUST",
                affects: ["Providers"],
              },
              "ABC-CSO-CCC": {
                name: "Target Rule C",
                statement: "Providers MUST do the other thing.",
                primary_key_word: "MUST",
                affects: ["Providers"],
              },
              "ABC-CSO-DDD": {
                name: "Target Rule D",
                statement: "Providers MUST do the final thing.",
                primary_key_word: "MUST",
                affects: ["Providers"],
              },
              "ABC-CSO-EEE": {
                name: "Target Rule E",
                statement: "Providers MUST document the outcome.",
                primary_key_word: "MUST",
                affects: ["Providers"],
              },
              "ABC-CSO-FFF": {
                name: "Target Rule F",
                statement: "Providers MUST escalate the outcome.",
                primary_key_word: "MUST",
                affects: ["Providers"],
              },
              "ABC-CSO-GGG": {
                name: "Target Rule G",
                statement: "Providers MUST preserve the outcome.",
                primary_key_word: "MUST",
                affects: ["Providers"],
              },
            },
          },
        },
      },
    },
  } as unknown as RulesDocument;

  expect(collectRelatedRuleReferenceIssues(document)).toEqual([
    {
      location: "FRR.ABC.data.all.CSO.ABC-CSO-AAA.related",
      message:
        "related must be an array containing mentioned FRR requirement IDs: " +
        "ABC-CSO-BBB in FRR.ABC.data.all.CSO.ABC-CSO-AAA.statement; " +
        "ABC-CSO-CCC in FRR.ABC.data.all.CSO.ABC-CSO-AAA.note; " +
        "ABC-CSO-DDD in FRR.ABC.data.all.CSO.ABC-CSO-AAA.notes[1]; " +
        "ABC-CSO-EEE in FRR.ABC.data.all.CSO.ABC-CSO-AAA.following_information[0]; " +
        "ABC-CSO-FFF in FRR.ABC.data.all.CSO.ABC-CSO-AAA.following_information_bullets[0].",
    },
  ]);

  const sourceRequirement = document.FRR.ABC?.data.all?.CSO?.["ABC-CSO-AAA"];
  expect(sourceRequirement).toBeDefined();
  if (!sourceRequirement) {
    throw new Error("expected source requirement fixture to exist");
  }

  sourceRequirement.related = [
    "ABC-CSO-BBB",
    "ABC-CSO-CCC",
    "ABC-CSO-EEE",
    "ABC-CSO-FFF",
  ];

  expect(collectRelatedRuleReferenceIssues(document)).toEqual([
    {
      location: "FRR.ABC.data.all.CSO.ABC-CSO-AAA.related",
      message:
        "related is missing mentioned FRR requirement IDs: " +
        "ABC-CSO-DDD in FRR.ABC.data.all.CSO.ABC-CSO-AAA.notes[1].",
    },
  ]);

  sourceRequirement.related = [
    "ABC-CSO-BBB",
    "ABC-CSO-CCC",
    "ABC-CSO-DDD",
    "ABC-CSO-EEE",
    "ABC-CSO-FFF",
  ];

  expect(collectRelatedRuleReferenceIssues(document)).toEqual([]);

  sourceRequirement.related.push("ABC-CSO-GGG");

  expect(collectRelatedRuleReferenceIssues(document)).toEqual([
    {
      location: "FRR.ABC.data.all.CSO.ABC-CSO-AAA.related[5]",
      message:
        "related ID ABC-CSO-GGG is not mentioned in statement, note, notes, following_information, " +
        "following_information_bullets, or varies_by_class text.",
    },
  ]);
});

test("related rule references cover class-specific statements and following information", () => {
  const document = {
    FRR: {
      ABC: {
        data: {
          all: {
            CSO: {
              "ABC-CSO-AAA": {
                name: "Source Rule",
                varies_by_class: {
                  b: {
                    statement:
                      "Providers with Class B MUST follow ABC-CSO-BBB.",
                    following_information: ["Document ABC-CSO-CCC evidence."],
                    primary_key_word: "MUST",
                  },
                  c: {
                    statement: "Providers with Class C MUST do the thing.",
                    primary_key_word: "MUST",
                  },
                },
                related: ["ABC-CSO-BBB"],
                affects: ["Providers"],
              },
              "ABC-CSO-BBB": {
                name: "Target Rule B",
                statement: "Providers MUST do the thing.",
                primary_key_word: "MUST",
                affects: ["Providers"],
              },
              "ABC-CSO-CCC": {
                name: "Target Rule C",
                statement: "Providers MUST document the evidence.",
                primary_key_word: "MUST",
                affects: ["Providers"],
              },
            },
          },
        },
      },
    },
  } as unknown as RulesDocument;

  expect(collectRelatedRuleReferenceIssues(document)).toEqual([
    {
      location: "FRR.ABC.data.all.CSO.ABC-CSO-AAA.related",
      message:
        "related is missing mentioned FRR requirement IDs: " +
        "ABC-CSO-CCC in FRR.ABC.data.all.CSO.ABC-CSO-AAA.varies_by_class.b.following_information[0].",
    },
  ]);
});

test("related rule references reject IDs that are not mentioned anywhere", () => {
  const document = {
    FRR: {
      ABC: {
        data: {
          all: {
            CSO: {
              "ABC-CSO-AAA": {
                name: "Source Rule",
                statement: "Providers MUST do the source thing.",
                related: ["ABC-CSO-BBB"],
                primary_key_word: "MUST",
                affects: ["Providers"],
              },
              "ABC-CSO-BBB": {
                name: "Unmentioned Rule",
                statement: "Providers MUST do the unmentioned thing.",
                primary_key_word: "MUST",
                affects: ["Providers"],
              },
            },
          },
        },
      },
    },
  } as unknown as RulesDocument;

  expect(collectRelatedRuleReferenceIssues(document)).toEqual([
    {
      location: "FRR.ABC.data.all.CSO.ABC-CSO-AAA.related[0]",
      message:
        "related ID ABC-CSO-BBB is not mentioned in statement, note, notes, following_information, " +
        "following_information_bullets, or varies_by_class text.",
    },
  ]);
});

test("inline rule IDs are followed by their rule names in parentheses", () => {
  const document = {
    FRR: {
      ABC: {
        data: {
          all: {
            CSO: {
              "ABC-CSO-AAA": {
                name: "Source Rule",
                statement:
                  "Providers MUST use ABC-CSO-BBB and ABC-CSO-CCC Target Rule C.",
                note: "ABC-CSO-DDD (Target Rule D) is already formatted.",
                primary_key_word: "MUST",
                affects: ["Providers"],
              },
              "ABC-CSO-BBB": {
                name: "Target Rule B",
                statement: "Providers MUST do the missing-name thing.",
                primary_key_word: "MUST",
                affects: ["Providers"],
              },
              "ABC-CSO-CCC": {
                name: "Target Rule C",
                statement: "Providers MUST do the unparenthesized-name thing.",
                primary_key_word: "MUST",
                affects: ["Providers"],
              },
              "ABC-CSO-DDD": {
                name: "Target Rule D",
                statement: "Providers MUST do the correctly formatted thing.",
                primary_key_word: "MUST",
                affects: ["Providers"],
              },
            },
          },
        },
      },
    },
  } as unknown as RulesDocument;

  expect(collectInlineRuleDisplayNameIssues(document)).toEqual([
    {
      location: "FRR.ABC.data.all.CSO.ABC-CSO-AAA.statement",
      message:
        "referenced FRR requirement ID ABC-CSO-BBB must be followed by its rule name in parentheses: " +
        "ABC-CSO-BBB (Target Rule B).",
    },
    {
      location: "FRR.ABC.data.all.CSO.ABC-CSO-AAA.statement",
      message:
        'referenced FRR requirement ID ABC-CSO-CCC is followed by "Target Rule C" without parentheses; ' +
        "use ABC-CSO-CCC (Target Rule C).",
    },
  ]);
});
