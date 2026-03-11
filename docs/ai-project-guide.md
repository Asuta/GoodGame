# AI Project Guide

This document is a fast orientation guide for an AI agent joining this repo.

It complements `README.md`: the README explains how to run the app, while this file explains how the project is wired together today and where feature work usually lands.

## What This App Is

- A single React + TypeScript + Vite frontend app.
- `/` is the play surface for a raising / narrative prototype.
- `/editor` is an in-browser content editor for the same game config.
- There is no backend. Config is stored in browser `localStorage`.
- The app is intentionally config-driven: most game content is data in `GameConfig`, not hardcoded JSX.

## Current High-Level Features

- Prologue flow, then repeating day/time-slot gameplay.
- Stat-driven daily actions and conditional events.
- AI-assisted scene continuation and AI evaluation of interactions.
- AI usage visibility on the Home page, including cached token ratio.
- Private daily diary generation stored in runtime state.
- A local test panel on the Home page for manually adjusting current stats.
- Editor tabs for base config, AI config, scenes/media, stats, actions, events, and raw JSON import/export.

## Core Mental Model

The app has two major layers:

1. `GameConfig`: authored content and tunable rules.
2. `GameState`: the live playthrough state for the current browser session.

In practice:

- The editor modifies `GameConfig`.
- The runtime hook consumes `GameConfig` and evolves `GameState`.
- Core rule helpers in `src/lib/gameCore/engine.ts` apply stat changes, evaluate conditions, and trigger events.

## Main Entry Points

- `src/app/App.tsx`: route table; only `Home` and `Editor` matter for product logic.
- `src/pages/Home.tsx`: player-facing screen, modals/panels, action buttons, AI log, test stat panel, private diary view.
- `src/pages/Editor.tsx`: editor shell and tab switching.

## Files That Matter Most

### Runtime and config

- `src/hooks/useGameRuntime.ts`
  - Main gameplay state machine.
  - Handles prologue advance, action execution, dialogue flow, AI requests, AI evaluation, event resolution, restart, and test-stat injection.
  - If a gameplay bug is reported, start here first.

- `src/hooks/useGameConfig.ts`
  - Loads and saves config.
  - Normalizes writes through `normalizeGameConfig()`.
  - Syncs config changes across tabs/windows via the browser `storage` event.

### Core rule/data modules

- `src/lib/gameCore/types.ts`
  - Canonical shape of `GameConfig`, `GameState`, AI config, actions, events, narrative choices, diary entries.
  - Change this first when adding new persisted fields.

- `src/lib/gameCore/defaultConfig.ts`
  - Default sample game content and default AI config.
  - Good place to inspect the expected data shape quickly.

- `src/lib/gameCore/engine.ts`
  - Pure-ish helpers for stat clamping, initial state, effect application, condition checks, event triggering, and state reconciliation after config changes.

- `src/lib/gameCore/storage.ts`
  - `localStorage` key, config cloning/normalization, saved-config migration behavior.
  - Important if a new field must survive reloads or old saves need migration.

### AI integration

- `src/lib/aiStory.ts`
  - Builds prompts and payload previews.
  - Sends Requests/Responses or Chat Completions requests.
  - Parses streaming text, usage metrics, evaluation payloads, and diary payloads.
  - If AI output parsing breaks, this is the primary file.

### Editor UI

- `src/components/editor/BaseTab.tsx`
- `src/components/editor/AiTab.tsx`
- `src/components/editor/MediaTab.tsx`
- `src/components/editor/StatsTab.tsx`
- `src/components/editor/ActionsTab.tsx`
- `src/components/editor/EventsTab.tsx`
- `src/components/editor/DataTab.tsx`

These tabs edit slices of `GameConfig` directly through `setConfig()`.

## Runtime Flow

The current gameplay loop is roughly:

1. Load config from `localStorage`, falling back to `DEFAULT_CONFIG`.
2. Build a fresh `GameState` from the current config.
3. Advance through prologue lines.
4. Enter the daily loop where a time slot determines which actions are available.
5. Player chooses a daily action or idle action.
6. Runtime applies scripted effects immediately.
7. If AI mode is enabled and usable, AI may continue the scene and later evaluate the interaction.
8. Runtime resolves triggered events after effects settle.
9. At day end, the app may generate a private diary entry and then rolls into the next day.

Important detail: config is persistent across reloads, but runtime play state is in React state, not durable storage.

## AI Flow

AI support is optional and controlled by `config.ai.enabled` plus presence of endpoint/key/model.

There are several distinct AI request types in `src/lib/aiStory.ts`:

- Story turn generation after an action.
- Interaction evaluation after the player manually ends an AI exchange.
- Free-time narration for the idle action.
- Private diary generation at day end.

Useful implementation notes:

- Responses mode is the preferred/latest path.
- The runtime records request previews and the last usage summary so the Home page can inspect them.
- Cached token usage is surfaced on the Home page as both raw cached tokens and a percentage of input tokens.
- The old AI turn limit still exists in config/UI for compatibility, but the current flow is manual-end driven.

## Data Ownership

Use this rule of thumb before editing:

- Add or change content schema -> `src/lib/gameCore/types.ts`, `src/lib/gameCore/defaultConfig.ts`, `src/lib/gameCore/storage.ts`
- Change pure gameplay rules -> `src/lib/gameCore/engine.ts`
- Change runtime sequencing / side effects -> `src/hooks/useGameRuntime.ts`
- Change AI prompts, parsing, or usage reporting -> `src/lib/aiStory.ts`
- Change screen-level UI -> `src/pages/Home.tsx` or `src/pages/Editor.tsx`
- Change editor fields -> `src/components/editor/*`

## Editor vs Runtime Boundaries

Keep these boundaries in mind:

- The editor changes config definitions such as stat ranges, action effects, event conditions, scene assets, and AI settings.
- The Home page changes live runtime state such as current day, dialogue progression, current stats, logs, and diary entries.
- `reconcileGameState()` exists to keep runtime state valid if config changes underneath an active session.

Example: if stat min/max values change in the editor while the game is open, runtime stats are re-clamped rather than discarded.

## Current Special Features Worth Knowing

- Time-slot system: actions can be limited to specific slots through `availableTimeSlotIds`.
- Test stat panel on Home: not a hidden dev flag, but an explicit panel that lets the user overwrite current stat values.
- AI log panel on Home: shows the next request preview and the most recent sent request, plus token usage.
- Private diary: each finished day can append a diary entry to `game.diaryEntries`; the Home settings panel can display these entries.
- Cross-window config sync: editing in `/editor` can update another open play window because config changes use the `storage` event.

## Storage and Persistence

- Config storage key: `daily-raising-editor-config-v2`
- Stored in browser `localStorage`
- Runtime state is not persisted in `localStorage`
- Some migration logic already exists in `src/lib/gameCore/storage.ts` for retired AI endpoint defaults

If you add persistent config fields, make sure they survive:

- `DEFAULT_CONFIG`
- `normalizeGameConfig()`
- editor UI, if user-editable

## Safe Ways to Extend the App

When adding a new gameplay field or feature, the usual checklist is:

1. Add types in `src/lib/gameCore/types.ts`.
2. Add defaults in `src/lib/gameCore/defaultConfig.ts`.
3. Update normalization/migration in `src/lib/gameCore/storage.ts`.
4. Update rule handling in `src/lib/gameCore/engine.ts` or `src/hooks/useGameRuntime.ts`.
5. Expose editor controls in the relevant `src/components/editor/*` tab.
6. Surface the result in `src/pages/Home.tsx` if players need to see or control it.

## Known Constraints

- No backend, auth, cloud save, or multi-user workflow.
- Runtime state is ephemeral per tab refresh.
- Some pages are feature-rich and still fairly dense, especially `src/pages/Home.tsx` and `src/hooks/useGameRuntime.ts`.
- AI compatibility depends on the target gateway behaving like the expected OpenAI-style API mode.

## Recommended Starting Points For Common Tasks

- "Gameplay effect is wrong" -> `src/hooks/useGameRuntime.ts`, then `src/lib/gameCore/engine.ts`
- "Editor field does not save" -> `src/components/editor/*`, `src/hooks/useGameConfig.ts`, `src/lib/gameCore/storage.ts`
- "AI request shape is wrong" -> `src/lib/aiStory.ts`
- "A new config field should exist everywhere" -> `src/lib/gameCore/types.ts` first
- "The play UI should show more state" -> `src/pages/Home.tsx`

## Existing Docs

There is already a basic overview in `README.md`, plus planning notes in `docs/gameplay-plan.md`, `docs/gameplay-priority.md`, and a running changelog in `progress.md`.

Those files are useful, but they are not a compact "drop an AI into the repo and get oriented fast" guide. This file is meant to fill that gap.
