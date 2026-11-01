import { expect, test } from "bun:test";
import { validateSchema } from "../src/schema-validation";
import type {
  ControlData,
  KsiIndicator,
  KsiTheme,
  Requirement,
  RulesDocument,
} from "../src/types";

// Compile-time regressions: these must not become accepted public shapes again.
type Assert<T extends true> = T;
type TypeContracts = [
  Assert<"force" extends keyof KsiIndicator ? false : true>,
  Assert<"theme" extends keyof KsiTheme ? false : true>,
  Assert<{} extends Pick<KsiTheme, "status"> ? false : true>,
  Assert<KsiIndicator[] extends KsiTheme["indicators"] ? false : true>,
  Assert<
    "a" extends keyof NonNullable<ControlData["varies_by_class"]> ? false : true
  >,
  Assert<{} extends NonNullable<Requirement["varies_by_class"]> ? false : true>,
  Assert<
    { b: { statement: string } } extends NonNullable<
      KsiIndicator["varies_by_class"]
    >
      ? false
      : true
  >,
];

test("typed definitions, class variants, artifacts, metadata, and controls satisfy the local schema", () => {
  const updated = [
    {
      date: "2026-10-31",
      comment: "Fixture",
      issue: "https://example.com/issues/1",
    },
  ];
  const document: RulesDocument = {
    info: {
      title: "Test",
      description: "Typed fixture",
      version: "1",
      last_updated: "2026-10-31",
      default_artifacts: { FRR: [], KSI: [] },
    },
    FRD: {
      info: {
        name: "Definitions",
        short_name: "FRD",
        web_name: "definitions",
        purpose: "Test",
        status: "stable",
        effective: { is: "required" },
      },
      data: {
        all: {
          "FRD-TST": {
            term: "Test",
            definition: "A test",
            alts: [],
            do_not_link: true,
            updated,
          },
        },
      },
    },
    FRR: {
      TST: {
        info: {
          name: "Rules",
          short_name: "TST",
          web_name: "rules",
          purpose: "Test",
          status: "stable",
          "20x": { effective: { is: "required" } },
          rev5: { effective: { is: "optional" } },
        },
        data: {
          all: {
            CSO: {
              "TST-CSO-ONE": {
                name: "Single",
                statement: "Providers MUST act.",
                force: "MUST",
                affects: ["Providers"],
                timeframe_type: "days",
                timeframe_num_min: 1,
                timeframe_num_max: 2,
                artifacts: { all: ["Evidence"] },
                updated,
              },
              "TST-CSO-TWO": {
                name: "Variants",
                affects: ["Providers"],
                updated,
                varies_by_class: {
                  b: {
                    statement: "Providers MUST act.",
                    force: "MUST",
                    rev5_controls_list: { AC: ["AC-01"] },
                    artifacts: { rev5: ["Evidence"] },
                  },
                  c: {
                    statement: "Providers MUST act.",
                    force: "MUST",
                    timeframe_type: "days",
                    timeframe_num: 1,
                  },
                },
              },
            },
          },
        },
      },
    },
    KSI: {
      TST: {
        id: "KSI-TST",
        name: "Test",
        web_name: "test",
        short_name: "TST",
        status: "stable",
        indicators: {
          "KSI-TST-ONE": {
            name: "Indicator",
            statement: "A capability.",
            controls: [],
            updated,
          },
          "KSI-TST-TWO": {
            name: "Variants",
            controls: [],
            updated,
            varies_by_class: {
              b: {
                statement: "A capability.",
                artifacts: { "20x": ["Evidence"] },
              },
              c: { statement: "A capability." },
            },
          },
        },
      },
    },
    CTL: {
      AC: {
        "AC-01": {
          guidance: ["Guidance"],
          varies_by_class: {
            b: { parameters: [{ parameterId: "p1", value: "value" }] },
          },
          updated,
        },
      },
    },
  };
  const result = validateSchema(document);
  expect(result.humanReadableErrors).toEqual([]);
  expect(result.valid).toBe(true);
});
