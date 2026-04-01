# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

BPMove is a capstone project for Samford University CS program under **Dr. Brian Toone**. It must be demo-ready on a treadmill with a real BLE heart rate monitor and live music playback.

### Tech Stack

- **Framework:** React Native bare CLI (not Expo — BLE requires native modules)
- **Language:** TypeScript, strict mode
- **BLE:** react-native-ble-plx
- **Audio (local):** react-native-track-player
- **Audio (Spotify):** react-native-spotify-remote
- **Navigation:** @react-navigation/native + bottom-tabs + native-stack
- **Environment:** react-native-config (`.env` file, never committed)
- **Persistence:** @react-native-async-storage/async-storage (session history)
- **Background:** react-native-background-actions (keeps BLE + audio alive when backgrounded)
- **Export:** react-native-fs + react-native-share (write CSV/JSON to disk, open share sheet)
- **BPM Data:** SoundNet Track Analysis API via RapidAPI (`GET track-analysis.p.rapidapi.com/pktx/rapid?song=TITLE&artist=ARTIST`, response field `tempo`)
- **Testing:** Jest + React Native Testing Library
- **State:** ServiceRegistry + typed EventBus (no Redux, no Zustand, no Context)

## Commands

```bash
# Start Metro bundler
npm start

# Run on device/simulator
npm run ios       # requires: bundle install && bundle exec pod install (first time or after native dep changes)
npm run android

# Tests
npm test                                          # all tests
npm test -- --testPathPattern=EventBus            # single test file by name

# Lint
npm run lint
```

### Jest Mocks

All native module mocks live in `__mocks__/`:

| Mock file | What it stubs |
|-----------|---------------|
| `react-native-track-player.ts` | Audio playback |
| `react-native-ble-plx.ts` | BLE scanning/connection |
| `react-native-fs.ts` | File system read/write |
| `react-native-share.ts` | Native share sheet |
| `react-native-background-actions.ts` | Background task service |
| `react-native-spotify-remote.ts` | Spotify auth + remote control |
| `react-native-config.ts` | Environment variables |
| `react-native-screens.ts` | Navigation screen primitives |
| `@react-native-async-storage/async-storage.ts` | Async key-value storage |
| `@react-navigation/native.tsx` | NavigationContainer + hooks |
| `@react-navigation/bottom-tabs.tsx` | Tab navigator |
| `@react-navigation/native-stack.tsx` | Stack navigator |
| `audioFileMock.ts` | MP3/audio file imports |

## Architecture

BPMove is a React Native app that reads heart rate from a Bluetooth monitor and adaptively selects music BPM to keep the user in a target HR zone.

### Service Layer

All services are singleton instances registered in `src/core/ServiceRegistry.ts` and initialized in `src/app/App.tsx`. Initialization order matters — `AdaptiveBPMEngine` must be registered before `SessionLogger` so that algorithm state is cached before the logger's `hr:reading` handler runs. Note: `AdaptiveBPMEngine` and `SessionLogger` are started on user action in `SessionHomeScreen.tsx` or `DebugScreen.tsx`, not at app startup.

| Key | Service | Purpose |
|-----|---------|---------|
| `heartrate` | `HeartRateService` | BLE scanning, connection, HR parsing |
| `algorithm` | `AdaptiveBPMEngine` | HR → BPM target state machine |
| `musicLibrary` | `MusicLibraryManager` | Track catalog and BPM index |
| `music` | `MusicPlayerService` | Playback via `react-native-track-player` |
| `trackProvider` | `TrackProviderManager` | Provider selection, fallback, track loading |
| `logging` | `SessionLogger` | Event recording and metrics |

**Standalone modules** (not in ServiceRegistry — called directly from UI):
- `SessionStore` (`src/modules/logging/SessionStore.ts`) — AsyncStorage wrapper for saving/loading past sessions. Stores a summary index + full session data keyed by session ID. Caps at 50 sessions with auto-eviction.
- `BackgroundSessionService` (`src/modules/background/BackgroundSessionService.ts`) — Wraps `react-native-background-actions` to keep BLE + audio alive when app is backgrounded. Started/stopped alongside sessions. Updates Android notification with HR + track info.

All services implement `destroy()` for cleanup. `App.tsx` calls `destroy()` on every registered service in its `useEffect` cleanup.

### Event Bus

All inter-module communication goes through a single typed event bus (`src/core/EventBus.ts`). The complete event schema lives in `src/core/EventBus.types.ts` — every event emitted or subscribed to in the system is defined there. Services subscribe in their `start()` methods and must unsubscribe in `destroy()`.

Key event flow:
```
HeartRateService  →  hr:reading
                         ↓
AdaptiveBPMEngine  →  algo:target, algo:stateChanged, algo:modeChanged
                         ↓
MusicPlayerService  →  music:changed, music:playbackStateChanged
```

### Algorithm

`AdaptiveBPMEngine` delegates all computation to a `strategy` object implementing `AlgorithmStrategy`. Currently only `LinearStrategy` exists (`src/modules/algorithm/strategies/LinearStrategy.ts`). The strategy pattern is fully wired — adding a new strategy requires implementing `AlgorithmStrategy` and registering it in `src/modules/algorithm/strategies/index.ts`.

The engine runs a state machine with three modes (`MAINTAIN` / `RAISE` / `LOWER`) and applies hysteresis (dwell time + return threshold) to prevent thrashing. Zone presets (Zone 2/3/4) are defined in `src/modules/algorithm/presets.ts`.

### Hooks

React components consume services through custom hooks in each module:
- `useHeartRate()` — connection state + live HR reading
- `useHRHistory()` — rolling buffer of past readings (for graphs)
- `usePlayback()` — current track + playback state
- `useSessionLog()` — log entries for the event log UI

Hooks subscribe to the EventBus directly; they do not call services.

### Navigation & Screens

Tab-based navigation via `@react-navigation/bottom-tabs` + `@react-navigation/native-stack`. Configured in `src/navigation/AppNavigator.tsx`.

| Tab | Screen | Purpose |
|-----|--------|---------|
| Session | `SessionHomeScreen` | BLE connect, zone select, start session |
| Session | `ActiveSessionScreen` | Live HR, graph, now playing, stop session |
| Session | `DebugScreen` | Full developer console (accessible from Settings) |
| History | `HistoryScreen` | Past sessions list with metrics, export (CSV/JSON), delete |
| Settings | `SettingsScreen` | Provider status, Spotify config, debug access |

`ActiveSessionScreen` disables swipe-back gesture to prevent accidental exits during workouts.

### Track Provider System

Source-agnostic track loading and playback via `TrackProvider` interface (`src/modules/music/providers/types.ts`). Providers own both track loading AND playback — MusicPlayerService delegates to the active provider.

- **TrackProvider interface** — contract: `isAvailable()`, `loadTracks()`, `playTrack()`, `pause()`, `resume()`, `stop()`, `getPosition()`, `destroy()`. All fallible methods return `Result<T>` (`{ok: true, data} | {ok: false, error}`).
- **LocalTrackProvider** (`src/modules/music/providers/LocalTrackProvider.ts`) — wraps react-native-track-player. Serves 14 bundled MP3s (123–174 BPM) from `assets/tracks/` via Metro `require()`. Always available. Priority 10.
- **SpotifyTrackProvider** (`src/modules/music/providers/spotify/SpotifyTrackProvider.ts`) — authenticates via `react-native-spotify-remote`, fetches user's Saved Tracks from Spotify Web API, looks up BPM via SoundNet/RapidAPI (`SoundNetClient.ts`), controls playback via Spotify App Remote. Priority 0 (tried first, local is fallback). Pre-caches all BPM data at `loadTracks()` — no network calls mid-run. Requires `SPOTIFY_CLIENT_ID` and `RAPIDAPI_KEY` in `.env`.
- **TrackProviderManager** (`src/modules/music/providers/TrackProviderManager.ts`) — tries providers in priority order, first success becomes active. Calls `libraryManager.loadTracks()` and `musicService.setActiveProvider()`. Registered as `'trackProvider'` in ServiceRegistry. Falls back to local if Spotify auth fails or keys aren't configured.

Provider events in EventBus: `provider:loading`, `provider:ready`, `provider:error`, `provider:fallback`.

**Track switch debounce:** MusicPlayerService enforces 12-second minimum between track switches (`MIN_TRACK_SWITCH_INTERVAL_MS`), separate from the algorithm's 5-second cooldown. Emits `music:trackSwitchBlocked` when blocked.

**TrackMetadata.url** is `string | number` — string for remote URIs (Spotify), number for Metro `require()` asset IDs (local).

### Session Persistence & Export

- **Auto-save:** Sessions are automatically saved to AsyncStorage when stopped (from `DebugScreen`, `ActiveSessionScreen`).
- **History UI:** `HistoryScreen` lists past sessions with metrics (avg HR, max HR, tracks played, % time in zone). Tap a session to export or delete.
- **Export formats:** CSV time-series, CSV events, JSON — all via `LogExporter.ts`. Files are written to disk with `react-native-fs` and shared via native share sheet (`react-native-share`).
- **Capacity:** 50 sessions max, oldest auto-evicted. Full session data (entries + time-series) stored per session.

### Environment Configuration

Environment variables are managed via `react-native-config` reading from a `.env` file in the project root (never committed — `.gitignore` includes `.env`).

| Variable | Purpose |
|----------|---------|
| `SPOTIFY_CLIENT_ID` | Spotify app client ID from developer dashboard |
| `SPOTIFY_REDIRECT_URL` | OAuth callback URL (default: `bpmove://spotify-callback`) |
| `RAPIDAPI_KEY` | API key for SoundNet Track Analysis on RapidAPI |

Config accessed via `src/config/env.ts`. See `.env.example` for the template.

**URL scheme `bpmove://`** is registered in both iOS (`Info.plist` → `CFBundleURLTypes`) and Android (`AndroidManifest.xml` → intent-filter) for the Spotify OAuth callback.

## Code Style

- **Functional React components only.** No class components in UI code. Services are TypeScript classes — that's intentional.
- **Minimal comments.** Self-documenting names. Only comment *why*, never *what*.
- **No `any`.** Use `unknown` + type guards if the type is genuinely unknown.
- **Named exports** over default exports. Exception: `App.tsx` uses default export as required by React Native.
- **Barrel files** (`index.ts`) already exist per module directory. Maintain them when adding new exports.
- **Colocate tests.** `__tests__/` directory next to the code it tests.
- **Error handling:** Use typed Result patterns (`{ ok: true, data } | { ok: false, error }`) for operations that can fail (BLE connection, API calls, Spotify auth). React Error Boundaries for UI-level crashes.
- **No magic numbers.** All thresholds, zone boundaries, and BPM ranges go in constants.
- **Domain logic stays in services.** React components and hooks never contain business logic. Hooks read from the EventBus; components render what hooks give them.

## Naming Conventions

- **Files:** PascalCase for services, classes, and components (`TrackProvider.ts`, `HeartRateService.ts`). camelCase for hooks and utilities (`usePlayback.ts`, `heartRateParser.ts`).
- **Component files:** PascalCase (`HeartRateDisplay.tsx`)
- **Types/Interfaces:** PascalCase, no `I` prefix (`TrackProvider`, not `ITrackProvider`)
- **Constants:** SCREAMING_SNAKE_CASE (`MAX_BPM`, `HR_ZONE_BOUNDARIES`)
- **Test files:** `*.test.ts` / `*.test.tsx`

## Git Conventions

- **Conventional commits:** `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- **Branch naming:** `feat/track-loading`, `fix/ble-disconnect-handling`
- **Small, atomic commits** over large dumps.

## Testing Priorities

1. **Algorithm logic** (HR zone calculation, BPM matching, zone transitions) — pure functions, test exhaustively
2. **TrackProvider implementations** — mock API responses, test cache behavior
3. **EventBus integration** — verify correct events fire in correct order
4. **Screen components** — test user-facing behavior, not implementation details

## Key Constraints

- Must work on a physical iPhone with a real BLE HR monitor on a treadmill
- Spotify Premium required for Spotify provider (acceptable for capstone demo)
- SoundNet API requires a RapidAPI key — store in environment config, never commit
- Pre-cache all BPM data at session start to eliminate mid-run latency

## Known Gaps

- **BPM coverage gap** — Local catalog has no tracks between 140 and 174 BPM. Zone 4 workouts will have limited music selection. Spotify provider fills this gap when configured.
- **Background playback untested on device** — `react-native-background-actions` is wired, iOS `UIBackgroundModes` has `audio` + `bluetooth-central`, Android manifest has foreground service permissions. Needs physical device verification.
- **Spotify untested on device** — `SpotifyTrackProvider` is implemented but requires `.env` with real keys, plus Spotify app installed on device for App Remote.
- **SoundNet API untested with real key** — Endpoint verified against RapidAPI docs. Needs a real RapidAPI key to test end-to-end.
- **No onboarding flow** — App drops straight into Session tab. No first-run setup or tutorial.
- **No error boundaries** — React Error Boundaries not yet added around screen components.

## What NOT to Do

- Don't use Expo. BLE requires bare CLI.
- Don't use Spotify's Audio Features/Audio Analysis API. Deprecated for new apps.
- Don't make network calls during an active run. Cache everything pre-run.
- Don't use class components.
- Don't use `any`.
- Don't put domain logic in React components or hooks. It belongs in services.
- Don't bypass the EventBus for inter-service communication. Everything goes through it.
- Don't introduce Zustand, Redux, or Context for state. Use the existing ServiceRegistry + EventBus pattern.
