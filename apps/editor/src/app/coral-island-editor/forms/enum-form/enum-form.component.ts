import { Component, computed, inject, input } from '@angular/core';
import { EnumFormPartComponent } from '../../../form-parts/enum-form-part/enum-form-part.component';
import { SaveGameService } from '../../../core/save-game/save-game.service';
import { enumOptionsForPathValue, readSaveGameEnum } from './enum-form.model';

@Component({
  selector: 'app-enum-form',
  standalone: true,
  imports: [EnumFormPartComponent],
  templateUrl: './enum-form.component.html',
})
export class EnumFormComponent {
  path = input.required<string>();
  label = input.required<string>();

  #saveGameService = inject(SaveGameService);
  enumValue = computed(() => readSaveGameEnum(this.#saveGameService.get(this.path())()));
  options = computed(() => {
    return enumOptionsForPathValue(this.enumValue());
  });
}
