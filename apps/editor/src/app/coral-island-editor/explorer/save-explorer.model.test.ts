import assert from 'node:assert/strict';
import { SaveGameService } from '../../core/save-game/save-game.service';
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
import {
  CURRENT_DATE_PATH,
  CURRENT_WEATHER_PATH,
  PLAYERS_ARRAY_PATH,
  SAVE_DATA_STRUCT_PATH,
  playerStructPath,
} from '../../core/save-game/coral-island-save-paths';
import { enumOptionsForPathValue } from '../forms/enum-form/enum-form.model';

function sampleSave() {
  return {
    root: {
      properties: {
        saveData_0: {
          Struct: {
            value: {
              Struct: {
                currentDate_0: {
                  Struct: {
                    value: {
                      Struct: {
                        day_0: { Int: 1 },
                      },
                    },
                    struct_type: {
                      Struct: 'C_TimeDate',
                    },
                    struct_id: '00000000-0000-0000-0000-000000000000',
                  },
                },
                currentWeather_0: {
                  Enum: {
                    enum_type: 'EC_Weather',
                    value: 'EC_Weather::Sunny',
                  },
                },
                labLevel_0: {
                  Byte: {
                    value: {
                      Byte: 1,
                    },
                  },
                },
                consecutiveDryDays_0: {
                  UInt32: 0,
                },
                toolType_0: {
                  Enum: {
                    enum_type: 'EC_ToolType',
                    value: 'None',
                  },
                },
                players_0: {
                  Array: {
                    value: {
                      Struct: {
                        value: [
                          {
                            Struct: {
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
    },
  };
}

const playerPath = `${PLAYERS_ARRAY_PATH}[0].Struct`;
const playerGoldPath = `${playerPath}.playerCurrentGold_0.Int`;
const playerNamePath = `${playerPath}.playerInfo_0.Struct.value.Struct.Name_0.Str`;
const playerIntroPath = `${playerPath}.playerInfo_0.Struct.value.Struct.hasSeenIntro_0.Bool`;
const weatherPath = CURRENT_WEATHER_PATH;
const bytePath = `${SAVE_DATA_STRUCT_PATH}.labLevel_0.Byte.value.Byte`;
const uint32Path = `${SAVE_DATA_STRUCT_PATH}.consecutiveDryDays_0.UInt32`;
const rawEnumPath = `${SAVE_DATA_STRUCT_PATH}.toolType_0`;

function testPathParsing() {
  const segments = parseExplorerPath(`${playerPath}.playerInfo_0.Struct`);

  assert.deepEqual(segments, [
    { key: 'root' },
    { key: 'properties' },
    { key: 'saveData_0' },
    { key: 'Struct' },
    { key: 'value' },
    { key: 'Struct' },
    { key: 'players_0' },
    { key: 'Array' },
    { key: 'value' },
    { key: 'Struct' },
    { key: 'value', index: 0 },
    { key: 'Struct' },
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

  const rawEnumValue = getExistingPathValue(data, rawEnumPath).value as {
    Enum: {
      enum_type: string;
      value: string;
    };
  };
  const rawEnumNoOp = buildEnumEditValue(rawEnumValue.Enum.enum_type, rawEnumValue.Enum.value, rawEnumValue.Enum.value);
  assert.equal(
    setExistingPathValue(data, rawEnumPath, rawEnumNoOp, {
      enumTypes: new Set(['EC_ToolType']),
    }),
    true,
  );
  assert.deepEqual(getExistingPathValue(data, rawEnumPath).value, rawEnumValue);

  assert.equal(setExistingPathValue(data, `${playerPath}.missing_0.Int`, 1), false);
  assert.equal(Object.hasOwn(data.root.properties.saveData_0.Struct.value.Struct.players_0, 'missing_0'), false);

  assert.equal(setExistingPathValue(data, bytePath, 255), true);
  assert.equal(getExistingPathValue(data, bytePath).value, 255);
  assert.equal(setExistingPathValue(data, bytePath, 300), false);
  assert.equal(getExistingPathValue(data, bytePath).value, 255);
  assert.equal(setExistingPathValue(data, uint32Path, -1), false);
  assert.equal(setExistingPathValue(data, uint32Path, 4_294_967_296), false);
  assert.equal(setExistingPathValue(data, uint32Path, 4_294_967_295), true);
}

function testFocusedEditorCanonicalPaths() {
  const data = sampleSave();

  assert.equal(getExistingPathValue(data, SAVE_DATA_STRUCT_PATH).exists, true);
  assert.equal(getExistingPathValue(data, PLAYERS_ARRAY_PATH).exists, true);
  assert.equal(getExistingPathValue(data, CURRENT_DATE_PATH).exists, true);
  assert.equal(getExistingPathValue(data, CURRENT_WEATHER_PATH).exists, true);
  assert.equal(getExistingPathValue(data, 'root.properties.SaveData_0.Struct.value.Struct').exists, false);
  assert.equal(playerStructPath(0), `${PLAYERS_ARRAY_PATH}.0.Struct`);
}

function testSaveGameServiceSetOnlyUpdatesExistingPaths() {
  const data = sampleSave();
  const service = new SaveGameService();
  service.decodedData.set(data);

  service.set(`${playerStructPath(0)}.playerCurrentGold_0.Int`, 777);
  assert.equal(getExistingPathValue(data, playerGoldPath).value, 777);

  service.set(`${playerStructPath(0)}.playerCurrentGold_0.Int`, 42.5);
  assert.equal(getExistingPathValue(data, playerGoldPath).value, 777);

  service.set(`${playerStructPath(0)}.playerCurrentGold_0.Int`, 2_147_483_648);
  assert.equal(getExistingPathValue(data, playerGoldPath).value, 777);

  service.set(`${playerStructPath(99)}.playerCurrentGold_0.Int`, 999);
  const players = getExistingPathValue(data, PLAYERS_ARRAY_PATH).value as unknown[];
  assert.equal(players.length, 1);
  assert.equal(Object.hasOwn(players, '99'), false);

  const editedDate = {
    Struct: {
      value: {
        Struct: {
          day_0: { Int: 2 },
        },
      },
      struct_type: {
        Struct: 'C_TimeDate',
      },
      struct_id: '00000000-0000-0000-0000-000000000000',
    },
  };
  service.set(CURRENT_DATE_PATH, editedDate);
  assert.deepEqual(getExistingPathValue(data, CURRENT_DATE_PATH).value, editedDate);
}

function testNodeDescriptionAndChildren() {
  const data = sampleSave();
  const structPath = SAVE_DATA_STRUCT_PATH;
  const structValue = getExistingPathValue(data, structPath).value;
  const children = listExplorerChildren(structValue, structPath, 6, {
    enumTypes: new Set(['EC_Weather', 'EC_ToolType']),
  });

  assert.equal(children.length, 6);
  assert.deepEqual(
    children.map((child) => [child.key, child.path, child.kind, child.childCount]),
    [
      ['currentDate_0', `${structPath}.currentDate_0`, 'object', 1],
      ['currentWeather_0', `${structPath}.currentWeather_0`, 'enum', 1],
      ['labLevel_0', `${structPath}.labLevel_0`, 'object', 1],
      ['consecutiveDryDays_0', `${structPath}.consecutiveDryDays_0`, 'object', 1],
      ['toolType_0', `${structPath}.toolType_0`, 'enum', 1],
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

  const veryWideData = {
    root: {
      fields: Object.fromEntries(
        Array.from({ length: 9000 }, (_value, index) => [
          `field_${index}`,
          {
            Str: index === 8999 ? 'late-needle' : `wide-value-${index}`,
          },
        ]),
      ),
    },
  };
  const lateDefaultSearch = searchExplorerNodes(veryWideData, 'late-needle', { limit: 10 });
  assert.equal(
    lateDefaultSearch.some((node) => node.path === 'root.fields.field_8999.Str'),
    true,
  );

  assert.equal(coercePrimitiveEditValue('number', '42'), 42);
  assert.equal(coercePrimitiveEditValue('number', '42', { integer: true }), 42);
  assert.equal(coercePrimitiveEditValue('number', '255', { integer: true, min: 0, max: 255 }), 255);
  assert.equal(coercePrimitiveEditValue('string', 42), '42');
  assert.equal(coercePrimitiveEditValue('boolean', true), true);
  assert.throws(() => coercePrimitiveEditValue('number', ''), /valid number/);
  assert.throws(() => coercePrimitiveEditValue('number', '42.5', { integer: true }), /whole number/);
  assert.throws(
    () => coercePrimitiveEditValue('number', '300', { integer: true, min: 0, max: 255 }),
    /between 0 and 255/,
  );
  assert.deepEqual(buildEnumEditValue('EC_Weather', 'Sunny'), {
    Enum: {
      enum_type: 'EC_Weather',
      value: 'EC_Weather::Sunny',
    },
  });
  assert.deepEqual(buildEnumEditValue('EC_ToolType', 'None', 'None'), {
    Enum: {
      enum_type: 'EC_ToolType',
      value: 'None',
    },
  });
}

function testFocusedEnumOptionsHandleMissingPaths() {
  assert.equal(enumOptionsForPathValue(undefined).length, 0);
  assert.equal(enumOptionsForPathValue({}).length, 0);
  assert.equal(enumOptionsForPathValue({ Enum: { enum_type: 'MissingEnum', value: 'MissingEnum::Value' } }).length, 0);
  assert.deepEqual(enumOptionsForPathValue({ Enum: { enum_type: 'EC_Weather', value: 'EC_Weather::Sunny' } }), [
    'EC_Weather::None',
    'EC_Weather::Sunny',
    'EC_Weather::Rain',
    'EC_Weather::Storm',
    'EC_Weather::Windy',
    'EC_Weather::Snow',
    'EC_Weather::Blizzard',
    'EC_Weather::COUNT',
  ]);
}

testPathParsing();
testExistingPathAccess();
testFocusedEditorCanonicalPaths();
testSaveGameServiceSetOnlyUpdatesExistingPaths();
testNodeDescriptionAndChildren();
testSearchAndCoercion();
testFocusedEnumOptionsHandleMissingPaths();

console.log('save explorer model tests passed');
