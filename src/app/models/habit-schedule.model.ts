import type { Language } from '../i18n/translations';
import { TRANSLATIONS } from '../i18n/translations';
import type { Frequency } from '../services/habit.service';

/** Full weekday names, Monday first. */
const LONG_DAY_NAMES: Record<Language, string[]> = {
  fr: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'],
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
};

/** Abbreviated weekday names, Monday first. */
const SHORT_DAY_NAMES: Record<Language, string[]> = {
  fr: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
};

/**
 * Builds the short human-readable description of a habit schedule, e.g.
 * "Tous les jours · 2× par jour" or "Every Monday". Used to store a habit's
 * detail line and to display it again (in the current language) on the
 * habit detail page.
 */
export function describeSchedule(frequency: Frequency, days: boolean[], goal = 1, lang: Language = 'fr'): string {
  let detail: string;
  switch (frequency) {
    case 'weekly': {
      const index = days.findIndex(Boolean);
      detail = t(lang, 'frequency.weeklyDay', {
        day: LONG_DAY_NAMES[lang][index >= 0 ? index : 0],
      });
      break;
    }
    case 'custom': {
      const selected = days
        .map((isSelected, index) => (isSelected ? SHORT_DAY_NAMES[lang][index] : ''))
        .filter(Boolean);
      detail = selected.length > 0 ? selected.join(', ') : t(lang, 'frequency.daily');
      break;
    }
    default:
      detail = t(lang, 'frequency.daily');
      break;
  }
  if (goal > 1) {
    detail = `${detail} · ${goal}${t(lang, 'form.perDay')}`;
  }
  return detail;
}

/** Translates a key for the given language, interpolating `{name}` params. */
function t(lang: Language, key: string, params?: Record<string, string | number>): string {
  let text = TRANSLATIONS[lang][key] ?? TRANSLATIONS.fr[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}
