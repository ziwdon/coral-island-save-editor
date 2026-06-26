import { Component } from '@angular/core';
import { DateFormComponent } from '../forms/date-form/date-form.component';
import { CardComponent } from '@coral-island/ui';
import { EnumFormComponent } from '../forms/enum-form/enum-form.component';
import { CURRENT_DATE_PATH, CURRENT_WEATHER_PATH } from '../../core/save-game/coral-island-save-paths';

@Component({
  selector: 'app-world',
  standalone: true,
  imports: [DateFormComponent, CardComponent, EnumFormComponent],
  templateUrl: './world.component.html',
  styleUrl: './world.component.scss',
})
export class WorldComponent {
  protected readonly currentDatePath = CURRENT_DATE_PATH;
  protected readonly currentWeatherPath = CURRENT_WEATHER_PATH;
}
