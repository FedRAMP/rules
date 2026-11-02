// Dataset shapes mirror the local JSON Schema. Runtime validation remains
// authoritative for patterns, formats, non-empty arrays, and numeric constraints.
export interface RulesRepoConfig {
  rulesFile: string;
  schemaFile: string;
}

export type ApplicabilityKey = "all" | "20x" | "rev5";
export type ClassKey = "a" | "b" | "c" | "d" | "g";
export type ClassName = "A" | "B" | "C" | "D" | "G";
export type CertificationType = "20x" | "Rev5";
export type CertificationPath = "Program" | "Agency";
export type DocumentStatus = "stable" | "placeholder" | "empty";
export type Force = "MUST" | "MUST NOT" | "SHOULD" | "SHOULD NOT" | "MAY";
export type AffectedParty =
  | "Advisors"
  | "Agencies"
  | "Assessors"
  | "FedRAMP"
  | "Providers"
  | "Everyone";
export type TimeframeType =
  | "bizdays"
  | "days"
  | "hours"
  | "weeks"
  | "months"
  | "years";
export type Artifacts = Partial<Record<ApplicabilityKey, string[]>>;
export type ClassVariants<T> = { b: T; c: T } & Partial<Record<"a" | "d", T>>;

export interface UpdatedEntry {
  date: string;
  comment: string;
  issue?: string;
}

export interface DefinitionEntry {
  term: string;
  definition: string;
  note?: string;
  notes?: string[];
  tag?: string;
  alts: string[];
  do_not_link?: boolean;
  ignore_in_terms?: boolean;
  reference?: string;
  reference_url?: string;
  referenceurl?: string;
  updated: UpdatedEntry[];
}

export interface EffectiveDates {
  obtain: string;
  maintain: string;
  optional_adoption?: string;
  grace: { default: string; until_next_assessment: boolean };
}

export interface EffectiveEntry {
  is: "required" | "optional" | "no";
  current_status?: string;
  date?: EffectiveDates;
  comments?: string[];
  warnings?: string[];
  signup_url?: string;
}

type ScalarTimeframe =
  | { timeframe_type: TimeframeType; timeframe_num: number }
  | { timeframe_type?: never; timeframe_num?: never };

type RequirementTimeframe =
  | (ScalarTimeframe & { timeframe_num_min?: never; timeframe_num_max?: never })
  | {
      timeframe_type: TimeframeType;
      timeframe_num?: never;
      timeframe_num_min: number;
      timeframe_num_max: number;
    };

export interface PainTimeframeEntry {
  timeframe_type: TimeframeType;
  timeframe_num: number;
  description: string;
}

export type PainTimeframes = Record<
  "1" | "2" | "3" | "4" | "5",
  Record<string, PainTimeframeEntry>
>;

export type RequirementLevel = {
  statement: string;
  following_information?: string[];
  rev5_controls_list?: Record<string, string[]>;
  note?: string;
  notes?: string[];
  force: Force;
  effective_date?: EffectiveDates;
  pain_timeframes?: PainTimeframes;
  artifacts?: Artifacts;
} & ScalarTimeframe;

export type RequirementByClass = ClassVariants<RequirementLevel>;

// A deliberately partial view shared by text/history helpers; it is not a
// declaration of the allowed fields on a KSI indicator or FRR requirement.
export interface RequirementLike {
  statement?: string;
  note?: string;
  notes?: string[];
  following_information?: string[];
  following_information_bullets?: string[];
  terms?: string[];
  updated?: UpdatedEntry[];
  varies_by_class?: Partial<Record<ClassKey, { statement: string }>>;
}

export interface RuleSchemaReference {
  name: string;
  url: string;
}

export interface RuleNotification {
  party:
    | "FedRAMP"
    | "Provider"
    | "Agency Customers"
    | "Everyone"
    | "All Necessary Parties"
    | "All Affected Parties";
  method: "email" | "form" | "update" | "varies" | "web";
  target: string;
  name: string;
  url?: string;
  optional?: boolean;
}

export type Requirement = {
  name: string;
  following_information?: string[];
  following_information_bullets?: string[];
  danger?: string;
  note?: string;
  notes?: string[];
  related?: string[];
  reference?: string;
  reference_url?: string;
  reference_url_web_name?: string;
  effective_date?: EffectiveDates;
  corrective_actions?: string[];
  affects: AffectedParty[];
  artifacts?: Artifacts;
  schema?: RuleSchemaReference;
  examples?: Array<{ id: string; key_tests: string[]; examples: string[] }>;
  notification?: RuleNotification[];
  controls?: string[];
  terms?: string[];
  updated: UpdatedEntry[];
} & RequirementTimeframe &
  (
    | { statement: string; force: Force; varies_by_class?: never }
    | { statement?: never; force?: never; varies_by_class: RequirementByClass }
  );

export interface KsiIndicatorLevel {
  statement: string;
  artifacts?: Artifacts;
}

export type KsiIndicator = {
  name: string;
  controls: string[];
  reference?: string;
  reference_url?: string;
  updated: UpdatedEntry[];
  artifacts?: Artifacts;
  terms?: string[];
} & (
  | { statement: string; varies_by_class?: never }
  | { statement?: never; varies_by_class: ClassVariants<KsiIndicatorLevel> }
);

export interface KsiTheme {
  id: string;
  name: string;
  web_name: string;
  short_name: string;
  status: DocumentStatus;
  indicators: Record<string, KsiIndicator>;
}

export interface FrrSubsetApplicability {
  types: CertificationType[];
  paths: CertificationPath[];
  classes: ClassName[];
  affects: AffectedParty[];
}

export interface FrrSubsetDefinition {
  name: string;
  description: string;
  applicability: FrrSubsetApplicability;
}

type DocumentInfo = {
  name: string;
  short_name: string;
  web_name: string;
  purpose: string;
  status: DocumentStatus;
};

type EffectiveInfo<T extends object> =
  | {
      effective: EffectiveEntry;
      "20x"?: T & { effective?: never };
      rev5?: T & { effective?: never };
    }
  | {
      effective?: never;
      "20x": T & { effective: EffectiveEntry };
      rev5: T & { effective: EffectiveEntry };
    };

export type FrdDocumentInfo = DocumentInfo & EffectiveInfo<{}>;
type FrrScopeInfo = {
  subsets?: Record<string, FrrSubsetDefinition>;
  flows?: unknown[];
};
export type FrrDocumentInfo = DocumentInfo &
  FrrScopeInfo & { tag?: string } & EffectiveInfo<FrrScopeInfo>;

export interface ControlClassData {
  guidance?: string[];
  parameters?: Array<{ parameterId: string; value: string }>;
}

export interface ControlData extends ControlClassData {
  varies_by_class?: Partial<Record<"b" | "c" | "d", ControlClassData>>;
  updated?: UpdatedEntry[];
}

export interface RulesDocument {
  info: {
    title: string;
    description: string;
    version: string;
    last_updated: string;
    default_artifacts?: { FRR: string[]; KSI: string[] };
  };
  FRD: {
    info: FrdDocumentInfo;
    data: { all: Record<string, DefinitionEntry> } & Partial<
      Record<"20x" | "rev5", Record<string, DefinitionEntry>>
    >;
  };
  FRR: Record<
    string,
    {
      info: FrrDocumentInfo;
      data: Partial<
        Record<ApplicabilityKey, Record<string, Record<string, Requirement>>>
      >;
    }
  >;
  KSI: Record<string, KsiTheme>;
  CTL?: Record<string, Record<string, ControlData>>;
}

export interface ValidationIssue {
  id: string;
  location: string;
  message: string;
}

export interface IdAlignmentIssue {
  path: string;
  parent: string;
  oldKey: string;
  newKey: string;
  status: "fixed" | "skipped_collision";
}

export interface PropertyOrderIssue {
  path: string;
  actualOrder: string[];
  expectedOrder: string[];
}
