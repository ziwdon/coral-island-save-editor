import { CoralIslandEditorComponent } from './coral-island-editor.component';
import { Routes } from '@angular/router';

export const CORAL_ISLAND_EDITOR_ROUTES: Routes = [
  {
    path: '',
    component: CoralIslandEditorComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'explorer' },
      {
        path: 'world',
        loadComponent: () => import('./world/world.component').then((c) => c.WorldComponent),
      },
      {
        path: 'explorer',
        loadComponent: () => import('./explorer/explorer.component').then((c) => c.ExplorerComponent),
      },
      {
        path: 'quests',
        loadComponent: () => import('./quest-runtime/quest-runtime.component').then((c) => c.QuestRuntimeComponent),
      },
      {
        path: 'player/:index',
        loadComponent: () => import('./player/player.component').then((c) => c.PlayerComponent),
      },
      { path: '**', redirectTo: 'explorer' },
    ],
  },
];
