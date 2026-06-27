import { CORAL_ISLAND_ENUMS, SaveGameEnum } from '@coral-island/enums';

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object';
}

export function readSaveGameEnum(value: unknown): SaveGameEnum | null {
  if (!isRecord(value) || !isRecord(value['Enum'])) {
    return null;
  }

  const enumType = value['Enum']['enum_type'];
  const enumValue = value['Enum']['value'];

  if (typeof enumType !== 'string' || typeof enumValue !== 'string') {
    return null;
  }

  if (!Object.prototype.hasOwnProperty.call(CORAL_ISLAND_ENUMS, enumType)) {
    return null;
  }

  return value as SaveGameEnum;
}

export function enumOptionsForPathValue(value: unknown): readonly string[] {
  const enumValue = readSaveGameEnum(value);

  if (!enumValue) {
    return [];
  }

  return CORAL_ISLAND_ENUMS[enumValue.Enum.enum_type] ?? [];
}
