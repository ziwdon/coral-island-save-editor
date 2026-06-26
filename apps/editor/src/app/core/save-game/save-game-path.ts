export type ExplorerPathSegment = {
  key: string;
  index?: number;
};

export type ExistingPathResult = {
  exists: boolean;
  value: unknown;
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

export function setExistingPathValue(data: unknown, path: string, value: unknown): boolean {
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

    arrayValue[leaf.index] = value;
    return true;
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
