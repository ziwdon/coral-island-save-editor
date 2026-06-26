import { getExistingPathValue, parseExplorerPath, setExistingPathValue } from '../../core/save-game/save-game-path';

export {
  getExistingPathValue,
  parseExplorerPath,
  setExistingPathValue,
  type ExistingPathResult,
  type ExplorerPathSegment,
} from '../../core/save-game/save-game-path';

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

const DEFAULT_SEARCH_LIMIT = 100;
const DEFAULT_VISIT_LIMIT = 5000;

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
  const childOptions = {
    enumTypes: options.enumTypes,
    limit: visitLimit,
  };
  const queue = listExplorerChildren(root, '', -1, childOptions);
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
        queue.push(...listExplorerChildren(childValue.value, node.path, node.depth, childOptions));
      }
    }
  }

  return results;
}

export type PrimitiveEditOptions = {
  integer?: boolean;
};

export function coercePrimitiveEditValue(
  kind: PrimitiveEditKind,
  rawValue: unknown,
  options: PrimitiveEditOptions = {},
): boolean | number | string {
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

  if (options.integer && !Number.isInteger(value)) {
    throw new Error('Enter a whole number.');
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

  if (typeof value === 'string') {
    return 'string';
  }

  if (typeof value === 'number') {
    return 'number';
  }

  if (typeof value === 'boolean') {
    return 'boolean';
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
