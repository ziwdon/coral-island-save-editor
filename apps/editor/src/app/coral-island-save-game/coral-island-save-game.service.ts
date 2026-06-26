import { computed, Injectable, signal } from '@angular/core';
import { CoralIslandSaveGame } from './coral-island-save-game.type';
import { getExistingPathValue } from '../core/save-game/save-game-path';
import { PLAYERS_ARRAY_PATH } from '../core/save-game/coral-island-save-paths';

@Injectable({
  providedIn: 'root',
})
export class CoralIslandSaveGameService {
  saveGame = signal<null | undefined | CoralIslandSaveGame>(null);
  players = computed(() => {
    const players = getExistingPathValue(this.saveGame(), PLAYERS_ARRAY_PATH).value;
    return Array.isArray(players) ? players : [];
  });
}
