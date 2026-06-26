export type ExplorerPathSegment = {
  key: string;
  index?: number;
};

export type ExistingPathResult = {
  exists: boolean;
  value: unknown;
};

export type SetExistingPathValueOptions = {
  enumTypes?: ReadonlySet<string>;
};

const ARRAY_SEGMENT_PATTERN = /^(.+)\[(\d+)]$/;

export function parseExplorerPath(path: string): ExplorerPathSegment[] {
  if (path === '') {
    return [];
  }

  return path.split('.').map((rawSegment) => {
    if (!rawSegment) {
      throw new Error(`Invalid empty path segment in "${path}".`);
    }

    const arrayMatch = ARRAY_SEGMENT_PATTERN.exec(rawSegment);
    if (arrayMatch) {
      return {
        key: arrayMatch[1],
        index: Number(arrayMatch[2]),
      };
    }

    if (rawSegment.includes('[') || rawSegment.includes(']')) {
      throw new Error(`Invalid array path segment "${rawSegment}".`);
    }

    return { key: rawSegment };
  });
}

export function getExistingPathValue(data: unknown, path: string): ExistingPathResult {
  let cursor = data;

  for (const segment of parseExplorerPath(path)) {
    if (!isRecord(cursor) || !hasOwn(cursor, segment.key)) {
      return { exists: false, value: undefined };
    }

    cursor = cursor[segment.key];

    if (segment.index !== undefined) {
      if (!Array.isArray(cursor) || segment.index < 0 || segment.index >= cursor.length) {
        return { exists: false, value: undefined };
      }

      cursor = cursor[segment.index];
    }
  }

  return { exists: true, value: cursor };
}

export function setExistingPathValue(
  data: unknown,
  path: string,
  value: unknown,
  options: SetExistingPathValueOptions = {},
): boolean {
  const segments = parseExplorerPath(path);
  const leaf = segments.pop();

  if (!leaf) {
    return false;
  }

  const parentPath = formatExplorerPath(segments);
  const parent = getExistingPathValue(data, parentPath);

  if (!parent.exists || !isRecord(parent.value) || !hasOwn(parent.value, leaf.key)) {
    return false;
  }

  if (leaf.index !== undefined) {
    const arrayValue = parent.value[leaf.key];

    if (!Array.isArray(arrayValue) || leaf.index < 0 || leaf.index >= arrayValue.length) {
      return false;
    }

    if (!isSafeReplacement(arrayValue[leaf.index], value, leaf, options)) {
      return false;
    }

    arrayValue[leaf.index] = value;
    return true;
  }

  if (!isSafeReplacement(parent.value[leaf.key], value, leaf, options)) {
    return false;
  }

  parent.value[leaf.key] = value;
  return true;
}

function formatExplorerPath(segments: ExplorerPathSegment[]): string {
  return segments
    .map((segment) => (segment.index === undefined ? segment.key : `${segment.key}[${segment.index}]`))
    .join('.');
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object';
}

function hasOwn(value: Record<string, any>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isSafeReplacement(
  currentValue: unknown,
  nextValue: unknown,
  leaf: ExplorerPathSegment,
  options: SetExistingPathValueOptions,
): boolean {
  if (typeof currentValue === 'string') {
    return typeof nextValue === 'string';
  }

  if (typeof currentValue === 'number') {
    if (typeof nextValue !== 'number' || !Number.isFinite(nextValue)) {
      return false;
    }

    return !requiresIntegerValue(leaf.key) || Number.isInteger(nextValue);
  }

  if (typeof currentValue === 'boolean') {
    return typeof nextValue === 'boolean';
  }

  const currentEnum = readEnumWrapper(currentValue);
  const nextEnum = readEnumWrapper(nextValue);

  if (!currentEnum || !nextEnum) {
    return false;
  }

  return (
    currentEnum.enumType === nextEnum.enumType &&
    options.enumTypes?.has(currentEnum.enumType) === true &&
    nextEnum.value.startsWith(`${currentEnum.enumType}::`)
  );
}

function readEnumWrapper(value: unknown) {
  if (!isRecord(value) || !isRecord(value['Enum'])) {
    return null;
  }

  const enumType = value['Enum']['enum_type'];
  const enumValue = value['Enum']['value'];

  if (typeof enumType !== 'string' || typeof enumValue !== 'string') {
    return null;
  }

  return {
    enumType,
    value: enumValue,
  };
}

function requiresIntegerValue(key: string): boolean {
  return ['Byte', 'Int', 'Int16', 'Int32', 'Int64', 'UInt', 'UInt16', 'UInt32', 'UInt64'].includes(key);
}
