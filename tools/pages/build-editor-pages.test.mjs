import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildEditorArgs, normalizePagesBasePath } from './build-editor-pages.mjs';

assert.equal(normalizePagesBasePath('/coral-island-save-editor/'), '/coral-island-save-editor/');
assert.equal(normalizePagesBasePath('/preview-path/'), '/preview-path/');

assert.throws(() => normalizePagesBasePath('coral-island-save-editor/'), /must start with "\/"/);
assert.throws(() => normalizePagesBasePath('/coral-island-save-editor'), /must end with "\/"/);
assert.throws(() => normalizePagesBasePath('/'), /must include a repository path segment/);

assert.deepEqual(buildEditorArgs('/coral-island-save-editor/'), [
  'nx',
  'run',
  'editor:build:production',
  '--base-href=/coral-island-save-editor/',
]);

const sourceFiles = [
  ...walkFiles('apps/editor/src', ['.html', '.scss']),
  ...walkFiles('libs/coral-island-ui/src', ['.html', '.scss']),
];
const rootRelativeAssetReferences = sourceFiles.flatMap((filePath) => {
  const source = readFileSync(filePath, 'utf8');
  const matches = source.matchAll(/src=["']\/(?!\/)|url\(\s*["']?\//g);

  return Array.from(matches, (match) => `${filePath}:${match.index}`);
});

assert.deepEqual(rootRelativeAssetReferences, [], 'source assets must not use root-relative URLs');

console.log('build editor pages script tests passed');

function walkFiles(root, extensions) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);

    if (entry.isDirectory()) {
      return walkFiles(path, extensions);
    }

    return extensions.some((extension) => path.endsWith(extension)) ? [path] : [];
  });
}
