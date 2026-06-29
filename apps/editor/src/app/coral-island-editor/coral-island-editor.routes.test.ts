import assert from 'node:assert/strict';
import '@angular/compiler';
import { CORAL_ISLAND_EDITOR_ROUTES } from './coral-island-editor.routes';

function testDefaultEditorRouteOpensFirstPlayer() {
  const childRoutes = CORAL_ISLAND_EDITOR_ROUTES[0].children ?? [];
  const defaultRoute = childRoutes.find((route) => route.path === '');

  assert.equal(defaultRoute?.pathMatch, 'full');
  assert.equal(defaultRoute?.redirectTo, 'player/0');
}

function testRelationshipsRouteIsBetweenQuestsAndExplorer() {
  const childRoutes = CORAL_ISLAND_EDITOR_ROUTES[0].children ?? [];
  const routePaths = childRoutes.map((route) => route.path);

  assert.ok(childRoutes.find((route) => route.path === 'relationships'));
  assert.deepEqual(
    routePaths.filter((path) => ['quests', 'relationships', 'explorer'].includes(String(path))),
    ['quests', 'relationships', 'explorer'],
  );
}

testDefaultEditorRouteOpensFirstPlayer();
testRelationshipsRouteIsBetweenQuestsAndExplorer();

console.log('coral island editor route tests passed');
