# Architecture Decision Log

Deliberate architectural choices in BPMove, documented so future sessions understand _why_ the system is built this way before proposing changes.

Format: **Before** → **Problem** → **After** → **Why** → **Tradeoff**

---

## ADR-001: No Redux/Zustand — Services Own State, EventBus for Communication

**Before:** Default React Native state management — Redux, Zustand, or React Context to hold app-wide state and share it across components.

**Problem:** BPMove's core state lives in services that manage complex async lifecycles: BLE connections (`HeartRateService`), a three-mode state machine (`AdaptiveBPMEngine`), audio playback across two providers (`MusicPlayerService`), and session recording (`SessionLogger`). Adding a Redux store creates dual state ownership — the store and the service both claim to be the source of truth. They inevitably diverge, especially under rapid async events like HR readings arriving every second.

**After:** Services are singleton TypeScript classes registered in `ServiceRegistry`. Each service owns its own state internally. Cross-service communication goes through a typed `EventBus` — services emit events, other services and React hooks subscribe. No global store exists.

**Why:** Services _are_ the source of truth. HeartRateService knows the BLE connection state. AdaptiveBPMEngine knows the current mode and target BPM. Wrapping this in Redux would add a synchronization layer with no consumer — React hooks already subscribe to EventBus events directly. The EventBus provides compile-time type safety via `EventMap` without the boilerplate of actions, reducers, and selectors.

**Tradeoff:** No Redux DevTools. No time-travel debugging. No single state snapshot for crash reporting. Debugging requires reading EventBus event logs (the `SessionLogger` captures these, but only during active sessions). State is distributed across 6 services — understanding the full system state requires querying each one.

---

## ADR-002: Bare React Native CLI over Expo

**Before:** Expo managed workflow — the default starting point for new React Native projects. Provides OTA updates, Expo Go for fast iteration, and managed native configuration.

**Problem:** `react-native-ble-plx` requires custom native module linking — it accesses CoreBluetooth (iOS) and android.bluetooth (Android) directly. Expo's managed workflow cannot handle custom native code. Expo's "prebuild" or "eject" options exist but defeat the purpose of managed workflow, and Expo's own BLE library (`expo-bluetooth`) was experimental and incomplete as of project start.

**After:** React Native bare CLI (`@react-native-community/cli`). Manual Xcode and Android Studio configuration. CocoaPods for iOS native deps, Gradle for Android. All native module linking done explicitly.

**Why:** BLE heart rate monitoring is the core requirement — the capstone demo _must_ work on a physical iPhone with a real chest strap on a treadmill. There is no workaround for this in Expo's managed workflow. The same constraint applies to `react-native-track-player` (background audio), `react-native-spotify-remote` (Spotify App Remote), and `react-native-background-actions` (foreground service).

**Tradeoff:** No OTA updates (irrelevant for a capstone demo). No Expo Go — every code change requires a full native build cycle. Manual CocoaPods management (`bundle exec pod install` after native dep changes). Longer initial setup. iOS and Android build configurations must be maintained manually (Info.plist, AndroidManifest.xml, Podfile, build.gradle).

---

## ADR-003: ServiceRegistry + EventBus over Direct Service Imports

**Before:** Services import each other directly — `import { heartRateService } from '../heartrate/HeartRateService'`. Consumers call methods on service instances.

**Problem:** Initialization order matters and creates hidden coupling. Specifically: `AdaptiveBPMEngine` must register its `hr:reading` handler _before_ `SessionLogger` does, because the logger's handler reads cached algorithm state that the engine's handler produces. With direct imports, this ordering is implicit in module evaluation order — a refactor or circular import can silently break it. Direct imports also make it impossible to swap implementations (e.g., mock services for testing).

**After:** All services register as singletons in `ServiceRegistry` (`src/core/ServiceRegistry.ts`) during `initializeServices()` in `App.tsx`. The registration sequence is explicit and visible in one function. Services communicate exclusively through the typed `EventBus` — never by importing each other.

**Why:** The registration order is now a single, readable list in `App.tsx`:
1. `HeartRateService` → 2. `AdaptiveBPMEngine` → 3. `MusicLibraryManager` → 4. `MusicPlayerService` → 5. `TrackProviderManager` → 6. `SessionLogger`.
The EventBus's `EventMap` interface enforces correct event payloads at compile time. Services are decoupled — adding a new consumer of `hr:reading` doesn't require modifying `HeartRateService`. Note: `SessionMetricsComputer` is instantiated at session start time (not app initialization) as a private member of `SessionLogger`, so it is not part of the service registration order.

**Tradeoff:** Indirection. You can't cmd-click from `eventBus.emit('hr:reading', ...)` to its subscribers — you have to grep for `'hr:reading'`. The `ServiceRegistry` uses string keys, so `get<HeartRateService>('heartrate')` loses type safety at the registration boundary (the key-to-type mapping is by convention, not enforced). Slightly more ceremony to add a new service (register in `App.tsx`, add to cleanup).

---

## ADR-004: Hybrid Providers — Local + Spotify Behind TrackProvider Interface

**Before:** A single music source — either play bundled MP3s or integrate with Spotify.

**Problem:** The capstone demo must work reliably on a treadmill. Spotify requires a Premium account, `SPOTIFY_CLIENT_ID` and `RAPIDAPI_KEY` in `.env`, the Spotify app installed on the demo device, and network access for OAuth. Any of these can fail on demo day. But the local track catalog has a BPM gap between 140 and 174 BPM — Zone 4 workouts have limited music selection without Spotify's larger library.

**After:** A `TrackProvider` interface (`src/modules/music/providers/types.ts`) with two implementations:
- `LocalTrackProvider` (priority 10) — 14 bundled MP3s, always available, no network required.
- `SpotifyTrackProvider` (priority 0) — user's Spotify library with BPM lookup via SoundNet API. Pre-caches all BPM data at `loadTracks()` so no network calls happen mid-run.

`TrackProviderManager` tries providers in priority order (Spotify first). First success becomes active. If Spotify fails, local provider takes over automatically.

**Why:** Demo safety. The local provider _guarantees_ music plays regardless of network, accounts, or API keys. Spotify is additive — it provides a larger catalog and fills the 140–174 BPM gap. The `TrackProvider` interface means `MusicPlayerService` doesn't know or care which source is active. Adding a third provider (Apple Music, YouTube Music, local file picker) requires only implementing the interface and adding it to the constructor in `App.tsx`.

**Tradeoff:** The provider abstraction adds complexity. `TrackMetadata.url` is `string | number` — string for Spotify URIs, number for Metro `require()` asset IDs — which leaks the abstraction. Each provider owns its own playback implementation (`playTrack`, `pause`, `resume`, `stop`, `getPosition`), duplicating control logic between LocalTrackProvider (react-native-track-player) and SpotifyTrackProvider (Spotify Web API via `SpotifyWebPlayback.ts`). Provider switching is initialization-only — no runtime hot-swap if Spotify drops mid-session.

---

## ADR-006: Spotify Web API over App Remote SDK for Playback

**Before:** `SpotifyTrackProvider` used both `SpotifyAuth` (OAuth) and `SpotifyRemote` (App Remote SDK) from `react-native-spotify-remote`. Auth handled token acquisition, App Remote handled playback control.

**Problem:** The Spotify iOS SDK v1.2.1 bundled in `react-native-spotify-remote` is incompatible with the current Spotify app. `SpotifyRemote.connect()` immediately disconnects with "End of stream." The library is unmaintained (last updated 2021). Auth works fine — only the App Remote connection is broken.

**After:** Auth stays with `SpotifyAuth.authorize()` from `react-native-spotify-remote`. All playback control moved to `SpotifyWebPlayback.ts` — a thin HTTP client calling Spotify Web API endpoints (`/v1/me/player/*`). Device discovery, play, pause, resume, and playback state are all REST calls using the OAuth access token.

**Why:** The Web API is stable, well-documented, and doesn't depend on a native SDK binary matching the Spotify app version. The access token from `SpotifyAuth.authorize()` works directly with the Web API — no additional auth flow needed. Track-ended detection uses polling (`getPlaybackState` every 2s) checking `progressMs >= durationMs - 1000` and `!isPlaying`.

**Tradeoff:** Web API requires an active Spotify device (phone must have Spotify open). Playback state is polled (2s interval) rather than push-based — track end detection has up to 2s latency. Web API requires Spotify Premium for playback control. The `react-native-spotify-remote` dependency is now only used for its auth module — a lighter auth-only library could replace it, but not worth the churn for a capstone demo.

---

## ADR-007: BPM Cache in AsyncStorage

**Before:** Every app launch fetched BPM data from the SoundNet API for all tracks in the user's Spotify library.

**Problem:** SoundNet's free tier has strict rate limits (429 responses above ~1 req/s). Fetching BPM for 20 tracks at 1.5s intervals takes ~30s. Repeating this on every launch wastes time and API quota.

**After:** `BPMCache.ts` wraps AsyncStorage with keys `bpmove:bpm:{trackId}`. `SoundNetClient.lookupBPMBatch()` checks the cache first and only fetches uncached tracks. New results are written to cache after the batch completes.

**Why:** BPM data for a given Spotify track ID never changes. Cache-first eliminates redundant API calls — subsequent launches skip the 30s lookup entirely for previously seen tracks.

**Tradeoff:** AsyncStorage has no TTL mechanism — cached BPM values persist forever. If SoundNet returns incorrect data, it stays cached until the user clears app data. No cache invalidation strategy exists.

---

## ADR-008: Recent Track History for Skip Variety

**Before:** `TrackSelector.selectTrack()` took a single `currentTrackId` and picked the track with the closest BPM to the target. `MusicPlayerService.skip()` duplicated the selection logic inline. Neither the algorithm nor skip had any memory of recently played tracks.

**Problem:** With a narrow BPM target (e.g., 145 BPM), only 1–2 tracks in the library are closest. The user skips to track B, but 12 seconds later the algorithm fires `selectAndPlay()`, picks track A (the closest match) and snaps playback back. The algorithm and user fight over the same 2 tracks. Skipping feels broken — the app appears to restart the same song.

**After:** `selectTrack()` takes `recentTrackIds: string[]` instead of `currentTrackId`. It uses a 5 BPM tolerance window (`BPM_TOLERANCE = 5`) so nearby tracks are all eligible, and avoids recent tracks (falling back only if no fresh candidates exist). `MusicPlayerService` maintains a shared `recentTrackIds` ring buffer (`RECENT_TRACK_HISTORY_SIZE = 5`) used by both `skip()` and `selectAndPlay()`. `skip()` now delegates to `selectTrack()` instead of duplicating selection logic.

**Why:** The shared history means the algorithm respects the user's skips — it won't snap back to a track the user just rejected. The 5 BPM tolerance widens the candidate pool so there's more variety even when the target BPM is stable. Keeping `selectTrack` as a pure function (history passed in, not stored internally) maintains testability.

**Tradeoff:** The tolerance window means the algorithm may play a track that's up to 5 BPM off the ideal target, slightly reducing BPM precision. The 5-track history is arbitrary — too small and you still alternate, too large and you exhaust candidates in a small library. With 43 Spotify tracks across 100–200 BPM, 5 is a reasonable balance.

---

## ADR-005: Result Pattern over Thrown Exceptions in Service Code

**Before:** Standard JavaScript try/catch with thrown `Error` objects for failure cases.

**Problem:** BLE disconnects, Spotify auth failures, SoundNet API timeouts, and audio player errors are _expected_ at runtime — they happen on every session. Thrown exceptions treat these predictable failures as exceptional, making control flow harder to follow. Callers can forget to catch, and unhandled rejections crash the app. Stack traces for expected failures are noise, not signal.

**After:** All fallible service methods return `Result<T>` — a discriminated union:
```typescript
type Result<T> = {ok: true; data: T} | {ok: false; error: string};
```
Every method on the `TrackProvider` interface returns `Result<T>`. Consumers branch on `.ok` at the call site.

**Why:** BLE and audio operations fail frequently and predictably. The Result pattern makes failure a first-class return value — the type system forces you to handle it. You literally cannot access `.data` without checking `.ok` first (in strict mode). This eliminates the class of bugs where a caller forgets a try/catch and an expected BLE disconnect crashes the session.

**Tradeoff:** More verbose call sites — every Result must be destructured and branched. No stack traces on failure (only a string error message), so unexpected failures are harder to diagnose. Can't use native async/await error propagation — every caller in the chain must explicitly handle and forward the Result. Composing multiple fallible operations requires manual chaining rather than a single try/catch block.
