import type {
  DefinitionEntry,
  KsiIndicator,
  Requirement,
  RequirementLike,
  RulesDocument,
} from "./types";

export interface RequirementVisit {
  id: string;
  location: string;
  requirement: Requirement;
}

export interface IndicatorVisit {
  id: string;
  location: string;
  indicator: KsiIndicator;
}

export function getDefinitionEntries(document: RulesDocument): Array<{
  id: string;
  source: string;
  definition: DefinitionEntry;
}> {
  const entries: Array<{
    id: string;
    source: string;
    definition: DefinitionEntry;
  }> = [];

  for (const [scopeKey, definitions] of Object.entries(
    document.FRD.data ?? {},
  )) {
    for (const [id, definition] of Object.entries(definitions ?? {})) {
      entries.push({
        id,
        source: `FRD.data.${scopeKey}.${id}`,
        definition,
      });
    }
  }

  return entries;
}

export function visitRequirements(
  document: RulesDocument,
  visitor: (visit: RequirementVisit) => void,
): void {
  for (const [sectionKey, section] of Object.entries(document.FRR ?? {})) {
    for (const [scopeKey, bucket] of Object.entries(section.data ?? {})) {
      for (const [parentKey, requirements] of Object.entries(bucket ?? {})) {
        for (const [id, requirement] of Object.entries(requirements ?? {})) {
          visitor({
            id,
            location: `FRR.${sectionKey}.data.${scopeKey}.${parentKey}.${id}`,
            requirement,
          });
        }
      }
    }
  }
}

export function visitIndicators(
  document: RulesDocument,
  visitor: (visit: IndicatorVisit) => void,
): void {
  for (const [themeKey, theme] of Object.entries(document.KSI ?? {})) {
    for (const [id, indicator] of Object.entries(theme.indicators ?? {})) {
      visitor({
        id,
        location: `KSI.${themeKey}.indicators.${id}`,
        indicator,
      });
    }
  }
}

export function getSearchableTextParts(entity: RequirementLike): string[] {
  const parts: string[] = [];

  if (entity.statement) {
    parts.push(entity.statement);
  }
  if (entity.note) {
    parts.push(entity.note);
  }
  if (entity.notes?.length) {
    parts.push(...entity.notes);
  }
  if (entity.following_information?.length) {
    parts.push(...entity.following_information);
  }
  if (entity.following_information_bullets?.length) {
    parts.push(...entity.following_information_bullets);
  }
  if (entity.varies_by_class) {
    for (const classEntry of Object.values(entity.varies_by_class)) {
      const statement = classEntry?.statement;
      if (statement) {
        parts.push(statement);
      }
    }
  }

  return parts;
}
