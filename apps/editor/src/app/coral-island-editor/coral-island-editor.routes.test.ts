import assert from 'node:assert/strict';
import '@angular/compiler';
import { CORAL_ISLAND_EDITOR_ROUTES } from './coral-island-editor.routes';

function testDefaultEditorRouteOpensFirstPlayer() {
  const childRoutes = CORAL_ISLAND_EDITOR_ROUTES[0].children ?? [];
  const defaultRoute = childRoutes.find((route) => route.path === '');

  assert.equal(defaultRoute?.pathMatch, 'full');
  assert.equal(defaultRoute?.redirectTo, 'player/0');
}

testDefaultEditorRouteOpensFirstPlayer();

console.log('coral island editor route tests passed');
