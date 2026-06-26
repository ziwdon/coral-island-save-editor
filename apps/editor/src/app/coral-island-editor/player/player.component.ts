import { Component, computed, input } from '@angular/core';
import { PlayerInfoComponent } from './player-info/player-info.component';
import { SaveGameValuePipe } from '../../core/save-game/save-game-value.pipe';
import { CardComponent } from '@coral-island/ui';
import { playerStructPath } from '../../core/save-game/coral-island-save-paths';

@Component({
  selector: 'app-player',
  standalone: true,
  imports: [PlayerInfoComponent, SaveGameValuePipe, CardComponent],
  templateUrl: './player.component.html',
  styleUrl: './player.component.scss',
})
export class PlayerComponent {
  index = input.required();
  playerPath = computed(() => playerStructPath(String(this.index())));
}
