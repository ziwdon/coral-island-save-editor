import * as fs from 'fs';
import * as path from 'path';

const headerFileContent = fs.readFileSync(path.join(__dirname, 'ProjectCoral.h'), { encoding: 'utf8' });

const regex = /enum class (?<enumType>.*?) : .*?{\s(?<enumValues>.*?)};/gms;

let m;

const enums: Record<string, string[]> = {};
const identifierPattern = /^[A-Za-z_$][\w$]*$/;

const formatPropertyName = (name: string) => (identifierPattern.test(name) ? name : formatString(name));

const formatString = (value: string) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const formatProperty = (name: string, values: string[]) => {
  const propertyName = formatPropertyName(name);
  const inlineProperty = `  ${propertyName}: [${values.map(formatString).join(', ')}],`;

  if (inlineProperty.length <= 120) {
    return [inlineProperty];
  }

  return [`  ${propertyName}: [`, ...values.map((value) => `    ${formatString(value)},`), '  ],'];
};

const formatEnums = (enumValues: Record<string, string[]>) =>
  [
    'export const CORAL_ISLAND_ENUMS = {',
    ...Object.entries(enumValues).flatMap(([name, values]) => formatProperty(name, values)),
    '} as const;',
    '',
  ].join('\n');

while ((m = regex.exec(headerFileContent)) !== null) {
  // This is necessary to avoid infinite loops with zero-width matches
  if (m.index === regex.lastIndex) {
    regex.lastIndex++;
  }

  const name = m.groups?.enumType.trim();

  if (!name) continue;

  const values = (m.groups?.enumValues as string)
    .split('\n')
    .map((s: string) => s.trim())
    .filter(Boolean)
    .map((s) => s.split('=')[0].trim().replace('__', '::'));

  if (!values.length) continue;

  enums[name] = values;
}

fs.writeFileSync(path.join(__dirname, 'coral-island-enums.const.ts'), formatEnums(enums), { flag: 'w' });
