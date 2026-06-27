import { Component, inject, Signal } from '@angular/core';
import { SaveGameService } from '../../core/save-game/save-game.service';
import { SaveGameValuePipe } from '../../core/save-game/save-game-value.pipe';
import { MoneyComponent } from '@coral-island/ui';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { PLAYERS_ARRAY_PATH } from '../../core/save-game/coral-island-save-paths';

@Component({
  selector: 'app-players-list',
  standalone: true,
  imports: [SaveGameValuePipe, MoneyComponent, RouterLink, RouterLinkActive],
  templateUrl: './players-list.component.html',
})
export class PlayersListComponent {
  protected readonly PLAYERS_ARRAY_PATH = PLAYERS_ARRAY_PATH;
  #saveGameService = inject(SaveGameService);

  players = this.#saveGameService.get(this.PLAYERS_ARRAY_PATH) as Signal<any[]>;
}
