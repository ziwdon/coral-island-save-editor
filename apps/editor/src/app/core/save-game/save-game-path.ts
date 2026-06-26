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

export type NumericPathValueOptions = {
  integer?: boolean;
  min?: number;
  max?: number;
};

const ARRAY_SEGMENT_PATTERN = /^(.+)\[(\d+)]$/;
const NUMERIC_PATH_VALUE_OPTIONS: Record<string, NumericPathValueOptions> = {
  Byte: { integer: true, min: 0, max: 255 },
  Int: { integer: true, min: -2_147_483_648, max: 2_147_483_647 },
  Int16: { integer: true, min: -32_768, max: 32_767 },
  Int32: { integer: true, min: -2_147_483_648, max: 2_147_483_647 },
  Int64: { integer: true, min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER },
  UInt: { integer: true, min: 0, max: 4_294_967_295 },
  UInt16: { integer: true, min: 0, max: 65_535 },
  UInt32: { integer: true, min: 0, max: 4_294_967_295 },
  UInt64: { integer: true, min: 0, max: Number.MAX_SAFE_INTEGER },
};

export function getNumericPathValueOptions(key: string): NumericPathValueOptions {
  return NUMERIC_PATH_VALUE_OPTIONS[key] ?? {};
}

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
  return setExistingPathValueWithGuard(data, path, value, (currentValue, nextValue, leaf) =>
    isSafeReplacement(currentValue, nextValue, leaf, options),
  );
}

export function setExistingPathValueUnchecked(data: unknown, path: string, value: unknown): boolean {
  return setExistingPathValueWithGuard(data, path, value, () => true);
}

function setExistingPathValueWithGuard(
  data: unknown,
  path: string,
  value: unknown,
  canReplace: (currentValue: unknown, nextValue: unknown, leaf: ExplorerPathSegment) => boolean,
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

    if (!canReplace(arrayValue[leaf.index], value, leaf)) {
      return false;
    }

    arrayValue[leaf.index] = value;
    return true;
  }

  if (!canReplace(parent.value[leaf.key], value, leaf)) {
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

    return isSafeNumericReplacement(leaf.key, nextValue);
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
    (nextEnum.value === currentEnum.value || nextEnum.value.startsWith(`${currentEnum.enumType}::`))
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

function isSafeNumericReplacement(key: string, value: number): boolean {
  const options = getNumericPathValueOptions(key);

  if (options.integer && !Number.isInteger(value)) {
    return false;
  }

  if (options.min !== undefined && value < options.min) {
    return false;
  }

  if (options.max !== undefined && value > options.max) {
    return false;
  }

  return true;
}
