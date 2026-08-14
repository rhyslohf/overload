# Workout Tracker

A mobile-first, offline-first single-page web app for logging workouts. Build or browse routines, run them live at the gym (weight / reps / difficulty per set), use a rest timer between sets, and get simple data-driven suggestions for what to lift next time. All data lives in the browser — full JSON export/import for backup and portability.

Day-to-day progress is tracked in [PROGRESS.md](./PROGRESS.md).

## Features

**Routine builder** — create, edit, reorder, and delete routines made of exercises and sets. Supports:

- **Standard sets** — target reps + weight
- **To-failure** — no target reps; log actual reps achieved
- **Myorep** — activation set → repeatable mini-sets (reps, rest, stop conditions)
- **Percentage-of-set** — weight = X% of an earlier set in the same exercise, computed live and rounded to your plate increment
- **Bodyweight / added-weight** — pull-ups, dips, push-ups; optional "+ added weight"
- **Warm-up sets** — excluded from overload suggestions
- Exercise-name autocomplete from a local "exercise library", with stable exercise identities (a deterministic `exerciseId` derived from the normalized name) so progression matching and autocomplete stay consistent.

**Live workout logging** — start a session from a routine (snapshots it), prefill each set from suggestions or targets, log weight/reps + a 1–5 difficulty tap-selector, add unplanned sets, skip planned ones, autosave after every set, and resume an in-progress session on reload. Finish or abandon when done.

**Rest timer** — one thumb-friendly button: tap to start counting up from 0:00, tap again to reset and keep running (no "lap"). Auto-starts the moment a set is logged; optionally shows a target-rest hint from the set definition.

**History & portability** — browse finished/abandoned sessions with a read-only detail view; export/import routines and full history as JSON with `schemaVersion`, name-collision "import as copy", and merge-or-replace history imports.

**Progressive overload** — "what did I do last time I ran this set?" suggestions scoped to (routine, exercise, set order), with a one-line rationale and a configurable rounding increment (1 / 2.5 / 5 / 10 kg) so suggestions land on plates you own.

## Tech Stack

- React 19 + TypeScript 5 + Vite
- Tailwind CSS v4 — design tokens in `src/styles/tokens.css` ("Steel & Ember" dark-first palette)
- React Context (`StorageProvider`, `SettingsProvider`) for state
- Vitest + React Testing Library for tests (171 passing)
- ESLint + Prettier with a husky pre-commit hook
- PWA: manifest, service worker (offline-first), installable icons
- Deployment: Azure Static Web Apps (`.github/workflows/azure-static-web-apps.yml` + `public/staticwebapp.config.json`)

No backend — data persists in `localStorage` behind a swappable `StorageService` interface (`src/services/localStorageAdapter.ts`), ready to be swapped for IndexedDB without touching feature code.

## Getting Started

Requires Node.js (recent LTS) and npm.

```bash
npm install      # install dependencies
npm run dev      # start the dev server
```

Then open the printed localhost URL in a browser.

### Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run test` | Run the Vitest suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run typecheck` | Type-check (`tsc -b`) |
| `npm run lint` | Lint with ESLint |
| `npm run lint:fix` | Lint and autofix |
| `npm run format` | Format with Prettier |
| `npm run coverage` | Run tests with coverage |

## Project Structure

```
/src
  /components        shared UI (Button, Switch, TextField, TapSelector, …)
  /features
    /routines        routine builder + detail
    /workout         live session logging, set log rows, rest timer
    /history         past sessions, browse/detail
    /overload        suggestion algorithm
    /settings        rounding increment setting
  /services
    storage.ts          StorageService interface
    localStorageAdapter.ts
    exportImport.ts     JSON import/export + schema migration
  /types             data model + factories
  /utils             exercise identity, formatting, id generation
  /test              test fixtures (flaky storage, storage tests)
  App.tsx / main.tsx
/public              PWA manifest, service worker, icons, SWA config
```

## Testing

```bash
npm run test                 # full suite
npm run test -- <file>       # single test file
npm run coverage             # coverage report
```

The suite covers the bug-prone logic — overload calculation, percentage math, myorep expansion, import validation — plus UI flows across every view. A refined `src/test/flakyStorage.ts` fixture drives load-error/retry states.

## Deployment

The app is a static SPA with no backend. Push to GitHub and the included workflow (`.github/workflows/azure-static-web-apps.yml`) deploys to Azure Static Web Apps (staged PR deploys, close-PR cleanup). Config in `public/staticwebapp.config.json` handles SPA fallback, security headers, and cache control.

## Data & Privacy

Everything stays in your browser's `localStorage`. Export routines or full history to JSON anytime as a backup or to move between browsers/devices; every export carries a `schemaVersion` with a migration stub so future exports remain importable.

## Status

All phases 0–8 complete: scaffolding/design foundations through routine builder, advanced set types, live logging, rest timer, history/portability, progressive-overload intelligence, polish (accessibility, empty/error states, PWA, deployment), and the recommended additions (stable exercise identity, bodyweight support, warm-up flag, rounding increment). **171 tests passing.** See [PROGRESS.md](./PROGRESS.md) for the full history and deviation log.

Explicitly beyond scope (future ideas): 1-rep-max estimation, volume/progress charts, timed/distance-based exercises, multi-device sync.