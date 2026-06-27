import { CORAL_ISLAND_ENUMS } from '@coral-island/enums';
import { getExistingPathValue } from '../../core/save-game/save-game-path';
import { PLAYERS_ARRAY_PATH, SAVE_DATA_STRUCT_PATH } from '../../core/save-game/coral-island-save-paths';

export type QuestRuntimeSource = 'world' | 'player';

export type QuestRuntimeObjective = {
  fullPath: string;
  label: string;
  questId: string;
  currentProgress: number;
  progressPath: string;
  status: string;
  statusPath: string;
};

export type QuestRuntimeEntry = {
  source: QuestRuntimeSource;
  sourceId: string;
  sourceLabel: string;
  questId: string;
  state: string;
  statePath: string;
  tracked: boolean;
  objectives: QuestRuntimeObjective[];
};

type QuestRuntimeScope = {
  source: QuestRuntimeSource;
  sourceId: string;
  sourceLabel: string;
  questMapPath: string;
  conditionMapPath: string;
  trackedQuestIds: ReadonlySet<string>;
};

export const QUEST_STATE_OPTIONS = CORAL_ISLAND_ENUMS.EC_QuestState;
export const QUEST_STEP_STATUS_OPTIONS = CORAL_ISLAND_ENUMS.EC_QuestStepStatus;

export function readQuestRuntimeEntries(data: unknown): QuestRuntimeEntry[] {
  return readQuestRuntimeScopes(data).flatMap((scope) => readQuestRuntimeEntriesForScope(data, scope));
}

export function questRuntimeEntryMatches(entry: QuestRuntimeEntry, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  const targets = [
    entry.questId,
    entry.state,
    entry.sourceLabel,
    entry.tracked ? 'tracked' : 'untracked',
    ...entry.objectives.flatMap((objective) => [
      objective.fullPath,
      objective.label,
      objective.status,
      String(objective.currentProgress),
    ]),
  ];

  return targets.some((target) => target.toLowerCase().includes(normalizedQuery));
}

export function buildQuestStepStatusValue(status: string) {
  return {
    Enum: {
      value: status,
      enum_type: 'EC_QuestStepStatus',
    },
  };
}

function readQuestRuntimeScopes(data: unknown): QuestRuntimeScope[] {
  const playerCount = readArray(data, PLAYERS_ARRAY_PATH).length;
  const playerTrackedQuestIds = Array.from({ length: playerCount }, (_value, index) =>
    readNameSet(data, trackedQuestsPath(playerPath(index))),
  );
  const allTrackedQuestIds = new Set(playerTrackedQuestIds.flatMap((trackedQuestIds) => [...trackedQuestIds]));
  const scopes: QuestRuntimeScope[] = [
    {
      source: 'world',
      sourceId: 'world',
      sourceLabel: 'World',
      questMapPath: `${SAVE_DATA_STRUCT_PATH}.quests_0.Map.value`,
      conditionMapPath: `${SAVE_DATA_STRUCT_PATH}.dynamicQuestConditionDataMap_0.Map.value`,
      trackedQuestIds: allTrackedQuestIds,
    },
  ];

  for (let index = 0; index < playerCount; index++) {
    const basePath = playerPath(index);
    scopes.push({
      source: 'player',
      sourceId: `player-${index}`,
      sourceLabel: `Player ${index + 1}`,
      questMapPath: `${basePath}.quests_0.Map.value`,
      conditionMapPath: `${basePath}.dynamicQuestConditionDataMap_0.Map.value`,
      trackedQuestIds: playerTrackedQuestIds[index],
    });
  }

  return scopes;
}

function readQuestRuntimeEntriesForScope(data: unknown, scope: QuestRuntimeScope): QuestRuntimeEntry[] {
  const questEntries = readArray(data, scope.questMapPath);
  const objectivesByQuestId = groupObjectivesByQuestId(data, scope.conditionMapPath);
  const entries: QuestRuntimeEntry[] = [];

  for (const [index, questEntry] of questEntries.entries()) {
    const questId = readName(questEntry, 'key.Name');
    const state = readString(questEntry, 'value.Enum');

    if (!questId || !state) {
      continue;
    }

    entries.push({
      source: scope.source,
      sourceId: scope.sourceId,
      sourceLabel: scope.sourceLabel,
      questId,
      state,
      statePath: `${scope.questMapPath}[${index}].value.Enum`,
      tracked: scope.trackedQuestIds.has(questId),
      objectives: objectivesByQuestId.get(questId) ?? [],
    });
  }

  return entries;
}

function groupObjectivesByQuestId(data: unknown, conditionMapPath: string): Map<string, QuestRuntimeObjective[]> {
  const objectivesByQuestId = new Map<string, QuestRuntimeObjective[]>();
  const conditionEntries = readArray(data, conditionMapPath);

  for (const [index, conditionEntry] of conditionEntries.entries()) {
    const objective = readQuestRuntimeObjective(conditionEntry, `${conditionMapPath}[${index}]`);

    if (!objective) {
      continue;
    }

    const objectives = objectivesByQuestId.get(objective.questId) ?? [];
    objectives.push(objective);
    objectivesByQuestId.set(objective.questId, objectives);
  }

  return objectivesByQuestId;
}

function readQuestRuntimeObjective(conditionEntry: unknown, entryPath: string): QuestRuntimeObjective | null {
  const fullPath =
    readName(conditionEntry, 'value.Struct.Struct.conditionFullPath_0.Name') ?? readName(conditionEntry, 'key.Name');
  const dynamicDataPath = `${entryPath}.value.Struct.Struct.conditionDynamicData_0.Struct.value.Struct`;
  const currentProgress = readNumberAtPath(
    conditionEntry,
    'value.Struct.Struct.conditionDynamicData_0.Struct.value.Struct.currentProgress_0.Int',
  );
  const status = readEnumValueAtPath(
    conditionEntry,
    'value.Struct.Struct.conditionDynamicData_0.Struct.value.Struct.status_0',
  );

  if (!fullPath || currentProgress === null || !status) {
    return null;
  }

  const [questId, ...labelParts] = fullPath.split('/');

  if (!questId) {
    return null;
  }

  return {
    fullPath,
    label: labelParts.length ? labelParts.join(' / ') : fullPath,
    questId,
    currentProgress,
    progressPath: `${dynamicDataPath}.currentProgress_0.Int`,
    status,
    statusPath: `${dynamicDataPath}.status_0`,
  };
}

function playerPath(index: number): string {
  return `${PLAYERS_ARRAY_PATH}[${index}].Struct`;
}

function trackedQuestsPath(basePath: string): string {
  return `${basePath}.currentlyTrackedQuests_0.Array.value.Base.Name`;
}

function readArray(data: unknown, path: string): unknown[] {
  const result = getExistingPathValue(data, path);
  return result.exists && Array.isArray(result.value) ? result.value : [];
}

function readNameSet(data: unknown, path: string): Set<string> {
  const names = readArray(data, path).filter((value): value is string => typeof value === 'string');
  return new Set(names);
}

function readName(data: unknown, path: string): string | null {
  return readString(data, path);
}

function readString(data: unknown, path: string): string | null {
  const result = getExistingPathValue(data, path);
  return result.exists && typeof result.value === 'string' ? result.value : null;
}

function readNumberAtPath(data: unknown, path: string): number | null {
  const result = getExistingPathValue(data, path);
  return result.exists && typeof result.value === 'number' ? result.value : null;
}

function readEnumValueAtPath(data: unknown, path: string): string | null {
  const result = getExistingPathValue(data, path);

  if (!result.exists || !result.value || typeof result.value !== 'object') {
    return null;
  }

  const enumWrapper = result.value as { Enum?: { value?: unknown; enum_type?: unknown } };

  if (enumWrapper.Enum?.enum_type !== 'EC_QuestStepStatus' || typeof enumWrapper.Enum.value !== 'string') {
    return null;
  }

  return enumWrapper.Enum.value;
}
