import { Component, computed, inject, signal } from '@angular/core';
import { SaveGameService } from '../../core/save-game/save-game.service';
import {
  heartLevelToPoints,
  MAX_RELATIONSHIP_HEART_LEVEL,
  readRelationshipHeartEntries,
  readRelationshipPlayers,
  RelationshipHeartEntry,
  relationshipHeartEntryMatches,
} from './relationship-hearts.model';

@Component({
  selector: 'app-relationship-hearts',
  standalone: true,
  templateUrl: './relationship-hearts.component.html',
  styleUrl: './relationship-hearts.component.scss',
})
export class RelationshipHeartsComponent {
  protected readonly maxHeartLevel = MAX_RELATIONSHIP_HEART_LEVEL;
  protected readonly searchQuery = signal('');
  protected readonly selectedPlayerIndex = signal(0);
  protected readonly message = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  readonly #saveGameService = inject(SaveGameService);

  protected readonly players = computed(() => readRelationshipPlayers(this.#saveGameService.decodedData()));

  protected readonly entries = computed(() => {
    const data = this.#saveGameService.decodedData();
    const query = this.searchQuery();

    return readRelationshipHeartEntries(data, this.selectedPlayerIndex())
      .filter((entry) => relationshipHeartEntryMatches(entry, query))
      .sort((a, b) => a.npcId.localeCompare(b.npcId));
  });

  protected selectPlayer(indexValue: string) {
    const index = Number(indexValue);

    if (!Number.isInteger(index) || !this.players().some((player) => player.index === index)) {
      this.#setError('Unknown player record.');
      return;
    }

    this.selectedPlayerIndex.set(index);
    this.error.set(null);
    this.message.set(null);
  }

  protected stepHeartLevel(entry: RelationshipHeartEntry, delta: number) {
    const nextLevel = entry.heartLevel.aboveKnownCap && delta < 0 ? this.maxHeartLevel : entry.heartLevel.level + delta;

    this.updateHeartLevel(entry, String(nextLevel));
  }

  protected updateHeartLevel(entry: RelationshipHeartEntry, levelValue: string) {
    const level = Number(levelValue);
    const points = heartLevelToPoints(level);

    if (points === null) {
      this.#setError(`Heart level must be a whole number from 0 to ${this.maxHeartLevel}.`);
      return;
    }

    if (!this.#saveGameService.setExisting(entry.pointsPath, points)) {
      this.#setError('This relationship field could not be updated because the path no longer exists.');
      return;
    }

    this.error.set(null);
    this.message.set('Updated in memory. Use export to download the modified save.');
  }

  protected canIncrease(entry: RelationshipHeartEntry): boolean {
    return !entry.heartLevel.aboveKnownCap && entry.heartLevel.level < this.maxHeartLevel;
  }

  protected canDecrease(entry: RelationshipHeartEntry): boolean {
    return entry.heartLevel.aboveKnownCap || entry.heartLevel.level > 0;
  }

  #setError(message: string) {
    this.message.set(null);
    this.error.set(message);
  }
}
