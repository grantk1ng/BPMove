# BPMove: Patterns to Adopt from Cooper's Nohmi Repo

> Analysis of Nohmi's Claude/AI configuration, ranked by ROI for BPMove with a May 2026 deadline.

---

## 1. Ranked Patterns to Adopt

### #1 — Architecture Decision Records (ADR Log)
**ROI: Critical — 1 hour to create, saves every future session**

**What Cooper does:** `docs/decisions/decision-log.md` — 8 ADRs with a consistent format: Before → Problem → After → Why → Tradeoff. Every deliberate choice (auth server, content storage, test runner, design system) is documented with the *counterargument* that was considered and rejected.

**Example from Nohmi:**
```
## ADR-003: Content Storage — ProseMirror JSON -> Markdown (CHANGED)
Before: Store everything as ProseMirror JSON.
Problem: PM JSON is 5-10x larger than markdown, schema-dependent...
After: Markdown is the storage format.
Why: Smaller, portable, agent-native, no schema drift.
```

**BPMove adaptation:** Your CLAUDE.md documents *what* the conventions are, but not *why*. Claude keeps re-suggesting Redux, Expo, or direct service imports because it doesn't know your reasoning. Create `docs/decisions/decision-log.md` with ADRs for:
- **No Redux/Zustand** — services own state, EventBus for cross-service communication. Why: avoids dual state ownership, services are the source of truth.
- **Bare CLI over Expo** — BLE requires native modules (`react-native-ble-plx`). Why: Expo's managed workflow can't handle custom native code without ejecting.
- **ServiceRegistry + EventBus over direct imports** — decouples service lifecycle from consumer code. Why: services initialize in a specific order (AdaptiveBPMEngine before SessionLogger), direct imports bypass this.
- **Hybrid providers (LocalTrackProvider + SpotifyTrackProvider)** — abstract music source behind a common interface. Why: demo can work offline with local tracks, Spotify integration is additive.
- **Result pattern over thrown exceptions** — service code returns `Result<T, E>`. Why: BLE and audio operations fail frequently and predictably; exceptions are for the unexpected.

**Reference in CLAUDE.md** so Claude reads it every session.

---

### #2 — A `bpmove-architecture` Skill
**ROI: High — 2-3 hours to create, prevents architectural violations every session**

**What Cooper does:** `.claude/skills/nohmi-design/` — a full skill with `SKILL.md` (philosophy + craft rules + anti-patterns + workflow) and `references/` (tokens, components, platform mapping). The skill is 536 lines across 4 files. It's triggered explicitly with `/nohmi-design`.

**Key structural insight:** Cooper's skill has three layers:
1. **Philosophy** — *why* the system exists (subtract, monochrome-as-canvas, etc.)
2. **Rules** — concrete constraints (max 2 font families, no shadows, etc.)
3. **Anti-patterns** — explicit "never do this" list
4. **References** — detailed specs in separate files

**BPMove adaptation:** Create `.claude/skills/bpmove-architecture/SKILL.md` with:

```
SKILL.md (philosophy + rules + anti-patterns)
references/
  service-registry.md    — registration order, lifecycle, how to add a new service
  event-bus.md           — event contracts, naming conventions, payload schemas
  provider-interface.md  — TrackProvider interface, how to add a new provider
  ble-patterns.md        — connection lifecycle, reconnection, mock device for testing
```

**What goes in SKILL.md:**
- **Philosophy:** Services are autonomous units. Communication is message-based. State is owned, never shared.
- **Rules:** All cross-service calls go through EventBus. Services register in `ServiceRegistry.initialize()` in declared order. Providers implement `TrackProvider` interface. No `any`, no magic numbers, named exports only.
- **Anti-patterns:** No direct service imports between services. No Redux/Zustand. No thrown exceptions in service code. No `require()`.
- **Workflow:** When adding a new service → 1) Define events it emits/consumes → 2) Implement service class → 3) Register in ServiceRegistry → 4) Write EventBus integration test.

Trigger with `/bpmove-architecture` or "BPMove architecture".

---

### #3 — GitHub Actions CI
**ROI: High — 2 hours to set up, catches regressions before demo**

**What Cooper does:** `.github/workflows/ci.yml` — three parallel jobs on every PR and push to main:
1. **Biome lint + format** (`biome ci .`)
2. **TypeScript type check** (`tsc --noEmit`)
3. **Unit tests** (`vitest run`)

Uses `concurrency` to cancel in-progress runs, `--frozen-lockfile` for reproducibility, pinned action versions.

**BPMove adaptation:** Create `.github/workflows/ci.yml` with three parallel jobs:
1. **ESLint** — `npx eslint .` (or upgrade to Biome if you want, but not worth the migration cost at 5 weeks out)
2. **TypeScript** — `npx tsc --noEmit`
3. **Jest unit tests** — `npx jest --ci` (exclude integration tests that need BLE/audio)

Key differences from Cooper's:
- Use `actions/setup-node@v4` instead of Bun
- Add `--ci` flag for Jest (disables watch mode, fails on missing snapshots)
- Skip integration tests in CI (BLE/audio can't run headless)
- Consider adding a **build job** (`npx react-native bundle --platform ios`) — this catches import errors that type checking misses

---

### #4 — Shared Validation as Source of Truth (Zod or TypeScript Interfaces)
**ROI: Medium-High — adapts to your Result pattern**

**What Cooper does:** `packages/shared/` exports Zod schemas that serve as *both* type definitions and runtime validators. Every layer (API, DB, frontend) imports from the same source. `constants.ts` defines rate limits, page sizes, and enums as `as const`.

**BPMove adaptation:** You likely already have TypeScript interfaces for your services. The pattern to adopt is:
- Create a `src/types/` or `src/contracts/` directory with:
  - `events.ts` — all EventBus event types (name + payload schema)
  - `services.ts` — ServiceRegistry interface, service lifecycle types
  - `providers.ts` — TrackProvider interface, track metadata types
  - `results.ts` — Result<T, E> type, common error types
- These become the **single source of truth**. Services import types from here, not from each other.
- Add to CLAUDE.md: "Types in `src/contracts/` are the source of truth. Never redefine types in service files."

---

### #5 — Implementation Plan Documents
**ROI: Medium — useful for remaining features before demo**

**What Cooper does:** `docs/superpowers/plans/` contains task-based implementation plans with checkbox syntax, file structure diagrams, and explicit file-level instructions (NEW/MODIFY annotations). Plans reference a design spec in `docs/superpowers/specs/`.

**Example structure:**
```
## File Structure
packages/api/src/otel.ts          # NEW — OTel SDK init
packages/api/src/app.ts           # MODIFY — add OTel middleware

### Task 1: Install dependencies
- [ ] Step 1: Install deps in @nohmi/api
- [ ] Step 2: Install deps in @nohmi/db
```

**BPMove adaptation:** For any remaining feature work (Spotify integration, session logging, demo polish), write a plan in `docs/plans/` before coding. The checkbox format lets Claude track progress across sessions. Not worth retroactively documenting what's already built — only use for forward work.

---

### #6 — Testcontainers-Equivalent for Hard-to-Test Code
**ROI: Medium — targeted at BLE/audio, your hardest testing gap**

**What Cooper does:** `packages/db/test/helpers/pg.ts` — a helper that spins up a real Postgres container per test suite. Pattern: `createTestContainer()` → `pushSchema()` → run tests → `truncateAll()` → `container.stop()`. No mocking the data layer.

**BPMove adaptation:** You can't run a real BLE chest strap in CI, but you can adopt the *pattern*:
- **BLE Mock Device:** Create `test/helpers/ble-mock.ts` that implements the same interface as `react-native-ble-plx` but emits simulated heart rate data. Use realistic HR patterns (resting: 60-70, running: 140-170, spikes, dropouts).
- **Audio Engine Test Harness:** Create `test/helpers/audio-mock.ts` that tracks BPM changes without playing actual audio. Assert on BPM adjustment timing and magnitude.
- **Integration test pattern:** `createMockBLEDevice()` → `connectService()` → simulate HR stream → assert EventBus events → `cleanup()`. Same lifecycle as Cooper's Testcontainers helper.
- **Key difference from current mocks:** These aren't Jest mocks that return canned values. They're *behavioral simulators* that model real device behavior (connection delays, dropped packets, reconnection).

---

### #7 — Pre-seeded Memory
**ROI: Low-Medium — Cooper doesn't actually do this yet**

**What Cooper does:** Nothing. No `.claude/projects/` memory, no `MEMORY.md`. This is a gap in Cooper's repo too.

**BPMove adaptation:** Since you identified this as a gap, here's what would help for BPMove specifically:
- **User memory:** "Grant is a senior CS student building a React Native capstone. Deep knowledge of service-oriented architecture. Deadline: May 2026 graduation."
- **Project memory:** "BPMove demo must work flawlessly for capstone presentation. Offline-first (local tracks) is the safe path. Spotify is nice-to-have."
- **Feedback memories:** Seed with your most-repeated corrections (e.g., "Don't suggest Redux", "Don't use Expo APIs", "Services communicate through EventBus only").

---

## 2. Migration Checklist (Ordered by Impact)

| # | Action | Files to Create/Modify | Time |
|---|--------|----------------------|------|
| 1 | Create decision log | `docs/decisions/decision-log.md` | 1h |
| 2 | Reference decision log from CLAUDE.md | `CLAUDE.md` (add one line) | 5min |
| 3 | Create `bpmove-architecture` skill | `.claude/skills/bpmove-architecture/SKILL.md` + `references/*.md` | 2-3h |
| 4 | Add GitHub Actions CI | `.github/workflows/ci.yml` | 1-2h |
| 5 | Create contracts directory | `src/contracts/{events,services,providers,results}.ts` | 2h |
| 6 | Add "contracts are source of truth" to CLAUDE.md | `CLAUDE.md` | 5min |
| 7 | Create BLE/audio test helpers | `test/helpers/{ble-mock,audio-mock}.ts` | 3-4h |
| 8 | Seed Claude memory | `.claude/` memory files | 30min |
| 9 | Write implementation plans for remaining features | `docs/plans/*.md` | as needed |

**Total estimated effort:** ~10-12 hours for items 1-8.

---

## 3. Demo Prep Section

Cooper's repo has patterns that translate directly to capstone demo preparation:

### A. CI as Regression Gate
Cooper's CI runs lint + typecheck + tests on every push. For your demo:
- Set up CI (item #4 above) and **never merge a red PR** in the final 3 weeks
- Add a `build` job that runs `react-native bundle --platform ios` — this catches import/bundler errors that would crash the demo

### B. Docker Compose for Reproducible Environment
Cooper uses `docker-compose.yml` to spin up Postgres + Hydra + API in one command. For your demo:
- Create a `demo-setup.sh` script that: kills existing Metro, clears caches (`watchman watch-del-all`, `rm -rf node_modules/.cache`), reinstalls pods, starts Metro, boots simulator
- Test this script on a **clean clone** before demo day

### C. Integration Test as Smoke Test
Cooper's `connection.integration.test.ts` verifies all 7 DB tables exist and can CRUD. For your demo:
- Write a `demo-smoke.test.ts` that verifies: ServiceRegistry initializes all services → BLE mock connects → HR data flows through EventBus → BPM engine adjusts tempo → session logs correctly
- Run this as part of CI AND manually before the presentation

### D. Implementation Plans for Polish
Cooper writes task-based plans with checkboxes before starting work. For your last 5 weeks:
- Write `docs/plans/demo-polish.md` with every remaining task, prioritized by demo impact
- Check off items as you go — if you run out of time, the unchecked items are your known gaps

### E. No Hooks (Honest Assessment)
Cooper doesn't have hooks either. For BPMove at 5 weeks out, **don't invest in hooks**. The ROI is too low — CI catches the same issues. Hooks are a nice-to-have for ongoing projects, not a deadline-driven capstone.

---

## 4. What to Skip

These patterns exist in Cooper's repo but are **not worth adopting for BPMove** given your timeline:

| Pattern | Why Skip |
|---------|----------|
| **Biome migration** | You have ESLint working. Switching linters 5 weeks before demo is risk for no reward. |
| **Monorepo (Bun workspaces + Turborepo)** | BPMove is a single React Native app, not a multi-package monorepo. Over-engineering. |
| **AGENTS.md** | Cooper doesn't have one either. Solo developer, no multi-agent coordination needed. |
| **Design system skill** | Cooper's is for a web app with a custom design language. BPMove's UI complexity doesn't warrant a full skill — your CLAUDE.md UI guidance is sufficient. |
| **Hooks** | Neither repo has them. CI covers the same ground. Not worth the setup cost now. |
| **Memory pre-seeding** | Low ROI — your CLAUDE.md is strong enough. Do this only if you keep hitting the same corrections. |
