import assert from 'node:assert/strict';
import {
  buildEnumEditValue,
  coercePrimitiveEditValue,
  describeExplorerNode,
  getExistingPathValue,
  listExplorerChildren,
  parseExplorerPath,
  searchExplorerNodes,
  setExistingPathValue,
} from './save-explorer.model';

function sampleSave() {
  return {
    root: {
      properties: {
        SaveData_0: {
          Struct: {
            value: {
              Struct: {
                currentWeather_0: {
                  Enum: {
                    enum_type: 'EC_Weather',
                    value: 'EC_Weather::Sunny',
                  },
                },
                players_0: {
                  Array: {
                    value: {
                      Values: [
                        {
                          playerCurrentGold_0: { Int: 128 },
                          playerInfo_0: {
                            Struct: {
                              value: {
                                Struct: {
                                  Name_0: { Str: 'Ava' },
                                  hasSeenIntro_0: { Bool: true },
                                },
                              },
                            },
                          },
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

const playerPath = 'root.properties.SaveData_0.Struct.value.Struct.players_0.Array.value.Values[0]';
const playerGoldPath = `${playerPath}.playerCurrentGold_0.Int`;
const playerNamePath = `${playerPath}.playerInfo_0.Struct.value.Struct.Name_0.Str`;
const playerIntroPath = `${playerPath}.playerInfo_0.Struct.value.Struct.hasSeenIntro_0.Bool`;
const weatherPath = 'root.properties.SaveData_0.Struct.value.Struct.currentWeather_0';

function testPathParsing() {
  const segments = parseExplorerPath(`${playerPath}.playerInfo_0.Struct`);

  assert.deepEqual(segments, [
    { key: 'root' },
    { key: 'properties' },
    { key: 'SaveData_0' },
    { key: 'Struct' },
    { key: 'value' },
    { key: 'Struct' },
    { key: 'players_0' },
    { key: 'Array' },
    { key: 'value' },
    { key: 'Values', index: 0 },
    { key: 'playerInfo_0' },
    { key: 'Struct' },
  ]);

  assert.throws(() => parseExplorerPath('root.Values[]'), /Invalid array path segment/);
  assert.throws(() => parseExplorerPath('root..properties'), /Invalid empty path segment/);
}

function testExistingPathAccess() {
  const data = sampleSave();

  assert.deepEqual(getExistingPathValue(data, playerGoldPath), { exists: true, value: 128 });
  assert.deepEqual(getExistingPathValue(data, `${playerPath}.missing_0.Int`), {
    exists: false,
    value: undefined,
  });

  assert.equal(setExistingPathValue(data, playerGoldPath, 999), true);
  assert.equal(getExistingPathValue(data, playerGoldPath).value, 999);

  assert.equal(setExistingPathValue(data, `${playerPath}.playerCurrentGold_0`, 1), false);
  assert.deepEqual(getExistingPathValue(data, `${playerPath}.playerCurrentGold_0`).value, { Int: 999 });

  assert.equal(
    setExistingPathValue(data, weatherPath, buildEnumEditValue('EC_Weather', 'Rain'), {
      enumTypes: new Set(['EC_Season']),
    }),
    false,
  );
  assert.equal(
    setExistingPathValue(data, weatherPath, buildEnumEditValue('EC_Weather', 'Rain'), {
      enumTypes: new Set(['EC_Weather']),
    }),
    true,
  );

  assert.equal(setExistingPathValue(data, `${playerPath}.missing_0.Int`, 1), false);
  assert.equal(Object.hasOwn(data.root.properties.SaveData_0.Struct.value.Struct.players_0, 'missing_0'), false);
}

function testNodeDescriptionAndChildren() {
  const data = sampleSave();
  const structPath = 'root.properties.SaveData_0.Struct.value.Struct';
  const structValue = getExistingPathValue(data, structPath).value;
  const children = listExplorerChildren(structValue, structPath, 6, {
    enumTypes: new Set(['EC_Weather']),
  });

  assert.equal(children.length, 2);
  assert.deepEqual(
    children.map((child) => [child.key, child.path, child.kind, child.childCount]),
    [
      ['currentWeather_0', `${structPath}.currentWeather_0`, 'enum', 1],
      ['players_0', `${structPath}.players_0`, 'object', 1],
    ],
  );

  assert.deepEqual(describeExplorerNode(128, playerGoldPath, 'Int', 10).edit, {
    kind: 'number',
    currentValue: 128,
  });
  assert.deepEqual(describeExplorerNode('Ava', playerNamePath, 'Str', 12).edit, {
    kind: 'string',
    currentValue: 'Ava',
  });
  assert.deepEqual(describeExplorerNode(true, playerIntroPath, 'Bool', 12).edit, {
    kind: 'boolean',
    currentValue: true,
  });

  const weatherValue = getExistingPathValue(data, weatherPath).value;
  assert.deepEqual(
    describeExplorerNode(weatherValue, weatherPath, 'currentWeather_0', 6, new Set(['EC_Weather'])).edit,
    {
      kind: 'enum',
      enumType: 'EC_Weather',
      currentValue: 'EC_Weather::Sunny',
    },
  );
  assert.equal(describeExplorerNode(weatherValue, weatherPath, 'currentWeather_0', 6).edit, null);
}

function testSearchAndCoercion() {
  const data = sampleSave();

  const byPath = searchExplorerNodes(data, 'gold', { limit: 10, enumTypes: new Set(['EC_Weather']) });
  assert.equal(
    byPath.some((node) => node.path === playerGoldPath),
    true,
  );

  const byValue = searchExplorerNodes(data, 'sunny', { limit: 10, enumTypes: new Set(['EC_Weather']) });
  assert.equal(
    byValue.some((node) => node.path === weatherPath),
    true,
  );

  const capped = searchExplorerNodes(data, '0', { limit: 2, enumTypes: new Set(['EC_Weather']) });
  assert.equal(capped.length, 2);

  const wideData = {
    root: {
      fields: Object.fromEntries(
        Array.from({ length: 150 }, (_value, index) => [
          `field_${index}`,
          {
            Str: index === 149 ? 'needle' : `value-${index}`,
          },
        ]),
      ),
    },
  };
  const deepSibling = searchExplorerNodes(wideData, 'needle', { limit: 10 });
  assert.equal(
    deepSibling.some((node) => node.path === 'root.fields.field_149.Str'),
    true,
  );

  assert.equal(coercePrimitiveEditValue('number', '42'), 42);
  assert.equal(coercePrimitiveEditValue('number', '42', { integer: true }), 42);
  assert.equal(coercePrimitiveEditValue('string', 42), '42');
  assert.equal(coercePrimitiveEditValue('boolean', true), true);
  assert.throws(() => coercePrimitiveEditValue('number', ''), /valid number/);
  assert.throws(() => coercePrimitiveEditValue('number', '42.5', { integer: true }), /whole number/);
  assert.deepEqual(buildEnumEditValue('EC_Weather', 'Sunny'), {
    Enum: {
      enum_type: 'EC_Weather',
      value: 'EC_Weather::Sunny',
    },
  });
}

testPathParsing();
testExistingPathAccess();
testNodeDescriptionAndChildren();
testSearchAndCoercion();

console.log('save explorer model tests passed');
