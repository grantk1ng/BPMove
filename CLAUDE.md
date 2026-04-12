# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

BPMove is a capstone project for Samford University CS program under **Dr. Brian Toone**. It must be demo-ready on a treadmill with a real BLE heart rate monitor and live music playback.

### Tech Stack

- **Framework:** React Native bare CLI (not Expo — BLE requires native modules)
- **Language:** TypeScript, strict mode
- **BLE:** react-native-ble-plx
- **Audio (local):** react-native-track-player
- **Audio (Spotify):** react-native-spotify-remote (auth only) + Spotify Web API (playback control)
- **Navigation:** @react-navigation/native + bottom-tabs + native-stack
- **Environment:** react-native-config (`.env` file, never committed)
- **Persistence:** @react-native-async-storage/async-storage (session history)
- **Background:** react-native-background-actions (keeps BLE + audio alive when backgrounded)
- **Export:** react-native-fs + react-native-share (write CSV/JSON to disk, open share sheet)
- **BPM Data:** SoundNet Track Analysis API via RapidAPI (`GET track-analysis.p.rapidapi.com/pktx/spotify/{spotifyTrackId}`, response field `tempo`)
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

> **Decision log:** [`docs/decisions/decision-log.md`](docs/decisions/decision-log.md) — read before proposing architectural changes.

BPMove is a React Native app that reads heart rate from a Bluetooth monitor and adaptively selects music BPM to keep the user in a target HR zone.

### Service Layer

All services are singleton instances registered in `src/core/ServiceRegistry.ts` and initialized in `src/app/App.tsx`. Initialization order matters — `AdaptiveBPMEngine` must be registered before `SessionLogger` so that algorithm state is cached before the logger's `hr:reading` handler runs. Note: `AdaptiveBPMEngine` and `SessionLogger` are started on user action in `SessionHomeScreen.tsx` or `DebugScreen.tsx`, not at app startup. `initializeServices()` is guarded against double-invocation (React strict mode) via `ServiceRegistry.has()` check. `TrackProviderManager.initialize()` has its own `initialized` flag to prevent duplicate provider loading. The `useEffect` in `App.tsx` uses a `cancelled` flag so stale async completions from strict-mode remounts are ignored.

| Key | Service | Purpose |
|-----|---------|---------|
| `heartrate` | `HeartRateService` | BLE scanning, connection, HR parsing |
| `algorithm` | `AdaptiveBPMEngine` | HR → BPM target state machine |
| `musicLibrary` | `MusicLibraryManager` | Track catalog and BPM index |
| `music` | `MusicPlayerService` | Playback control — delegates to active TrackProvider |
| `trackProvider` | `TrackProviderManager` | Provider selection, fallback, track loading |
| `logging` | `SessionLogger` | Event recording; delegates derived metrics to `SessionMetricsComputer` |

`SessionMetricsComputer` (`src/modules/logging/SessionMetricsComputer.ts`) is instantiated by `SessionLogger.start()` at session start — not registered in ServiceRegistry. It computes live derived time-series values (target reason/urgency, time-since-last-mode/music-change, cumulative zone adherence %) and post-session aggregates (mode switch count, track selection accuracy with raw BPM deltas, HR response times after RAISE/LOWER transitions).

**Standalone modules** (not in ServiceRegistry — called directly from UI):
- `SessionStore` (`src/modules/logging/SessionStore.ts`) — AsyncStorage wrapper for saving/loading past sessions. Stores a summary index + full session data keyed by session ID. Caps at 50 sessions with auto-eviction.
- `BackgroundSessionService` (`src/modules/background/BackgroundSessionService.ts`) — Wraps `react-native-background-actions` to keep BLE + audio alive when app is backgrounded. Started/stopped alongside sessions. Updates Android notification with HR + track info.
- `UserPreferences` (`src/modules/preferences/UserPreferences.ts`) — AsyncStorage wrapper for user settings (age, graph toggle, paired device, selected playlist, onboarding complete, custom zones). All keys prefixed `bpmove:`. Hook: `usePreferences()`.

### Design Tokens

All visual constants live in `src/theme/` — `colors.ts`, `typography.ts`, `spacing.ts`, `radii.ts`, exported via barrel `index.ts`. Screens and components import `{colors, typography, spacing, radii} from '../theme'` instead of inline values. Mode colors: raising=#F97316 (orange), maintain=#86B39B (sage green), lowering=#60A5FA (blue).

### Safe Area

All screens with `headerShown: false` wrap content in `SafeAreaView` from `react-native-safe-area-context` with `edges={['top', 'bottom']}` to respect Dynamic Island, notch, and home indicator across all iPhone models. `SafeAreaProvider` wraps the app in `App.tsx`.

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

The engine runs a state machine with three modes (`MAINTAIN` / `RAISE` / `LOWER`) and applies hysteresis (dwell time + return threshold) to prevent thrashing. Zone presets (Zone 2/3/4) are defined in `src/modules/algorithm/presets.ts`. `calculateZonesFromAge(age)` computes personalized zones using `maxHR = 220 - age` at 60–70%, 70–80%, 80–90% thresholds.

### Hooks

React components consume services through custom hooks in each module:
- `useHeartRate()` — connection state + live HR reading
- `useHRHistory()` — rolling buffer of past readings (for graphs)
- `usePlayback()` — current track + playback state
- `useSessionLog()` — log entries for the event log UI
- `usePreferences()` — user settings (age, graph toggle, paired device, playlist)

Hooks subscribe to the EventBus directly; they do not call services.

### Navigation & Screens

Root navigation uses a conditional stack: first launch shows `OnboardingNavigator` (3-step flow), subsequent launches show `MainTabs`. Onboarding completion is persisted via `UserPreferences.isOnboardingComplete()`. Configured in `src/navigation/AppNavigator.tsx`.

**Onboarding** (first launch only, `src/navigation/OnboardingNavigator.tsx`):

| Step | Screen | Purpose |
|------|--------|---------|
| 1 | `WelcomeScreen` | App intro, "Get Started" |
| 2 | `AgeInputScreen` | Age input for zone calculation, COPPA gate (13+), skip option |
| 3 | `BLEPairingScreen` | User-initiated BLE scan, device pairing, skip option |

**Main tabs** (`@react-navigation/bottom-tabs`):

| Tab | Screen | Purpose |
|-----|--------|---------|
| Session | `SessionHomeScreen` | Zone cards, start session, connection warnings |
| Session | `ActiveSessionScreen` | Mode bar, HR, zone bar, album art now playing, stats, stop |
| Session | `DebugScreen` | Full developer console (accessible from Settings) |
| History | `HistoryScreen` | Past sessions list with metrics, export (CSV/JSON), delete |
| Settings | `SettingsScreen` | HR zones, Spotify, BLE pairing, graph toggle, about, dev |

`ActiveSessionScreen` disables swipe-back gesture to prevent accidental exits during workouts.

### Track Provider System

Source-agnostic track loading and playback via `TrackProvider` interface (`src/modules/music/providers/types.ts`). Providers own both track loading AND playback — MusicPlayerService delegates to the active provider.

- **TrackProvider interface** — contract: `isAvailable()`, `loadTracks()`, `playTrack()`, `pause()`, `resume()`, `stop()`, `getPosition()`, `destroy()`. All fallible methods return `Result<T>` (`{ok: true, data} | {ok: false, error}`).
- **LocalTrackProvider** (`src/modules/music/providers/LocalTrackProvider.ts`) — wraps react-native-track-player. Serves 14 bundled MP3s (123–174 BPM) from `assets/tracks/` via Metro `require()`. Always available. Priority 10.
- **SpotifyTrackProvider** (`src/modules/music/providers/spotify/SpotifyTrackProvider.ts`) — authenticates via `react-native-spotify-remote` (auth only), fetches user's Saved Tracks (up to 20) from Spotify Web API, looks up BPM via SoundNet/RapidAPI (`SoundNetClient.ts`), controls playback via Spotify Web API (`SpotifyWebPlayback.ts`). Priority 0 (tried first, local is fallback). Pre-caches all BPM data at `loadTracks()` — no network calls mid-run. Requires `SPOTIFY_CLIENT_ID` and `RAPIDAPI_KEY` in `.env`. Filters tracks to 100–200 BPM range.
- **SpotifyWebPlayback** (`src/modules/music/providers/spotify/SpotifyWebPlayback.ts`) — HTTP client wrapping Spotify Web API playback endpoints (`/v1/me/player/*`). Handles device discovery, play, pause, resume, and playback state polling. Replaces the broken Spotify App Remote SDK for all playback control.
- **SoundNetClient** (`src/modules/music/providers/spotify/SoundNetClient.ts`) — BPM lookup via RapidAPI's SoundNet Track Analysis API. Uses Spotify track ID endpoint (`/pktx/spotify/{id}`). Rate-limited: `BATCH_SIZE=1`, `BATCH_DELAY_MS=1500`. Includes 5s timeout per request, 429 retry with 3s backoff. Results cached via `BPMCache`.
- **BPMCache** (`src/modules/music/providers/spotify/BPMCache.ts`) — AsyncStorage wrapper for BPM data, keyed by `bpmove:bpm:{trackId}`. Cache-first flow avoids repeated API calls across sessions.
- **TrackProviderManager** (`src/modules/music/providers/TrackProviderManager.ts`) — tries providers in priority order, first success becomes active. Calls `libraryManager.loadTracks()` and `musicService.setActiveProvider()`. Registered as `'trackProvider'` in ServiceRegistry. Falls back to local if Spotify auth fails or keys aren't configured. Guarded against double-initialization (React strict mode).

Provider events in EventBus: `provider:loading`, `provider:ready`, `provider:error`, `provider:fallback`.

**Track selection:** `TrackSelector.selectTrack()` is a pure function that picks tracks within a 5 BPM tolerance window (`BPM_TOLERANCE`), avoiding recently played tracks (passed as `recentTrackIds`). Falls back to recent tracks only if no fresh candidates exist. Both `skip()` and the algorithm's `selectAndPlay()` share the same recent history (`RECENT_TRACK_HISTORY_SIZE = 5`), preventing the algorithm from overriding user skips.

**Track switch debounce:** MusicPlayerService enforces 12-second minimum between algorithm-driven track switches (`MIN_TRACK_SWITCH_INTERVAL_MS`). User-initiated `skip()` bypasses this cooldown but resets the timer. Emits `music:trackSwitchBlocked` when the algorithm is throttled.

**Track-ended detection:** `SpotifyTrackProvider` polls `getPlaybackState` every 2s. When `progressMs >= durationMs - 1000` and `!isPlaying`, it emits `music:trackEnded`. `MusicPlayerService` listens and auto-advances to the next track, bypassing cooldown.

**TrackMetadata.url** is `string | number` — string for remote URIs (Spotify), number for Metro `require()` asset IDs (local).

### Session Persistence & Export

- **Auto-save:** Sessions are automatically saved to AsyncStorage when stopped (from `DebugScreen`, `ActiveSessionScreen`).
- **History UI:** `HistoryScreen` lists past sessions with basic metrics (avg/max HR, tracks played, time in zone). `SessionMetricsComputer` computes advanced post-session metrics (mode switches, track selection accuracy, HR response times) stored in `SessionLog.metadata`.
- **Export formats:** CSV time-series (includes 5 derived metric columns), CSV events (includes per-selection accuracy on `music_change` entries), JSON — all via `LogExporter.ts`. Files are written to disk with `react-native-fs` and shared via native share sheet (`react-native-share`).
- **Capacity:** 50 sessions max, oldest auto-evicted. Full session data (entries + time-series) stored per session.

### Environment Configuration

Environment variables are managed via `react-native-config` reading from a `.env` file in the project root (never committed — `.gitignore` includes `.env`).

| Variable | Purpose |
|----------|---------|
| `SPOTIFY_CLIENT_ID` | Spotify app client ID from developer dashboard |
| `SPOTIFY_REDIRECT_URL` | OAuth callback URL (default: `bpmove://spotify-callback`) |
| `RAPIDAPI_KEY` | API key for SoundNet Track Analysis on RapidAPI |

Config accessed via `src/config/env.ts`. See `.env.example` for the template.

**URL scheme `bpmove://`** is registered in both iOS (`Info.plist` → `CFBundleURLTypes`) and Android (`AndroidManifest.xml` → intent-filter) for the Spotify OAuth callback. iOS requires `LSApplicationQueriesSchemes` with `"spotify"` in `Info.plist` for the auth SDK to detect the Spotify app. `AppDelegate.swift` forwards incoming URLs to `RNSpotifyRemoteAuth` via a Swift-ObjC bridging header (`BPMove-Bridging-Header.h`).

## Code Style

- **Functional React components only.** No class components in UI code. Services are TypeScript classes — that's intentional.
- **Minimal comments.** Self-documenting names. Only comment *why*, never *what*.
- **No `any`.** Use `unknown` + type guards if the type is genuinely unknown.
- **Named exports** over default exports. Exception: `App.tsx` uses default export as required by React Native.
- **Barrel files** (`index.ts`) already exist per module directory. Maintain them when adding new exports.
- **Colocate tests.** `__tests__/` directory next to the code it tests.
- **Error handling:** Use typed Result patterns (`{ ok: true, data } | { ok: false, error }`) for operations that can fail (BLE connection, API calls, Spotify auth). `Result<T>` is defined in `src/contracts/results.ts`. React Error Boundaries for UI-level crashes.
- **Shared types:** `src/contracts/index.ts` re-exports all cross-module types. Prefer importing from `../contracts` when a type crosses module boundaries.
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
- **No error boundaries** — React Error Boundaries not yet added around screen components.
- **Eager Spotify initialization** — App currently runs Spotify auth + SoundNet BPM lookup at startup in `App.tsx`. Should be deferred to Settings (connect Spotify) with a loading screen. Planned follow-up.

## What NOT to Do

- Don't use Expo. BLE requires bare CLI.
- Don't use Spotify's Audio Features/Audio Analysis API. Deprecated for new apps.
- Don't use the Spotify App Remote SDK for playback control. The bundled iOS SDK (v1.2.1) is incompatible with the current Spotify app — `SpotifyRemote.connect()` disconnects with "End of stream." Use Spotify Web API via `SpotifyWebPlayback.ts` instead. Auth via `SpotifyAuth` still works.
- Don't read the `.env` file or display its contents. API keys must never appear in conversation transcripts.
- Don't make network calls during an active run. Cache everything pre-run.
- Don't use class components.
- Don't use `any`.
- Don't put domain logic in React components or hooks. It belongs in services.
- Don't bypass the EventBus for inter-service communication. Everything goes through it.
- Don't introduce Zustand, Redux, or Context for state. Use the existing ServiceRegistry + EventBus pattern.
