# Trainer-trainee collaboration implementation plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development
> (if subagents available) or superpowers:executing-plans to implement this
> plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Railway-hosted trainer-trainee collaboration sessions where one
trainer can run a scenario and multiple trainees can join from other devices.

**Architecture:** A Node.js server owns one authoritative `SimulationEngine` per
session and broadcasts compact snapshots over WebSocket. Remote browsers keep
their own waveform buffers for smooth monitor rendering, while trainer-only UI
adds phase preview, phase forcing, vitals overrides, and event injection.

**Tech Stack:** Vite, React 19, TypeScript, Node.js, Express, `ws`, Zod, Vitest,
Railway.

---

## File structure

This section locks in the main files and responsibilities before implementation.

**Create server files:**

- `server/index.ts`: HTTP server, static file serving, `/health`, WebSocket
  upgrade, and process port handling.
- `server/loadScenarios.ts`: Node-compatible scenario markdown loader using the
  existing DSL parser and interpreter.
- `server/SessionManager.ts`: Session code generation, lookup, cleanup, and
  session limits.
- `server/SimulationSession.ts`: One authoritative engine, connected clients,
  protocol command handling, trainer authorization, and broadcasts.
- `server/serializeState.ts`: Converts `PatientState` plus engine metadata into
  `RemotePatientSnapshot`.
- `server/protocolValidation.ts`: Runtime validation for incoming client
  messages.

**Create shared files:**

- `shared/protocol.ts`: Client and server message types, error codes, and remote
  snapshot types.

**Create remote UI files:**

- `ui/network/WebSocketClient.ts`: Browser WebSocket wrapper with reconnect,
  token reuse, message dispatch, and send helpers.
- `ui/remote/RemoteWaveformStore.ts`: Local waveform buffer writer for remote
  sessions.
- `ui/context/RemoteSimulationContext.tsx`: Remote session state, monitor state,
  waveform source, event log, roster, and command senders.
- `ui/pages/LobbyPage.tsx`: Create and join session flows.
- `ui/pages/TrainerView.tsx`: Existing monitor plus trainer panels.
- `ui/pages/TraineeView.tsx`: Existing monitor plus interventions.
- `ui/components/Trainer/PhaseTimeline.tsx`: Trainer-only scenario phase cards.
- `ui/components/Trainer/OverridePanel.tsx`: Trainer vitals and rhythm controls.
- `ui/components/Trainer/EventInjector.tsx`: Trainer event injection form.
- `ui/components/Trainer/TraineeRoster.tsx`: Connected trainee list and count.

**Modify existing files:**

- `engine/physiology.ts`: Inject runtime scheduler/clock, add modifier hook, and
  keep browser behavior unchanged.
- `engine/scenario.ts`: Add optional runtime metadata and forced phase APIs.
- `engine/scenarios/dsl/interpret.ts`: Expose phase runtime metadata, forced
  phase selection, and forced phase clearing.
- `ui/components/Monitor/Monitor.tsx`: Read from either local simulation context
  or remote simulation context through a shared monitor-facing hook.
- `ui/components/Monitor/MonitorBand.tsx`: Accept a `WaveformSource` instead of
  a full `SimulationEngine`.
- `ui/components/Monitor/ECGCanvas.tsx`: Accept a `WaveformSource`.
- `ui/components/Monitor/SimpleWaveformCanvas.tsx`: Accept a `WaveformSource`.
- `ui/App.tsx`: Add lobby, trainer, and trainee routing while preserving solo
  mode.
- `package.json`: Add server dependencies and scripts.
- `tsconfig.json`: Reference server config.
- `tsconfig.server.json`: Build the server into `dist/server`.
- `vite.config.ts`: Add dev proxy for WebSocket if needed.
- `tsup.config.ts`: Bundle the server for Railway so extensionless internal
  imports in `engine/` do not require a repo-wide NodeNext import migration.

---

## Chunk 1: Shared protocol and server scaffold

This chunk creates a compileable server shell without changing engine behavior.
It must produce a working `/health` endpoint and a WebSocket endpoint that can
accept and validate basic messages.

### Task 1: Add server dependencies and build config

**Files:**

- Modify: `package.json`
- Modify: `tsconfig.json`
- Create: `tsconfig.server.json`
- Create: `tsup.config.ts`
- Modify: `vite.config.ts`

- [ ] **Step 1: Add dependencies**

Add runtime dependencies:

```json
"express": "^5.1.0",
"ws": "^8.18.0"
```

Add development dependencies:

```json
"@types/express": "^5.0.0",
"@types/ws": "^8.5.13",
"concurrently": "^9.1.2",
"tsup": "^8.3.5"
```

- [ ] **Step 2: Add scripts**

Update `package.json` scripts:

```json
"dev": "vite",
"dev:client": "vite",
"dev:server": "tsx watch server/index.ts",
"dev:full": "concurrently \"npm run dev:client\" \"npm run dev:server\"",
"build": "tsc -b && vite build && tsup",
"start": "node dist/server/index.js"
```

Keep existing `lint`, `test`, `typecheck`, `lint:scenarios`, and `prepare`
scripts.

- [ ] **Step 3: Add server TypeScript config for checking only**

Create `tsconfig.server.json`:

```json
{
  "compilerOptions": {
    "target": "es2023",
    "lib": ["ES2023"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "types": ["node"],
    "skipLibCheck": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "strict": true,
    "noEmit": true
  },
  "include": ["server", "shared", "engine", "scenarios"]
}
```

Do not emit the server directly with `tsc`. The existing engine uses
extensionless imports that work with Vite and bundler resolution. A raw NodeNext
emit would require changing many shared imports to `.js` specifiers. Bundle the
server instead.

- [ ] **Step 4: Add server bundler config**

Create `tsup.config.ts`:

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['server/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist/server',
  clean: false,
  sourcemap: true,
  splitting: false,
  dts: false,
})
```

- [ ] **Step 5: Reference the server config**

Update `tsconfig.json` references:

```json
{ "path": "./tsconfig.server.json" }
```

- [ ] **Step 6: Include server tests in Vitest**

Update `vite.config.ts` test include:

```ts
include: ['engine/**/*.test.ts', 'ui/**/*.test.ts', 'server/**/*.test.ts'],
```

- [ ] **Step 7: Add Vite dev WebSocket proxy**

Add a dev proxy so browser clients served by Vite can connect to `/ws` while the
Node server runs on its own port:

```ts
server: {
  proxy: {
    '/ws': {
      target: 'ws://localhost:4174',
      ws: true,
    },
  },
},
```

The server dev port must default to `4174` unless `PORT` is set.

- [ ] **Step 8: Install dependencies**

Run: `npm install`

Expected: lockfile updates and no install errors.

- [ ] **Step 9: Run typecheck**

Run: `npm run typecheck`

Expected: existing app still typechecks, or server config errors reveal the next
minimal fix.

- [ ] **Step 10: Run server bundle**

Run: `npm run build`

Expected: the server bundles to `dist/server/index.js` without NodeNext import
specifier errors.

### Task 2: Define protocol types and validation

**Files:**

- Create: `shared/protocol.ts`
- Create: `server/protocolValidation.ts`
- Create: `server/protocolValidation.test.ts`

- [ ] **Step 1: Write validation tests first**

Create `server/protocolValidation.test.ts` with tests for valid joins, malformed
JSON, unknown message types, invalid payloads, oversized event text, and empty
`clear_forced_phase` payload.

Also cover all declared message types: `create_session`, `reconnect`,
`start_scenario`, `intervene`, `update_machine_settings`,
`set_manual_ventilation`, `override`, `clear_trainer_overrides`,
`advance_phase`, `pause`, `resume`, and `end_session`. Include invalid session
code format, blank names, override type errors, machine settings type errors,
manual ventilation type errors, and max raw message size.

```ts
import { describe, expect, it } from 'vitest'
import { parseClientMessage } from './protocolValidation'

describe('parseClientMessage', () => {
  it('accepts a valid join message', () => {
    expect(parseClientMessage(JSON.stringify({
      type: 'join_session',
      sessionCode: '7K3M9P',
      name: 'John',
    }))).toEqual({ ok: true, message: {
      type: 'join_session',
      sessionCode: '7K3M9P',
      name: 'John',
    }})
  })

  it('rejects malformed JSON', () => {
    expect(parseClientMessage('{')).toEqual({ ok: false, code: 'bad_json' })
  })

  it('rejects unknown message types', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'wat' }))).toEqual({
      ok: false,
      code: 'unknown_message_type',
    })
  })

  it('rejects long injected events', () => {
    expect(parseClientMessage(JSON.stringify({
      type: 'inject_event',
      text: 'x'.repeat(301),
    }))).toEqual({ ok: false, code: 'invalid_payload' })
  })

  it('accepts clear_forced_phase with an empty payload', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'clear_forced_phase' }))).toEqual({
      ok: true,
      message: { type: 'clear_forced_phase' },
    })
  })
})
```

- [ ] **Step 2: Run the failing validation tests**

Run: `npx vitest run server/protocolValidation.test.ts`

Expected: FAIL because files do not exist.

- [ ] **Step 3: Add `shared/protocol.ts`**

Define `ClientMessage`, `ServerMessage`, `RemotePatientSnapshot`,
`ScenarioMetadataMessage`, and `ErrorCode`. Keep these as type definitions only.

- [ ] **Step 4: Add minimal validation implementation**

Create `server/protocolValidation.ts`. Use Zod, which is already in the project,
to parse incoming messages and return a small discriminated result:

```ts
import { z } from 'zod'
import type { ClientMessage, ErrorCode } from '../shared/protocol'

export type ParseResult =
  | { ok: true; message: ClientMessage }
  | { ok: false; code: ErrorCode }

export function parseClientMessage(raw: string): ParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, code: 'bad_json' }
  }

  const result = ClientMessageSchema.safeParse(parsed)
  if (!result.success) {
    const type = typeof parsed === 'object' && parsed !== null && 'type' in parsed
      ? String((parsed as { type: unknown }).type)
      : ''
    return {
      ok: false,
      code: knownTypes.has(type) ? 'invalid_payload' : 'unknown_message_type',
    }
  }

  return { ok: true, message: result.data }
}
```

- [ ] **Step 5: Run validation tests**

Run: `npx vitest run server/protocolValidation.test.ts`

Expected: PASS.

### Task 3: Add HTTP and WebSocket server skeleton

**Files:**

- Create: `server/index.ts`
- Create: `server/index.test.ts`

- [ ] **Step 1: Write server helper test first**

Extract the Express app creation to a testable function and verify `/health`:

```ts
import { describe, expect, it } from 'vitest'
import { createApp } from './index'

describe('createApp', () => {
  it('returns ok from health endpoint', async () => {
    const app = createApp()
    const server = app.listen(0)
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('missing port')

    const response = await fetch(`http://127.0.0.1:${address.port}/health`)
    server.close()

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('ok')
  })
})
```

- [ ] **Step 2: Run the failing test**

Run: `npx vitest run server/index.test.ts`

Expected: FAIL because `createApp` does not exist.

- [ ] **Step 3: Implement `server/index.ts`**

Implement `createApp()`, static serving from `dist`, `/health`, HTTP server
startup, and a `/ws` WebSocket server that currently echoes an `error` message
for unsupported operations.

- [ ] **Step 4: Run server tests**

Run: `npx vitest run server/index.test.ts server/protocolValidation.test.ts`

Expected: PASS.

- [ ] **Step 5: Run build**

Run: `npm run build`

Expected: PASS, or reveal `tsconfig.server.json` import extension issues that
must be fixed before continuing.

---

## Chunk 2: Engine runtime, phase APIs, and override hook

This chunk makes the engine usable in Node and adds the scenario control points
needed by trainer mode. Keep all existing local simulation behavior unchanged.

### Task 4: Inject engine runtime scheduler and clock

**Files:**

- Modify: `engine/physiology.ts`
- Test: `engine/physiology.test.ts`

- [ ] **Step 1: Add failing scheduler tests**

Create tests that instantiate `SimulationEngine` with a fake runtime. Verify:

- `start()` schedules a frame.
- `stop()` cancels the scheduled frame.
- `togglePause()` uses the injected clock.
- Tick delta clamping still caps long delays at 100 ms.

- [ ] **Step 2: Run the failing tests**

Run: `npx vitest run engine/physiology.test.ts -t "runtime"`

Expected: FAIL because runtime injection does not exist.

- [ ] **Step 3: Add runtime types and defaults**

In `engine/physiology.ts`, add:

```ts
interface EngineRuntime {
  now: () => number
  scheduleFrame: (callback: (timestamp: number) => void) => unknown
  cancelFrame: (handle: unknown) => void
}
```

Add browser default runtime that wraps `requestAnimationFrame` and
`cancelAnimationFrame`. Use `performance.now()` only through `runtime.now()`.

- [ ] **Step 4: Replace direct time reads**

Replace all direct `performance.now()` reads in `physiology.ts` with
`this.runtime.now()`, including pause, resume, manual ventilation, and tick
initialization paths.

- [ ] **Step 5: Run engine tests**

Run: `npm run test`

Expected: PASS.

### Task 5: Add scenario runtime metadata and forced phase APIs

**Files:**

- Modify: `engine/scenario.ts`
- Modify: `engine/scenarios/dsl/interpret.ts`
- Test: `engine/scenarios/dsl/interpret.test.ts`

- [ ] **Step 1: Add failing forced phase tests**

Add tests covering:

- `getRuntimeInfo()` returns current phase and completed phases.
- `forcePhase('recovery')` keeps recovery active even when `enter_when` is false.
- `clearForcedPhase()` returns to automatic last-matching phase selection.
- Resolve or fail works from a forced phase.

- [ ] **Step 2: Run failing tests**

Run: `npx vitest run engine/scenarios/dsl/interpret.test.ts -t "forced phase"`

Expected: FAIL.

- [ ] **Step 3: Extend `Scenario` interface**

Add optional `getRuntimeInfo`, `forcePhase`, and `clearForcedPhase` methods as
specified in the design doc.

- [ ] **Step 4: Implement forced phase state**

In `interpret.ts`, add `forcedPhaseId: string | null`. When set, skip normal
phase selection and keep the forced phase active until cleared, changed,
resolved, failed, reset, or session restart.

- [ ] **Step 5: Run interpreter tests**

Run: `npx vitest run engine/scenarios/dsl/interpret.test.ts`

Expected: PASS.

### Task 6: Add engine modifier hook for trainer overrides

**Files:**

- Modify: `engine/physiology.ts`
- Test: `engine/physiology.test.ts`

- [ ] **Step 1: Add failing override hook test**

Test that a hook modifier applies after scenario modifiers but before drift and
waveform generation. Keep the assertion focused on state values to avoid brittle
waveform tests.

- [ ] **Step 2: Run failing hook test**

Run: `npx vitest run engine/physiology.test.ts -t "modifier hook"`

Expected: FAIL.

- [ ] **Step 3: Add `setModifierHook` or constructor option**

Prefer a constructor option:

```ts
type ModifierHook = (state: PatientState, elapsedSec: number) => PatientModifier | null
```

Call it inside the tick after scenario results apply and before drift, active
effects, waveform generation, and broadcast.

- [ ] **Step 4: Run engine tests**

Run: `npm run test`

Expected: PASS.

---

## Chunk 3: Server sessions and authoritative simulation

This chunk turns the server shell into a useful collaboration host. It does not
need final UI yet; tests drive server-side session behavior.

### Task 7: Add Node scenario loader

**Files:**

- Create: `server/loadScenarios.ts`
- Test: `server/loadScenarios.test.ts`

- [ ] **Step 1: Write failing loader test**

Test that `loadScenarios()` reads markdown from `scenarios/`, returns an entry
for `anaphylaxis`, and exposes trainer metadata phases.

Assert the exact metadata shape: `type`, `scenarioId`, `label`, `phases[].id`,
camelCase predicate fields (`enterWhen`, `resolveWhen`, `failWhen`),
`events[].atSec`, `snap`, and `baseline`.

- [ ] **Step 2: Run failing test**

Run: `npx vitest run server/loadScenarios.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement loader**

Use Node `fs` and `path` to read `scenarios/*.md`. Use existing
`parseScenarioFile()` and `specToScenario()`.

Return a server-specific shape that keeps runtime and metadata together:

```ts
interface ServerScenario {
  scenario: Scenario
  spec: ScenarioSpec
  debriefBody: string
  metadata: ScenarioMetadataMessage
}
```

The `metadata` field is trainer-only and must not be sent to trainees.

- [ ] **Step 4: Run loader test**

Run: `npx vitest run server/loadScenarios.test.ts`

Expected: PASS.

### Task 8: Add state serialization

**Files:**

- Create: `server/serializeState.ts`
- Test: `server/serializeState.test.ts`

- [ ] **Step 1: Write failing serialization test**

Verify snapshots include vitals, rhythm, capnography shape, manual ventilation,
machine settings, ART, CVP, BIS, phase, elapsed seconds, and no waveform buffers.

- [ ] **Step 2: Run failing test**

Run: `npx vitest run server/serializeState.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement serializer**

Create `serializeState(engine, runtimeInfo)` and return `RemotePatientSnapshot`.

- [ ] **Step 4: Run serializer test**

Run: `npx vitest run server/serializeState.test.ts`

Expected: PASS.

### Task 9: Add session manager and session authorization

**Files:**

- Create: `server/SessionManager.ts`
- Create: `server/SimulationSession.ts`
- Test: `server/SessionManager.test.ts`
- Test: `server/SimulationSession.test.ts`

- [ ] **Step 1: Write failing manager tests**

Cover session code format, no ambiguous characters, max sessions, empty cleanup,
and lookup misses.

Also cover empty lobby cleanup after 10 minutes, terminal cleanup after 10
minutes, and trainer disconnect grace behavior with a fake clock.

- [ ] **Step 2: Write failing session tests**

Cover trainer token creation, trainee token creation, reconnect with token,
trainer-only command rejection for trainees, and max 30 trainees.

Also cover reconnect resync payloads: latest snapshot, roster, event log, phase,
and terminal state for both trainer and trainee reconnects.

- [ ] **Step 3: Run failing tests**

Run: `npx vitest run server/SessionManager.test.ts server/SimulationSession.test.ts`

Expected: FAIL.

- [ ] **Step 4: Implement minimal manager and session classes**

Keep transport concerns separate. Represent connected clients through a small
interface:

```ts
interface SessionClient {
  id: string
  role: 'trainer' | 'trainee'
  name: string
  send: (message: ServerMessage) => void
}
```

- [ ] **Step 5: Implement command authorization**

Trainer-only commands must validate role and token server-side.

- [ ] **Step 6: Run server tests**

Run: `npx vitest run server/**/*.test.ts`

Expected: PASS.

### Task 10: Wire WebSocket server to sessions

**Files:**

- Modify: `server/index.ts`
- Modify: `server/SimulationSession.ts`
- Test: `server/index.test.ts`

- [ ] **Step 1: Add WebSocket integration test**

Use `ws` client in the test to create a session, join as a trainee, and receive
`session_info`.

- [ ] **Step 2: Run failing integration test**

Run: `npx vitest run server/index.test.ts -t "websocket"`

Expected: FAIL.

- [ ] **Step 3: Implement WebSocket routing**

Parse each message with `parseClientMessage`, route to `SessionManager`, send
typed errors, and enforce max message size.

- [ ] **Step 4: Add heartbeat**

Implement ping/pong heartbeat: ping every 20 seconds, terminate after 45 seconds
without pong.

- [ ] **Step 5: Add heartbeat timeout test**

Use a fake timer or injectable clock to verify stale WebSocket clients terminate
after 45 seconds without pong.

- [ ] **Step 6: Run server tests**

Run: `npx vitest run server/**/*.test.ts`

Expected: PASS.

### Task 10B: Add authoritative state broadcast loop

**Files:**

- Modify: `server/SimulationSession.ts`
- Modify: `shared/protocol.ts`
- Test: `server/SimulationSession.test.ts`

- [ ] **Step 1: Add failing state stream tests**

Test that `start_scenario` starts the authoritative engine and that the session
broadcasts compact `state` messages at 10 Hz while updating `lastSnapshot`.

- [ ] **Step 2: Add failing immediate event tests**

Test that phase changes, `resolved`, `failed`, scenario events, and intervention
logs are emitted immediately and are not delayed by the 10 Hz state throttle.

- [ ] **Step 3: Add failing resync event-log test**

Test that join and reconnect send `event_log_snapshot` with existing session
history, followed by the latest state, roster, and phase.

- [ ] **Step 4: Implement broadcast loop**

Subscribe to the engine's state, event, phase, and dose-ledger channels. Throttle
`state` messages to 10 Hz, update `lastSnapshot` before broadcast, and send
immediate non-state messages as they occur.

- [ ] **Step 5: Run session tests**

Run: `npx vitest run server/SimulationSession.test.ts`

Expected: PASS.

---

## Chunk 4: Remote waveform source and monitor integration

This chunk makes the existing monitor render from either local or remote state
without duplicating the monitor UI.

### Task 10A: Extract shared simulation-facing hooks

**Files:**

- Create: `ui/context/SimulationBridge.tsx`
- Modify: `ui/context/SimulationContext.tsx`
- Modify: `ui/context/AlarmsContext.tsx`
- Modify: `ui/components/RightPanel/RightPanel.tsx`
- Modify: `ui/components/Monitor/Monitor.tsx`

- [ ] **Step 1: Define shared simulation interface**

Create a remote-compatible interface that includes everything shared UI needs:

```ts
interface SimulationBridgeValue {
  state: PatientState
  scenario: Scenario | null
  phase: SimulationPhase
  elapsedSeconds: number
  eventLog: string[]
  doseLedger: ReadonlyMap<string, DoseEntry>
  waveformSource: WaveformSource
  applyIntervention: (id: string) => void
  updateMachineSettings: (settings: MachineSettingsUpdate) => void
  setManualVentilation: (active: boolean) => void
  togglePause: () => void
}
```

Use existing project types where possible. Keep this file UI-only; do not import
it from `engine/`.

- [ ] **Step 2: Adapt local provider to expose bridge value**

`SimulationContext.tsx` continues to own the local `SimulationEngine`, but also
provides a `SimulationBridgeValue` for shared UI.

- [ ] **Step 3: Update alarms to use bridge state**

`AlarmsProvider` must no longer require the local-only `useSimulation()` path.
It should use the shared bridge state so alarms work in remote mode.

- [ ] **Step 4: Update right panel actions**

`RightPanel` must call bridge actions so intervention buttons, machine settings,
and manual ventilation work in local and remote modes.

Remote mode sends `update_machine_settings` and `set_manual_ventilation` through
`WebSocketClient`. Server handlers apply these commands to the authoritative
engine with the same validation as local mode.

- [ ] **Step 5: Update alarm hook for remote mode**

Modify `ui/hooks/useAlarms.ts` so alarm detection can run from bridge state
without requiring a local `SimulationEngine` subscription. If audio beat and
breath sounds still need an engine timing source, disable only those sounds in
remote mode and keep visual alarms active. Add a small test or manual checklist
entry that remote visual alarms still update.

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

### Task 11: Extract waveform source interface

**Files:**

- Create: `ui/components/Monitor/waveformSource.ts`
- Modify: `ui/components/Monitor/MonitorBand.tsx`
- Modify: `ui/components/Monitor/ECGCanvas.tsx`
- Modify: `ui/components/Monitor/SimpleWaveformCanvas.tsx`

- [ ] **Step 1: Add type-only interface**

Create `WaveformSource` with `state` containing the waveform buffers and
`bufferWritePos`.

- [ ] **Step 2: Replace canvas props**

Change canvas props from `engine: SimulationEngine` to
`waveformSource: WaveformSource`.

- [ ] **Step 3: Update `MonitorBand`**

Pass `waveformSource` to both canvas components.

- [ ] **Step 4: Update `Monitor.tsx` local path**

Use the existing local `engine` as a valid `WaveformSource` because it has
`state` with buffers.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

### Task 12: Add `RemoteWaveformStore`

**Files:**

- Create: `ui/remote/RemoteWaveformStore.ts`
- Test: `ui/remote/RemoteWaveformStore.test.ts`

- [ ] **Step 1: Write failing waveform store tests**

Verify it creates buffers with `BUFFER_SIZE`, advances `bufferWritePos`, and
uses snapshot values to generate ECG, SpO2, ETCO2, resp, and ART samples.

- [ ] **Step 2: Run failing test**

Run: `npx vitest run ui/remote/RemoteWaveformStore.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement store**

Use existing waveform generator functions from `engine/waveforms.ts` and keep a
mutable buffer state object that satisfies `WaveformSource`.

- [ ] **Step 4: Run waveform store test**

Run: `npx vitest run ui/remote/RemoteWaveformStore.test.ts`

Expected: PASS.

### Task 13: Add remote simulation context

**Files:**

- Create: `ui/context/RemoteSimulationContext.tsx`
- Modify: `ui/components/Monitor/Monitor.tsx`
- Create: `ui/components/Monitor/useMonitorSimulation.ts`

- [ ] **Step 1: Add shared monitor-facing hook**

Create `useMonitorSimulation()` that returns `state`, `scenario`, and
`waveformSource`. It first checks remote context, then local context.

- [ ] **Step 2: Update `Monitor.tsx`**

Replace direct `useSimulation()` usage with `useMonitorSimulation()` for monitor
rendering only.

- [ ] **Step 3: Add remote provider**

Implement `RemoteSimulationProvider` with state from WebSocket messages and a
`RemoteWaveformStore` instance.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

---

## Chunk 5: Client WebSocket and session flows

This chunk adds the user-visible entry points for creating and joining sessions.

### Task 14: Add browser WebSocket client

**Files:**

- Create: `ui/network/WebSocketClient.ts`
- Test: `ui/network/WebSocketClient.test.ts`

- [ ] **Step 1: Write reconnect tests**

Use a fake WebSocket factory. Cover connect, send, reconnect token storage,
backoff retry, and message dispatch.

- [ ] **Step 2: Run failing test**

Run: `npx vitest run ui/network/WebSocketClient.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement client wrapper**

Keep browser APIs behind constructor injection so tests can use fakes.

- [ ] **Step 4: Run WebSocket client test**

Run: `npx vitest run ui/network/WebSocketClient.test.ts`

Expected: PASS.

### Task 15: Add lobby page and routing

**Files:**

- Create: `ui/pages/LobbyPage.tsx`
- Modify: `ui/App.tsx`
- Modify: `ui/index.css`

- [ ] **Step 1: Add route state**

Extend `App.tsx` screen state with solo, lobby, trainer, and trainee screens.
Preserve the existing solo start flow.

- [ ] **Step 2: Implement lobby page**

Create two cards:

- **Practice solo:** existing local flow.
- **Start trainer session:** name, scenario, create button.
- **Join session:** name, session code, join button.

- [ ] **Step 3: Add light-theme styles**

Use the existing light palette: `#f7f7f2`, `#fffdf7`, `#1d83a6`, `#334047`, and
`#a9a397`.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Run solo mode smoke checklist**

Because there is no UI test framework yet, manually verify the existing solo
flow after routing changes:

- Start the Vite dev server with `npm run dev`.
- Open the app locally.
- Select a scenario from the existing start page.
- Start the scenario.
- Confirm monitor numerics update.
- Confirm waveforms animate.
- Apply an intervention from `RightPanel`.
- Change one machine setting.
- Toggle manual ventilation.
- Pause and resume the local simulation.
- Confirm no console errors appear.

---

## Chunk 6: Trainer and trainee views

This chunk adds role-specific UI while reusing the current monitor.

### Task 16: Add trainee view

**Files:**

- Create: `ui/pages/TraineeView.tsx`
- Modify: `ui/components/RightPanel/RightPanel.tsx` if needed for remote command
  injection.

- [ ] **Step 1: Implement trainee view shell**

Render `Monitor`, existing intervention controls, event log, and connection
status.

- [ ] **Step 2: Wire interventions**

In remote mode, intervention buttons send `intervene` messages instead of
calling local engine methods.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

### Task 17: Add trainer panels

**Files:**

- Create: `ui/pages/TrainerView.tsx`
- Create: `ui/components/Trainer/PhaseTimeline.tsx`
- Create: `ui/components/Trainer/OverridePanel.tsx`
- Create: `ui/components/Trainer/EventInjector.tsx`
- Create: `ui/components/Trainer/TraineeRoster.tsx`
- Modify: `ui/index.css`

- [ ] **Step 1: Implement trainer view shell and top bar**

Use the approved layout: existing `Monitor` on the left; light-themed trainer
controls on the right. Add session code, QR code placeholder or generated QR,
copy invite link, trainee count, pause or resume, and end session actions to the
top bar.

- [ ] **Step 2: Implement phase timeline**

Consume trainer-only `scenario_metadata` and runtime phase info. Add buttons for
**Advance now** and **Return to automatic**.

- [ ] **Step 3: Implement override panel**

Add controls for HR, SpO2, ETCO2, RR, temp, NIBP sys/dia, and ECG rhythm. Send
`override` messages with `mode: 'set_now'` or `mode: 'set_target'`.

Include **Reset to scenario**, which clears active trainer overrides by sending
the matching protocol command. Add a server-side test that reset clears stored
overrides.

- [ ] **Step 4: Implement event injector**

Validate max 300 characters client-side and send `inject_event`.

Include a trainer-local **Preview** action that shows exactly what will be sent
without broadcasting.

- [ ] **Step 5: Implement roster**

Show trainee names and count from `session_info`.

- [ ] **Step 6: Implement trainer intervention log**

Render trainer-only intervention attribution messages from `intervention_log`,
for example `[+42s] John applied Adrenaline 10 mcg IV`. Add a server-side test
that trainer receives attribution and trainees do not receive future phase
metadata.

- [ ] **Step 7: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

---

## Chunk 7: End-to-end wiring and deployment verification

This chunk validates that the system works as a deployable Railway service.

### Task 18: Add production server static serving and smoke test

**Files:**

- Modify: `server/index.ts`
- Create: `scripts/production-smoke.ts`
- Modify: `package.json`

- [ ] **Step 1: Verify static serving path**

Ensure production server serves `dist/index.html` and static assets after
`vite build`.

- [ ] **Step 2: Add `/health` smoke command**

Add `scripts/production-smoke.ts`, not a Vitest test. It starts
`npm run start`, waits for `/health`, and exits cleanly. Add a package script:

```json
"smoke:production": "tsx scripts/production-smoke.ts"
```

Do not place this under `server/**/*.test.ts`, because `npm run test` runs
before `npm run build` in normal verification and `dist/` may not exist yet.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Run production start smoke test**

Run: `npm run smoke:production`

Expected: `/health` returns `ok`.

### Task 19: Run full verification

**Files:**

- No source changes unless verification reveals bugs.

- [ ] **Step 1: Run tests**

Run: `npm run test`

Expected: PASS.

- [ ] **Step 2: Run scenario lint**

Run: `npm run lint:scenarios`

Expected: PASS.

- [ ] **Step 3: Run lint**

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Run build**

Run: `npm run build`

Expected: PASS.

---

## Implementation notes

- Do not commit unless the user explicitly asks for commits.
- Keep solo mode working throughout; collaboration is additive.
- Keep `engine/` free of React, DOM, Express, WebSocket, and Node-only imports.
- Prefer small, focused files over expanding `SimulationContext.tsx` or
  `RightPanel.tsx` further.
- Use `import type` for type-only imports because `verbatimModuleSyntax` is
  enabled.
- Avoid TypeScript parameter properties because `erasableSyntaxOnly` is enabled.
- If `advance_phase` proves too large during implementation, ship trainer phase
  preview and defer force controls behind disabled UI with a clear comment.

## Execution handoff

Use `subagent-driven-development` to execute this plan. Dispatch fresh agents per
chunk where possible, with explicit test commands and a review pass after each
chunk.
