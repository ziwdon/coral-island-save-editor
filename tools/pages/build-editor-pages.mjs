import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const PACKAGE_JSON_URL = new URL('../../package.json', import.meta.url);

export function normalizePagesBasePath(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Editor Pages base path must be a non-empty string.');
  }

  if (value !== value.trim()) {
    throw new Error('Editor Pages base path must not include surrounding whitespace.');
  }

  if (!value.startsWith('/')) {
    throw new Error('Editor Pages base path must start with "/".');
  }

  if (!value.endsWith('/')) {
    throw new Error('Editor Pages base path must end with "/".');
  }

  if (value === '/') {
    throw new Error('Editor Pages base path must include a repository path segment.');
  }

  return value;
}

export function buildEditorArgs(baseHref) {
  return ['nx', 'run', 'editor:build:production', `--base-href=${normalizePagesBasePath(baseHref)}`];
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

export async function main() {
  const packageJson = JSON.parse(await readFile(PACKAGE_JSON_URL, 'utf8'));
  const baseHref = normalizePagesBasePath(packageJson.config?.editorPagesBaseHref);

  runCommand('nx', ['run', 'save_parser:build-wasm']);

  const [command, ...args] = buildEditorArgs(baseHref);
  runCommand(command, args);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
