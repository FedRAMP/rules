export interface RulesRepoConfig {
  rulesFile: string;
  schemaFile: string;
}

export interface UpdatedEntry {
  date: string;
  comment: string;
}

export interface DefinitionEntry {
  fka?: string;
  fkas?: string[];
  term: string;
  alts?: string[];
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
  primary_key_word?: string;
  timeframe_type?: string;
  timeframe_num?: number;
  pain_timeframes?: PainTimeframes;
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
  fka?: string;
  fkas?: string[];
  statement?: string;
  primary_key_word?: string;
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
}

export interface KsiIndicator extends RequirementLike {
  name: string;
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
