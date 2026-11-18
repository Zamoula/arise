import { Component, inject, input, output } from '@angular/core';
import { IonPopover } from '@ionic/angular';

import { TranslationService } from '../../services/translation.service';

/**
 * Fixed top bar shared by every page.
 * Tab pages (Home, Stats, Profile) render the brand with the notifications
 * popover; stack pages (Add/Edit habit, Habit detail) add a back button and
 * delegate navigation to the page through the `back` output.
 */
@Component({
  selector: 'app-header',
  templateUrl: './app-header.component.html',
  styleUrls: ['./app-header.component.scss'],
  imports: [IonPopover],
})
export class AppHeaderComponent {
  private readonly translation = inject(TranslationService);

  /** Shows the back button (stack pages) instead of the bare brand. */
  readonly showBack = input(false);

  /** Emitted when the back button is pressed; the page decides how to navigate. */
  readonly back = output<void>();

  /** Translated string lookup for the template. */
  readonly t = this.translation.t.bind(this.translation);
}
