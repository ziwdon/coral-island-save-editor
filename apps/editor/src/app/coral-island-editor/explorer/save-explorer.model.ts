export type ExplorerPathSegment = {
  key: string;
  index?: number;
};

export type ExplorerValueKind = 'array' | 'boolean' | 'enum' | 'null' | 'number' | 'object' | 'string' | 'unknown';

export type PrimitiveEditKind = 'boolean' | 'number' | 'string';

export type ExplorerEdit =
  | {
      kind: PrimitiveEditKind;
      currentValue: boolean | number | string;
    }
  | {
      kind: 'enum';
      enumType: string;
      currentValue: string;
    };

export type SaveExplorerNode = {
  key: string;
  label: string;
  path: string;
  kind: ExplorerValueKind;
  depth: number;
  childCount: number;
  displayValue: string;
  edit: ExplorerEdit | null;
};

export type ExplorerOptions = {
  enumTypes?: ReadonlySet<string>;
  limit?: number;
  visitLimit?: number;
};

export type ExistingPathResult = {
  exists: boolean;
  value: unknown;
};

const ARRAY_SEGMENT_PATTERN = /^(.+)\[(\d+)]$/;
const DEFAULT_SEARCH_LIMIT = 100;
const DEFAULT_VISIT_LIMIT = 5000;

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

export function listExplorerChildren(
  value: unknown,
  parentPath: string,
  parentDepth: number,
  options: ExplorerOptions = {},
): SaveExplorerNode[] {
  const limit = options.limit ?? Number.POSITIVE_INFINITY;

  if (Array.isArray(value)) {
    return value.slice(0, limit).map((child, index) => {
      const key = `[${index}]`;
      return describeExplorerNode(child, `${parentPath}${key}`, key, parentDepth + 1, options.enumTypes);
    });
  }

  if (!isRecord(value)) {
    return [];
  }

  return Object.keys(value)
    .slice(0, limit)
    .map((key) => {
      const childPath = parentPath ? `${parentPath}.${key}` : key;
      return describeExplorerNode(value[key], childPath, key, parentDepth + 1, options.enumTypes);
    });
}

export function describeExplorerNode(
  value: unknown,
  path: string,
  key: string,
  depth: number,
  enumTypes?: ReadonlySet<string>,
): SaveExplorerNode {
  const enumValue = getKnownEnumValue(value, enumTypes);

  if (enumValue) {
    return {
      key,
      label: key,
      path,
      kind: 'enum',
      depth,
      childCount: countChildren(value),
      displayValue: enumValue.value,
      edit: {
        kind: 'enum',
        enumType: enumValue.enumType,
        currentValue: enumValue.value,
      },
    };
  }

  const primitiveEdit = getPrimitiveEdit(value);

  return {
    key,
    label: key,
    path,
    kind: getValueKind(value),
    depth,
    childCount: countChildren(value),
    displayValue: formatDisplayValue(value),
    edit: primitiveEdit,
  };
}

export function searchExplorerNodes(root: unknown, query: string, options: ExplorerOptions = {}): SaveExplorerNode[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  const limit = options.limit ?? DEFAULT_SEARCH_LIMIT;
  const visitLimit = options.visitLimit ?? DEFAULT_VISIT_LIMIT;
  const results: SaveExplorerNode[] = [];
  const queue = listExplorerChildren(root, '', -1, options);
  let visited = 0;

  while (queue.length > 0 && results.length < limit && visited < visitLimit) {
    const node = queue.shift()!;
    visited++;

    if (nodeMatches(node, normalizedQuery)) {
      results.push(node);
    }

    if (node.childCount > 0) {
      const childValue = getExistingPathValue(root, node.path);

      if (childValue.exists) {
        queue.push(...listExplorerChildren(childValue.value, node.path, node.depth, options));
      }
    }
  }

  return results;
}

export function coercePrimitiveEditValue(kind: PrimitiveEditKind, rawValue: unknown): boolean | number | string {
  if (kind === 'string') {
    return String(rawValue ?? '');
  }

  if (kind === 'boolean') {
    if (typeof rawValue === 'boolean') {
      return rawValue;
    }

    if (rawValue === 'true') {
      return true;
    }

    if (rawValue === 'false') {
      return false;
    }

    throw new Error('Enter a valid boolean value.');
  }

  const trimmedValue = String(rawValue).trim();
  const value = typeof rawValue === 'number' ? rawValue : trimmedValue ? Number(trimmedValue) : Number.NaN;

  if (!Number.isFinite(value)) {
    throw new Error('Enter a valid number.');
  }

  return value;
}

export function buildEnumEditValue(enumType: string, value: string) {
  return {
    Enum: {
      enum_type: enumType,
      value: value.startsWith(`${enumType}::`) ? value : `${enumType}::${value}`,
    },
  };
}

function formatExplorerPath(segments: ExplorerPathSegment[]): string {
  return segments
    .map((segment) => (segment.index === undefined ? segment.key : `${segment.key}[${segment.index}]`))
    .join('.');
}

function getPrimitiveEdit(value: unknown): ExplorerEdit | null {
  if (typeof value === 'string') {
    return {
      kind: 'string',
      currentValue: value,
    };
  }

  if (typeof value === 'number') {
    return {
      kind: 'number',
      currentValue: value,
    };
  }

  if (typeof value === 'boolean') {
    return {
      kind: 'boolean',
      currentValue: value,
    };
  }

  return null;
}

function getKnownEnumValue(value: unknown, enumTypes?: ReadonlySet<string>) {
  if (!enumTypes || !isRecord(value) || !isRecord(value['Enum'])) {
    return null;
  }

  const enumType = value['Enum']['enum_type'];
  const enumValue = value['Enum']['value'];

  if (typeof enumType !== 'string' || typeof enumValue !== 'string' || !enumTypes.has(enumType)) {
    return null;
  }

  return {
    enumType,
    value: enumValue,
  };
}

function getValueKind(value: unknown): ExplorerValueKind {
  if (Array.isArray(value)) {
    return 'array';
  }

  if (value === null) {
    return 'null';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return typeof value;
  }

  if (isRecord(value)) {
    return 'object';
  }

  return 'unknown';
}

function countChildren(value: unknown): number {
  if (Array.isArray(value)) {
    return value.length;
  }

  if (isRecord(value)) {
    return Object.keys(value).length;
  }

  return 0;
}

function formatDisplayValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `${value.length} items`;
  }

  if (isRecord(value)) {
    const count = Object.keys(value).length;
    return `${count} ${count === 1 ? 'field' : 'fields'}`;
  }

  return String(value);
}

function nodeMatches(node: SaveExplorerNode, normalizedQuery: string): boolean {
  const matchTargets = [node.key, node.path, node.displayValue, node.kind];

  if (node.edit?.kind === 'enum') {
    matchTargets.push(node.edit.enumType, node.edit.currentValue);
  }

  return matchTargets.some((target) => target.toLowerCase().includes(normalizedQuery));
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object';
}

function hasOwn(value: Record<string, any>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}
