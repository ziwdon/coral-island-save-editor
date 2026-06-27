import { Component, computed, inject, signal } from '@angular/core';
import { SaveGameService } from '../../core/save-game/save-game.service';
import { PrettyEnumPipe } from '../../shared/pipes/pretty-enum.pipe';
import {
  buildQuestStepStatusValue,
  QuestRuntimeEntry,
  QuestRuntimeObjective,
  questRuntimeEntryMatches,
  questRuntimeEnumOptionMatches,
  QUEST_STATE_OPTIONS,
  QUEST_STEP_STATUS_OPTIONS,
  readQuestRuntimeEntries,
} from './quest-runtime.model';

@Component({
  selector: 'app-quest-runtime',
  standalone: true,
  imports: [PrettyEnumPipe],
  templateUrl: './quest-runtime.component.html',
  styleUrl: './quest-runtime.component.scss',
})
export class QuestRuntimeComponent {
  protected readonly questStateOptions = QUEST_STATE_OPTIONS;
  protected readonly questStepStatusOptions = QUEST_STEP_STATUS_OPTIONS;
  protected readonly searchQuery = signal('');
  protected readonly message = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  readonly #saveGameService = inject(SaveGameService);

  protected readonly entries = computed(() => {
    const data = this.#saveGameService.decodedData();
    const query = this.searchQuery();

    return readQuestRuntimeEntries(data).filter((entry) => questRuntimeEntryMatches(entry, query));
  });

  protected readonly objectiveCount = computed(() =>
    this.entries().reduce((total, entry) => total + entry.objectives.length, 0),
  );

  protected updateQuestState(entry: QuestRuntimeEntry, state: string) {
    if (!(this.questStateOptions as readonly string[]).includes(state)) {
      this.#setError('Unknown quest state.');
      return;
    }

    this.#applyExistingEdit(entry.statePath, state);
  }

  protected isQuestStateOptionSelected(entry: QuestRuntimeEntry, option: string) {
    return questRuntimeEnumOptionMatches('EC_QuestState', entry.state, option);
  }

  protected updateObjectiveStatus(objective: QuestRuntimeObjective, status: string) {
    if (!(this.questStepStatusOptions as readonly string[]).includes(status)) {
      this.#setError('Unknown objective status.');
      return;
    }

    this.#applyExistingEdit(objective.statusPath, buildQuestStepStatusValue(status));
  }

  protected isObjectiveStatusOptionSelected(objective: QuestRuntimeObjective, option: string) {
    return questRuntimeEnumOptionMatches('EC_QuestStepStatus', objective.status, option);
  }

  protected updateObjectiveProgress(objective: QuestRuntimeObjective, value: string) {
    const progress = Number(value);

    if (!Number.isInteger(progress) || progress < 0) {
      this.#setError('Progress must be a non-negative whole number.');
      return;
    }

    this.#applyExistingEdit(objective.progressPath, progress);
  }

  #applyExistingEdit(path: string, value: unknown) {
    if (!this.#saveGameService.setExisting(path, value)) {
      this.#setError('This quest field could not be updated because the path no longer exists.');
      return;
    }

    this.error.set(null);
    this.message.set('Updated in memory. Use export to download the modified save.');
  }

  #setError(message: string) {
    this.message.set(null);
    this.error.set(message);
  }
}
