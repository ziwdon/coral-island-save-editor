import { PLAYERS_ARRAY_PATH } from '../../core/save-game/coral-island-save-paths';
import { getExistingPathValue } from '../../core/save-game/save-game-path';

export const RELATIONSHIP_HEART_THRESHOLDS = [0, 300, 650, 1050, 1500, 2000, 2550, 3150, 3800, 4500, 5250] as const;
export const MAX_RELATIONSHIP_HEART_LEVEL = RELATIONSHIP_HEART_THRESHOLDS.length - 1;

export type RelationshipHeartLevel = {
  level: number;
  thresholdPoints: number;
  nextThresholdPoints: number | null;
  aboveKnownCap: boolean;
  betweenThresholds: boolean;
};

export type RelationshipPlayer = {
  index: number;
  label: string;
};

export type RelationshipHeartEntry = {
  playerIndex: number;
  npcId: string;
  heartPoints: number;
  heartLevel: RelationshipHeartLevel;
  pointsPath: string;
};

export function heartLevelToPoints(level: number): number | null {
  return Number.isInteger(level) ? (RELATIONSHIP_HEART_THRESHOLDS[level] ?? null) : null;
}

export function relationshipPointsToHeartLevel(points: number): RelationshipHeartLevel {
  const maxPoints = RELATIONSHIP_HEART_THRESHOLDS[MAX_RELATIONSHIP_HEART_LEVEL];
  const aboveKnownCap = points > maxPoints;
  let level = 0;

  for (const [index, threshold] of RELATIONSHIP_HEART_THRESHOLDS.entries()) {
    if (points >= threshold) {
      level = index;
    }
  }

  const thresholdPoints = RELATIONSHIP_HEART_THRESHOLDS[level];
  const nextThresholdPoints = RELATIONSHIP_HEART_THRESHOLDS[level + 1] ?? null;

  return {
    level,
    thresholdPoints,
    nextThresholdPoints,
    aboveKnownCap,
    betweenThresholds: !aboveKnownCap && points !== thresholdPoints,
  };
}

export function readRelationshipPlayers(data: unknown): RelationshipPlayer[] {
  return readArray(data, PLAYERS_ARRAY_PATH).map((_player, index) => ({
    index,
    label:
      readString(data, `${playerPath(index)}.playerInfo_0.Struct.value.Struct.Name_0.Str`) ?? `Player ${index + 1}`,
  }));
}

export function readRelationshipHeartEntries(data: unknown, playerIndex: number): RelationshipHeartEntry[] {
  return readArray(data, relationshipEntriesPath(playerIndex)).flatMap((entry, index) => {
    const npcId = readString(entry, 'Struct.npcId_0.Name');
    const heartPoints = readNumber(entry, 'Struct.heartPoints_0.Int');

    if (!npcId || heartPoints === null) {
      return [];
    }

    return [
      {
        playerIndex,
        npcId,
        heartPoints,
        heartLevel: relationshipPointsToHeartLevel(heartPoints),
        pointsPath: `${relationshipEntriesPath(playerIndex)}[${index}].Struct.heartPoints_0.Int`,
      },
    ];
  });
}

export function relationshipHeartEntryMatches(entry: RelationshipHeartEntry, query: string): boolean {
  return !query.trim() || entry.npcId.toLowerCase().includes(query.trim().toLowerCase());
}

function playerPath(index: number): string {
  return `${PLAYERS_ARRAY_PATH}[${index}].Struct`;
}

function relationshipEntriesPath(playerIndex: number): string {
  return `${playerPath(playerIndex)}.npcRelationshipData_0.Array.value.Struct.value`;
}

function readArray(data: unknown, path: string): unknown[] {
  const result = getExistingPathValue(data, path);
  return result.exists && Array.isArray(result.value) ? result.value : [];
}

function readString(data: unknown, path: string): string | null {
  const result = getExistingPathValue(data, path);
  return result.exists && typeof result.value === 'string' ? result.value : null;
}

function readNumber(data: unknown, path: string): number | null {
  const result = getExistingPathValue(data, path);
  return result.exists && typeof result.value === 'number' ? result.value : null;
}
