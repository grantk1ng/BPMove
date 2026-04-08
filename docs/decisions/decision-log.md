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
The EventBus's `EventMap` interface enforces correct event payloads at compile time. Services are decoupled — adding a new consumer of `hr:reading` doesn't require modifying `HeartRateService`.

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

**Tradeoff:** The provider abstraction adds complexity. `TrackMetadata.url` is `string | number` — string for Spotify URIs, number for Metro `require()` asset IDs — which leaks the abstraction. Each provider owns its own playback implementation (`playTrack`, `pause`, `resume`, `stop`, `getPosition`), duplicating control logic between LocalTrackProvider (react-native-track-player) and SpotifyTrackProvider (Spotify App Remote). Provider switching is initialization-only — no runtime hot-swap if Spotify drops mid-session.

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
