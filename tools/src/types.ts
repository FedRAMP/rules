export interface RulesRepoConfig {
  rulesFile: string;
  schemaFile: string;
}

export interface UpdatedEntry {
  date: string;
  comment: string;
}

export interface DefinitionEntry {
  term: string;
  alts?: string[];
  tag?: string;
  definition: string;
  note?: string;
  notes?: string[];
  reference?: string;
  reference_url?: string;
  referenceurl?: string;
  updated?: UpdatedEntry[];
}

export interface RequirementLevel {
  statement?: string;
  following_information?: string[];
  force?: string;
  timeframe_type?: string;
  timeframe_num?: number;
  pain_timeframes?: PainTimeframes;
  note?: string;
  notes?: string[];
}

export type ClassKey = "a" | "b" | "c" | "d";

export interface PainTimeframeEntry {
  timeframe_type: string;
  timeframe_num: number;
  description: string;
}

export type PainTimeframes = Record<string, Record<string, PainTimeframeEntry>>;

export type RequirementByClass = Partial<Record<ClassKey, RequirementLevel>>;

export interface RequirementLike {
  statement?: string;
  force?: string;
  note?: string;
  notes?: string[];
  following_information?: string[];
  following_information_bullets?: string[];
  terms?: string[];
  updated?: UpdatedEntry[];
  varies_by_class?: RequirementByClass;
}

export interface Requirement extends RequirementLike {
  affects: string[];
  name: string;
  related?: string[];
}

export interface KsiIndicator extends RequirementLike {
  name: string;
}

export interface FrrSubsetApplicability {
  types: string[];
  paths: string[];
  classes: string[];
  affects: string[];
}

export interface FrrSubsetDefinition {
  name: string;
  description: string;
  applicability?: FrrSubsetApplicability;
}

export interface RulesDocument {
  info: {
    title: string;
    description: string;
    version: string;
    last_updated: string;
  };
  FRD: {
    info: Record<string, unknown>;
    data: Record<string, Record<string, DefinitionEntry>>;
  };
  FRR: Record<
    string,
    {
      info: Record<string, unknown>;
      data: Record<string, Record<string, Record<string, Requirement>>>;
    }
  >;
  KSI: Record<
    string,
    {
      id: string;
      name: string;
      web_name: string;
      short_name: string;
      theme: string;
      indicators: Record<string, KsiIndicator> | KsiIndicator[];
    }
  >;
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
