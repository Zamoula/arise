# Arise

A calm, "Solo Leveling"-inspired habit tracker built with **Angular**, **Ionic** and **Capacitor**. Track daily rituals by moment of the day, keep a completion history, and watch your consistency grow through stats, streaks and badges.

## Features

- **Today** — daily progress ring, week strip, moment filters (morning / afternoon / evening) and one-tap validation of habits.
- **Habits** — create and edit habits with an icon, reminder time, weekly schedule (daily, specific days or a weekly goal) and a goal count; stats group them into health, mind and growth categories from their icon.
- **Habit detail** — monthly completion calendar, recent history, key figures (streak, rate, best day) and an "adjust time" sheet.
- **Stats** — completion rate, rhythm chart, snapshots, category balance and unlockable badges for the week, month or year.
- **Profile** — all-time totals, avatar picker, theme (`warm`, `dark`, `auto`), sound choice, language (`fr` / `en`) and quiet hours.
- **Reminders** — local notifications that follow each habit's schedule, persisted preferences, and a quiet-hours window that silences them (e.g. 22:00 → 07:00).
- **Offline-first** — habits, avatar, theme, language and notification settings are stored locally with `@capacitor/preferences`; no backend is required.

## Tech stack

| Concern    | Tooling                                                        |
| ---------- | -------------------------------------------------------------- |
| Framework  | Angular 22 (standalone components, signals, new control flow)  |
| UI         | Ionic 9, SCSS, Material Symbols                                |
| Native     | Capacitor 8 (Android target)                                   |
| Storage    | `@capacitor/preferences`                                       |
| Tests      | Vitest + Angular unit-test builder, Playwright (Mobile Chrome) |
| Lint/format | ESLint (Angular + TypeScript), Prettier (`@ionic/prettier-config`) |

## Getting started

### Prerequisites

- Node.js 20.19+ or 22.12+ and npm
- (Optional, for e2e) `npx playwright install chromium`
- (Optional, for Android) Android Studio with a configured SDK, plus the `@capacitor/android` platform

### Install and run

```bash
npm install
npm start          # ng serve → http://localhost:4200
```

The app runs in the browser with the Ionic web implementation of the Capacitor plugins (storage, notifications, status bar).

## Available scripts

| Script                    | Description                                                    |
| ------------------------- | -------------------------------------------------------------- |
| `npm start`               | Start the dev server (`ng serve`)                              |
| `npm run build`           | Production build into `www/`                                   |
| `npm run watch`           | Development build in watch mode                                |
| `npm run lint`            | ESLint + e2e type-check + Prettier check                       |
| `npm run lint:fix`        | ESLint and Prettier with auto-fix                              |
| `npm run test`            | Unit tests, then end-to-end tests                              |
| `npm run test:unit`       | Unit tests once (Vitest through `ng test`)                     |
| `npm run test:unit:watch` | Unit tests in watch mode                                       |
| `npm run test:e2e`        | Playwright suite (starts the dev server on port 4200)          |

## Native builds (Android)

```bash
npm run build
npx cap sync android
npx cap open android      # then build/run from Android Studio
```

The web assets are emitted to `www/`, which is the `webDir` configured in `capacitor.config.ts`. App icons and splash assets are generated from `resources/icon-source.png` with `@capacitor/assets`.

## Project structure

```
src/
├── app/
│   ├── add-habit/          # Create a habit
│   ├── edit-habit/         # Edit an existing habit
│   ├── habit-detail/       # Calendar, history, KPIs, schedule sheet
│   ├── home/               # Today: progress ring, week strip, habit list
│   ├── stats/              # Weekly / monthly / yearly statistics
│   ├── profile/            # Totals, theme, language, reminders, avatar
│   ├── models/             # Pure logic: dates, stats, calendars, schedules
│   ├── services/           # Habit, theme, translation, notifications, quiet hours
│   ├── shared/             # App header and shared habit form
│   ├── i18n/               # French + English translations
│   └── app.routes.ts       # Route definitions
├── assets/                 # Static assets
├── theme/                  # Ionic/SCSS theme variables
└── global.scss             # Global styles
e2e/                        # Playwright specs
resources/                  # Icon sources for @capacitor/assets
```

## Architecture notes

- **Services own state, models stay pure.** `HabitService` holds the reactive `sections` signal and persists it; statistics and calendars are built by pure functions in `src/app/models/`, which makes them easy to test.
- **Signals everywhere.** Pages derive their view state with `computed()` from the shared services, so the UI reacts to habit changes without manual subscriptions.
- **Persistence with graceful fallback.** Every storage read/write is guarded: if storage is unavailable, the app keeps working in memory for the session.
- **Reminders are rebuilt, not patched.** Whenever habits, the switch, quiet hours or the language change, pending notifications are cancelled and regenerated for the next 7 days.

## Data storage keys

| Key                          | Content                                 |
| ---------------------------- | --------------------------------------- |
| `zen-habits-v1`              | Habit sections and completion history   |
| `zen-avatar-url`             | Chosen profile avatar (data URL)        |
| `zen-theme-choice`           | `warm` \| `dark` \| `auto`              |
| `zen-language`               | Selected language (`fr` / `en`)         |
| `zen-reminders-enabled`      | Profile-level reminders switch          |
| `zen-quiet-hours-enabled`    | Quiet-hours switch                      |
| `zen-quiet-hours-start/end`  | Quiet-hours window (`HH:mm`)            |

## License

Private project — not published.
