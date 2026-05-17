import { expect, test } from "bun:test";

import { collectArtifactApplicabilityIssues } from "../src/consistency";
import { cloneDocument, loadRulesDocument } from "../src/rules";

test("current artifact applicability keys match their containing data scope", () => {
  const issues = collectArtifactApplicabilityIssues(loadRulesDocument());

  expect(issues).toEqual([]);
});

test("artifact applicability permits all keys under both and matching keys under 20x or rev5", () => {
  const document = cloneDocument(loadRulesDocument());

  (document as any).FRR.CDS.data.both.CSO["CDS-CSO-PUB"].artifacts = {
    both: ["Both evidence."],
    "20x": ["20x evidence."],
    rev5: ["Rev5 evidence."],
  };
  (document as any).FRR.CDS.data.both.CSO[
    "CDS-CSO-PSM"
  ].varies_by_class.a.artifacts = {
    both: ["Both class evidence."],
    "20x": ["20x class evidence."],
    rev5: ["Rev5 class evidence."],
  };
  (document as any).FRR.FRC.data["20x"].CSX["FRC-CSX-MAS"].artifacts = {
    "20x": ["20x-only evidence."],
  };
  (document as any).FRR.CDS.data.rev5.CSL["CDS-CSL-SCD"].artifacts = {
    rev5: ["Rev5-only evidence."],
  };

  const issues = collectArtifactApplicabilityIssues(document);

  expect(issues).toEqual([]);
});

test("artifact applicability reports human-readable errors for mismatched keys", () => {
  const document = cloneDocument(loadRulesDocument());

  (document as any).FRR.FRC.data["20x"].CSX["FRC-CSX-MAS"].artifacts = {
    both: ["Wrong parent evidence."],
    "20x": ["Allowed evidence."],
    rev5: ["Wrong parent evidence."],
  };
  (document as any).FRR.FRC.data["20x"].CSX[
    "FRC-CSX-PMV"
  ].varies_by_class.b.artifacts = {
    rev5: ["Wrong class-level evidence."],
  };
  (document as any).FRR.CDS.data.rev5.CSL["CDS-CSL-SCD"].artifacts = {
    "20x": ["Wrong parent evidence."],
    rev5: ["Allowed evidence."],
  };
  (document as any).FRR.CDS.data.rev5.CSL[
    "CDS-CSL-SCD"
  ].varies_by_class.a.artifacts = {
    both: ["Wrong class-level evidence."],
  };

  const issues = collectArtifactApplicabilityIssues(document);

  expect(issues).toEqual([
    {
      location: "FRR.CDS.data.rev5.CSL.CDS-CSL-SCD.artifacts",
      message:
        "artifacts is inside data.rev5, so it may only use applicability keys: rev5. Found disallowed keys: 20x.",
    },
    {
      location:
        "FRR.CDS.data.rev5.CSL.CDS-CSL-SCD.varies_by_class.a.artifacts",
      message:
        "artifacts is inside data.rev5, so it may only use applicability keys: rev5. Found disallowed keys: both.",
    },
    {
      location: "FRR.FRC.data.20x.CSX.FRC-CSX-MAS.artifacts",
      message:
        "artifacts is inside data.20x, so it may only use applicability keys: 20x. Found disallowed keys: both, rev5.",
    },
    {
      location:
        "FRR.FRC.data.20x.CSX.FRC-CSX-PMV.varies_by_class.b.artifacts",
      message:
        "artifacts is inside data.20x, so it may only use applicability keys: 20x. Found disallowed keys: rev5.",
    },
  ]);
});
