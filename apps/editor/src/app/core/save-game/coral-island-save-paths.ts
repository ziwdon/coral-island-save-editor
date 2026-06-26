export const SAVE_DATA_STRUCT_PATH = 'root.properties.saveData_0.Struct.value.Struct' as const;
export const PLAYERS_ARRAY_PATH = `${SAVE_DATA_STRUCT_PATH}.players_0.Array.value.Struct.value` as const;
export const CURRENT_DATE_PATH = `${SAVE_DATA_STRUCT_PATH}.currentDate_0` as const;
export const CURRENT_WEATHER_PATH = `${SAVE_DATA_STRUCT_PATH}.currentWeather_0` as const;

export function playerStructPath(index: number | string): string {
  return `${PLAYERS_ARRAY_PATH}.${index}.Struct`;
}
