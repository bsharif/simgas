# Trainer-trainee collaboration — Design spec

**Date:** 2026-05-20  
**Status:** Draft  
**Scope:** Add server-hosted collaborative simulation sessions for trainers and
trainees.

This spec defines how SimGas adds a real-time trainer-trainee mode while
preserving the existing single-device simulation architecture. The design uses
a Railway-hosted Node.js server as the authoritative simulation host, a shared
WebSocket protocol for session sync, and role-specific React views for trainers
and trainees.

> **Note:** This is a preview feature currently under active development.

---

## Goals

The collaboration feature must let a trainer run a scenario and invite one or
more trainees to join from separate devices. The trainer gets controls to steer
the scenario, while trainees interact with the monitor and apply interventions.

The feature must support these user capabilities:

- A trainer can create a session, select a scenario, and share a session code
  or QR code.
- A trainee can join with a display name, for example, `John`.
- Multiple trainees can join the same session.
- The server runs the authoritative `SimulationEngine` for each active session.
- Trainees see the monitor, event log, and intervention controls.
- Trainers see the same monitor plus trainer-only controls for phase preview,
  manual overrides, and event injection.
- Clients reconnect cleanly when network connectivity drops.

---

## Non-goals

This phase deliberately avoids broader platform features so the first
implementation remains focused and testable.

- Persistent user accounts and authentication are out of scope.
- Long-term storage of session recordings is out of scope.
- Supabase Realtime is out of scope because there is no existing Supabase
  dependency and Railway still needs to host the simulation engine.
- Peer-to-peer WebRTC is out of scope because restricted hospital and education
  networks can block direct connections.
- Deterministic dual-engine sync is out of scope because the current drift and
  waveform systems are continuous and can diverge across devices.

---

## Architecture

The server runs one `SimulationEngine` per collaboration session. Browsers are
thin clients that send commands and receive state snapshots.

```text
simgas/
├── server/                         # New Railway-hosted Node.js server
│   ├── index.ts                    # Express + WebSocket entry point
│   ├── SessionManager.ts           # Session code, lifecycle, lookup
│   ├── SimulationSession.ts        # One engine plus connected clients
│   ├── loadScenarios.ts            # Node-compatible scenario loader
│   └── serializeState.ts           # PatientState to network payload
├── shared/
│   └── protocol.ts                 # Shared WebSocket message types
├── engine/                         # Existing pure TypeScript engine
│   └── physiology.ts               # Timer adapter for browser and Node
└── ui/
    ├── App.tsx                     # Role-aware routing
    ├── context/
    │   ├── SimulationContext.tsx    # Local or remote simulation provider
    │   └── SessionContext.tsx       # WebSocket session state
    ├── network/
    │   └── WebSocketClient.ts       # Reconnect and message dispatch
    ├── remote/
    │   └── RemoteWaveformStore.ts   # Local waveform buffers for remote sessions
    ├── pages/
    │   ├── LobbyPage.tsx            # Create and join session flows
    │   ├── TrainerView.tsx          # Monitor plus trainer controls
    │   └── TraineeView.tsx          # Monitor plus interventions
    └── components/
        └── Trainer/
            ├── PhaseTimeline.tsx
            ├── OverridePanel.tsx
            ├── EventInjector.tsx
            └── TraineeRoster.tsx
```

The existing engine-to-UI dependency rule remains in place: `ui/` imports from
`engine/`, but `engine/` never imports from `ui/` or `server/`.

---

## Server model

The Railway service hosts both the built React app and the WebSocket endpoint.
This keeps deployment simple: one service, one origin, and no cross-origin
WebSocket setup.

The server responsibilities are:

1. Serve the Vite production build as static files.
2. Expose a health endpoint for Railway.
3. Accept WebSocket connections on `/ws`.
4. Create sessions with short, human-readable codes.
5. Run one `SimulationEngine` per active session.
6. Broadcast compact state snapshots at a fixed network tick rate.
7. Broadcast events, phase changes, joins, leaves, and terminal state changes
   immediately.
8. Clean up empty or stale sessions.

The server uses in-memory sessions for this phase. Railway must run this service
as a single replica. Horizontal scaling requires sticky WebSocket sessions or an
external session store, and is out of scope for the first implementation.

### Scenario loading in Node

The browser currently loads scenario markdown through Vite's `import.meta.glob`,
which does not work in a plain Node server build. The server must not import the
browser scenario index directly.

Add a Node-compatible loader in `server/loadScenarios.ts` that:

1. Reads markdown files from `scenarios/` at startup.
2. Uses the existing DSL parser and interpreter from `engine/scenarios/dsl/`.
3. Builds a server-side scenario map keyed by scenario ID.
4. Fails startup with a clear error if a scenario is invalid.

The browser can keep using the existing Vite scenario loader. The parser,
schema, predicate evaluator, and interpreter remain shared engine code.

### Session manager

`SessionManager` owns the active sessions map. It creates a six-character code,
stores the matching `SimulationSession`, and routes WebSocket clients to the
correct session.

Session codes must be easy to read aloud and enter manually. Use uppercase
letters and digits, excluding ambiguous characters such as `0`, `O`, `1`, and
`I`.

### Simulation session

`SimulationSession` owns the authoritative engine instance and connected
clients. It tracks one trainer and many trainees.

Each session stores:

- `code`: the public session code.
- `trainerToken`: an opaque token that authorizes trainer reconnects and
  trainer-only commands.
- `scenarioId`: the selected scenario, if one has started.
- `engine`: the authoritative `SimulationEngine`.
- `trainer`: the trainer connection and display name.
- `trainees`: a map of trainee connection IDs to display names.
- `clientTokens`: opaque reconnect tokens for trainee clients.
- `eventLog`: the session event log for reconnecting clients.
- `lastSnapshot`: the latest serialized state payload.
- `trainerOverrides`: active trainer overrides applied after scenario updates.

---

## Engine adaptation

`SimulationEngine` currently uses `requestAnimationFrame`, which is browser-only.
The engine must support both browser and Node runtimes without introducing UI or
server dependencies into `engine/`.

Implement this as constructor injection so tests can use a fake scheduler and
fake clock:

```ts
interface EngineRuntime {
  now: () => number
  scheduleFrame: (callback: (timestamp: number) => void) => unknown
  cancelFrame: (handle: unknown) => void
}
```

The browser runtime wraps `requestAnimationFrame` and `cancelAnimationFrame`.
The Node runtime wraps `setTimeout` and `clearTimeout`. This avoids typing the
frame handle as a browser-only `number` in server builds.

All engine time reads must go through `runtime.now()`, including tick deltas,
pause or resume timing, manual ventilation timing, effect timing, and terminal
freeze timing. Tests can then drive the engine with a fake clock in browser and
server-like runtimes.

The server runs the engine at the existing internal cadence but does not send
every internal state update over the network. It broadcasts snapshots at 10 Hz.

### Scenario runtime metadata and phase control

The current DSL interpreter keeps active phase state inside the scenario
closure. Trainer phase preview and phase forcing require a small explicit API.

Add runtime metadata to interpreted scenarios without exposing internal mutable
state directly:

```ts
interface ScenarioRuntimeInfo {
  currentPhaseId: string | null
  completedPhaseIds: string[]
  phaseEnteredAtSec: number | null
}

interface Scenario {
  // existing fields...
  getRuntimeInfo?: () => ScenarioRuntimeInfo
  forcePhase?: (phaseId: string, elapsedSec: number) => void
  clearForcedPhase?: (elapsedSec: number) => void
}
```

`forcePhase` validates that the phase exists, sets a `forcedPhaseId`, updates
the interpreter's current phase, applies the phase entry snap and baseline on
the next check, resets the phase timer, and emits a server-side trainer event.
While `forcedPhaseId` is set, the interpreter bypasses the normal "last matching
`enter_when` wins" selection rule so the forced phase does not immediately
revert when its predicate is false.

The forced phase remains active until one of these events occurs:

- The trainer forces a different phase.
- The trainer clears the forced phase and returns to automatic selection.
- The forced phase resolves or fails the scenario.
- The session restarts or ends.

Add tests for forcing a phase whose `enter_when` predicate is false, clearing a
forced phase, and resolving or failing from a forced phase. If this API proves
too large for the first implementation, phase preview can ship first and
`advance_phase` can be deferred.

`clearForcedPhase` removes `forcedPhaseId`, returns the interpreter to automatic
phase selection on the next `check`, resets the current phase timer to the clear
timestamp, and emits a server-side trainer event.

### Trainer override hook

Trainer overrides must apply before drift and waveform generation so snapshots
and waveform buffers remain consistent.

Add an engine-level hook for server-owned overrides:

```ts
type ModifierHook = (state: PatientState, elapsedSec: number) => PatientModifier | null
```

`SimulationEngine` calls this hook after scenario modifiers and phase baselines
are applied, but before `applyDrift`, active effects, waveform generation, and
state broadcast. `SimulationSession` owns the active trainer overrides and
returns the appropriate modifier from the hook.

Do not apply trainer overrides from an engine subscriber. Subscribers run after
the tick work and can create mismatches between broadcast state and generated
waveform buffers.

---

## WebSocket protocol

The protocol uses JSON messages with explicit `type` fields. Shared message
types live in `shared/protocol.ts` so the server and client compile against the
same contract.

### Client-to-server messages

Clients send commands to create sessions, join sessions, apply interventions,
and control the simulation.

| Message | Sender | Payload | Purpose |
| --- | --- | --- | --- |
| `create_session` | Trainer | `{ name, scenarioId? }` | Create a session and claim the trainer role. |
| `join_session` | Trainee | `{ sessionCode, name }` | Join an existing session as a trainee. |
| `reconnect` | Any | `{ sessionCode, token }` | Reclaim a trainer or trainee connection. |
| `start_scenario` | Trainer | `{ scenarioId }` | Start or restart the selected scenario. |
| `intervene` | Trainee or trainer | `{ interventionId }` | Apply an intervention to the engine. |
| `update_machine_settings` | Trainee or trainer | `{ settings }` | Change ventilator or anaesthetic machine settings. |
| `set_manual_ventilation` | Trainee or trainer | `{ active }` | Engage or release manual ventilation. |
| `override` | Trainer | `{ mode, values }` | Change vitals or baseline targets. |
| `clear_trainer_overrides` | Trainer | `{}` | Reset trainer-applied vitals and baseline overrides. |
| `advance_phase` | Trainer | `{ phaseId }` | Force the scenario into a phase. |
| `clear_forced_phase` | Trainer | `{}` | Return phase selection to scenario predicates. |
| `inject_event` | Trainer | `{ text, phaseId? }` | Broadcast a trainer-generated event. |
| `pause` | Trainer | `{}` | Pause the engine clock. |
| `resume` | Trainer | `{}` | Resume the engine clock. |
| `end_session` | Trainer | `{}` | End the active session. |

### Server-to-client messages

The server sends state snapshots, events, roster changes, and session lifecycle
messages.

| Message | Recipient | Rate | Purpose |
| --- | --- | --- | --- |
| `session_created` | Trainer | Once | Return the session code, join URL, and trainer token. |
| `session_joined` | Trainee | Once | Confirm the join and return a trainee token. |
| `session_info` | All | On change | Send code, scenario, roster, role, and phase. |
| `event_log_snapshot` | Target client | On join/reconnect | Send existing event history for resync. |
| `scenario_metadata` | Trainer | On scenario load | Send trainer-only phase definitions. |
| `state` | All | 10 Hz | Send compact vitals and rhythm state. |
| `event` | All | Immediate | Send scenario, intervention, or trainer event. |
| `phase_change` | All | Immediate | Send the current scenario phase. |
| `intervention_log` | Trainer | Immediate | Show who applied an intervention. |
| `resolved` | All | Once | Announce successful completion. |
| `failed` | All | Once | Announce failed completion. |
| `error` | Target client | Immediate | Explain rejected commands or invalid sessions. |

### State snapshot payload

The `state` message contains only data needed to display numerics and generate
waveforms locally. It does not include full waveform buffers.

```ts
interface RemotePatientSnapshot {
  elapsedSeconds: number
  phase: 'idle' | 'running' | 'resolved' | 'failed'
  scenarioId: string | null
  currentPhaseId: string | null
  paused: boolean
  patient: {
    hr: number
    spo2: number
    etco2: number
    rr: number
    temp: number
    nibp: { sys: number; dia: number; map: number }
    ecgRhythm: string
    capnographyShape: string
    manualVentilationActive: boolean
    tubePosition: string
    fio2: number
    vt: number
    peep: number
    gasFlow: number
    sevoflurane: number
    ventilationMode: string
    art: { sys: number; dia: number; map: number } | null
    cvp: number | null
    bis: number | null
  }
}
```

This payload is intentionally compact. At roughly 150 to 500 bytes per JSON
snapshot and 10 snapshots per second, a classroom session remains low bandwidth.

### Trainer-only scenario metadata

The trainer phase timeline needs scenario definitions, not only runtime phase
state. The server sends `scenario_metadata` only to the trainer after session
creation and whenever the selected scenario changes.

```ts
interface ScenarioMetadataMessage {
  type: 'scenario_metadata'
  scenarioId: string
  label: string
  phases: Array<{
    id: string
    enterWhen: string | null
    baseline: Record<string, unknown> | null
    snap: Record<string, unknown> | null
    resolveWhen: string | null
    failWhen: string | null
    events: Array<{ atSec: number; text: string }>
  }>
}
```

This data comes from the parsed `ScenarioSpec` used by the Node scenario loader.
The server must not send future phase metadata to trainees.

---

## Client sync model

The browser receives remote state and exposes it through the same shape that the
monitor already consumes. This keeps the UI changes focused on routing and
role-specific panels.

Prefer a new `RemoteSimulationContext` for collaboration instead of overloading
the existing local `SimulationContext` in the first implementation. This keeps
the current solo flow stable and gives remote mode an explicit place to combine
network state, `RemoteWaveformStore`, event logs, phase metadata, and command
senders. Shared monitor-facing types can be extracted only where needed.

The client sync flow is:

1. Connect to `/ws`.
2. Send `create_session` or `join_session`.
3. Store session metadata, role, roster, event log, and latest patient snapshot.
4. Build a local `PatientState`-like object from the latest snapshot.
5. Update a local `RemoteWaveformStore` from the latest vitals and rhythm.
6. Render the existing `Monitor` component from the local remote state.

The current app already separates low-frequency React numerics from high-
frequency canvas rendering. The remote implementation keeps that pattern:

- Network snapshots arrive at 10 Hz.
- React numerics update from the latest snapshot.
- Canvas waveform loops keep running at 60 fps on each client.
- Waveform samples are generated locally from `hr`, `spo2`, `etco2`, `rr`,
  `ecgRhythm`, `capnographyShape`, `manualVentilationActive`, and `art`.

### Remote waveform source

The current `Monitor` passes `engine` into waveform canvas components, and those
canvases read `engine.state` buffers directly on each animation frame. A remote
snapshot alone is not enough to reuse `Monitor` unchanged.

Add a small `RemoteWaveformStore` that provides the same buffer-bearing state
surface the canvases need:

```ts
interface WaveformSource {
  state: Pick<PatientState,
    | 'ecgBuffer'
    | 'spo2Buffer'
    | 'etco2Buffer'
    | 'respBuffer'
    | 'artBuffer'
    | 'bufferWritePos'
  >
}
```

Then either:

1. Update `MonitorBand`, `ECGCanvas`, and `SimpleWaveformCanvas` to accept a
   `WaveformSource` instead of a full `SimulationEngine`; or
2. Provide a remote adapter object that implements the minimal `engine.state`
   surface the canvases currently read.

The first option is preferred because it makes the dependency explicit and keeps
canvas rendering decoupled from engine control methods.

---

## Trainer experience

The trainer view uses the existing monitor component for the monitor area. The
monitor preview must replicate the trainee monitor, including the IntelliVue
frame, status bar, waveform bands, right-side numeric tiles, NIBP panel, and
soft key row.

The trainer view adds role-specific controls beside the monitor.

### Top bar

The top bar shows session-level controls and status.

- Session code and QR code.
- Copy invite link button.
- Connected trainee names and count.
- Pause or resume button.
- End session button.

### Phase timeline

The phase timeline shows the scenario's phase machine in trainer-readable form.
It must show the current phase, completed phases, and upcoming phases.

Each phase card includes:

- Phase label or ID.
- Current status, such as active, completed, or pending.
- Entry predicate, if present.
- Baseline values or important snap values.
- An **Advance now** action for trainer-controlled phase transition.

### Override panel

The override panel gives the trainer direct control over patient state.

It supports two override modes:

- **Set now:** Immediately sets a value, such as `hr = 130`. Scenario drift may
  later pull the value back toward its baseline unless an active trainer target
  also applies.
- **Set target:** Updates `state.driftBaseline` so the patient smoothly trends
  toward the selected value.

The first implementation must include controls for:

- Heart rate.
- SpO2.
- ETCO2.
- Respiratory rate.
- Temperature.
- NIBP systolic and diastolic.
- ECG rhythm.

The session stores trainer overrides separately from scenario state. On each
engine tick, the session applies trainer overrides after scenario modifiers and
scenario baseline updates. This gives trainer controls clear precedence without
rewriting scenario definitions.

The panel also includes **Reset to scenario** to clear trainer-applied values and
baseline targets, returning control to the active scenario.

### Event injector

The event injector lets the trainer broadcast a message to all trainees. The
event appears in the same event log as scenario and intervention events.

The injector includes:

- Event text input.
- Optional phase association.
- **Preview** action for the trainer.
- **Inject now** action to broadcast the event.

### Intervention log

The trainer sees who applied each intervention. For example:

```text
[+42s] John applied Adrenaline 10 mcg IV
```

This log is trainer-only. Trainees see the existing event log behavior without
trainer-only attribution unless product design later decides otherwise.

---

## Trainee experience

The trainee flow must stay simple and focused on the simulation.

The trainee starts from a join form:

1. Enter a display name.
2. Enter a session code or scan a QR code.
3. Join the active session.

After joining, the trainee sees:

- The existing monitor.
- Intervention controls.
- Event log.
- Scenario end status and debrief when the session resolves or fails.

The trainee does not see future phases, trainer overrides, trainer-only logs, or
scenario authoring controls.

---

## Session lifecycle

The normal session lifecycle is create, join, start, run, end, and cleanup.

```text
Trainer creates session
  -> Server returns session code, invite URL, and trainer token
  -> Trainer shares code or QR code
  -> Trainees join with display names
  -> Trainer starts scenario
  -> Server broadcasts state, events, phase changes, and roster updates
  -> Trainer and trainees send interventions and controls
  -> Scenario resolves, fails, or trainer ends session
  -> Server freezes engine and cleans up the session after a timeout
```

Reconnect behavior must be explicit:

- If a trainee reconnects, the server sends the latest state, roster, event log,
  and phase.
- If the trainer reconnects, the server lets the trainer reclaim control by
  using the opaque `trainerToken` issued at session creation.
- If the trainer is absent, trainees remain connected but cannot start, pause,
  resume, advance phases, inject events, or end the session.
- Empty sessions are removed after a short timeout.

Concrete operational limits for the first implementation:

- Maximum trainees per session: 30.
- Maximum active sessions per process: 50.
- WebSocket heartbeat interval: 20 seconds.
- Client considered disconnected after: 45 seconds without pong.
- Empty lobby cleanup: 10 minutes.
- Terminal session cleanup: 10 minutes after resolve, fail, or end.
- Trainer disconnect grace period: 10 minutes.
- Maximum client message size: 16 KB.
- Maximum injected event text length: 300 characters.

---

## Railway deployment

Railway hosts a single Node.js service. The service builds the React client and
server code, then serves both from one process.

Recommended commands:

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:client\" \"npm run dev:server\"",
    "dev:client": "vite",
    "dev:server": "tsx watch server/index.ts",
    "build": "tsc -b && vite build && tsc -p tsconfig.server.json",
    "start": "node dist/server/index.js"
  }
}
```

The production server must:

- Read `process.env.PORT` for Railway.
- Serve static assets from `dist/`.
- Attach WebSocket handling to the same HTTP server.
- Return `200` from `/health`.

---

## Error handling

The user experience must make common failure modes clear.

| Failure | Server behavior | Client behavior |
| --- | --- | --- |
| Invalid session code | Send `error` with `session_not_found`. | Show a friendly retry message. |
| Duplicate or blank name | Accept but normalize display. | Show the resulting display name. |
| Trainee sends trainer command | Reject with `forbidden`. | No visible change except optional toast. |
| Trainer disconnects | Keep session alive temporarily. | Show trainees that trainer is disconnected. |
| Server restarts | Sessions are lost in this phase. | Show disconnected state and return to lobby. |
| WebSocket drops | Stop sending commands. | Reconnect with backoff and resync state. |
| Malformed JSON | Reject with `bad_json`. | Show a reconnect or retry message. |
| Unknown message type | Send `unknown_message_type`. | Keep the socket open. |
| Invalid payload shape | Send `invalid_payload`. | Show a short validation message. |
| Invalid intervention ID | Send `unknown_intervention`. | Keep controls enabled. |
| Command before scenario start | Send `scenario_not_started`. | Show waiting state. |
| Command after terminal state | Send `session_terminal`. | Show debrief or session ended state. |

All client messages must be validated at runtime before handling. Use Zod or a
small hand-written validator shared with `shared/protocol.ts`. Trainer-only
commands must verify the trainer token server-side even if the client UI hides
those actions from trainees.

---

## Testing strategy

The implementation must preserve the existing engine test suite and add focused
tests for the new collaboration layer.

Recommended coverage:

- Unit tests for session code generation and session lookup.
- Unit tests for protocol message validation.
- Unit tests for `serializeState` so snapshots include all required monitor
  fields and exclude waveform buffers.
- Unit tests for trainer-only command authorization.
- Unit tests for trainer and trainee reconnect tokens.
- Unit tests for scheduler injection, pause, resume, terminal freeze, and tick
  clamping with a fake clock.
- Unit tests for `RemoteWaveformStore` buffer generation.
- Unit tests for heartbeat timeout and stale session cleanup.
- Unit tests for malformed JSON, unknown message types, invalid payloads, and
  oversized messages.
- Integration tests for one trainer and multiple trainees joining a session.
- Integration tests for intervention attribution.
- Railway-style production start smoke test using `npm run build` followed by
  `npm run start` against `/health`.
- Existing engine tests through `npm run test`.
- Type checking through `npm run typecheck`.
- Production build through `npm run build`.

UI tests are not currently part of the project. If this feature grows beyond a
prototype, add browser-level tests for create session, join session, intervention
application, and reconnect behavior.

---

## Open implementation questions

These questions can be resolved during implementation planning.

- Whether QR generation uses a small client-side dependency or a server-generated
  SVG endpoint.
- Whether local single-user simulation remains the default landing flow or moves
  behind a **Practice solo** option.

---

## Next steps

After this spec is approved, write an implementation plan that decomposes the
work into incremental, testable phases:

1. Add the server build and WebSocket skeleton.
2. Adapt the engine scheduler for Node.
3. Add session creation and join flows.
4. Add remote state serialization and client sync.
5. Add trainer panels.
6. Add reconnect and error handling.
7. Validate with tests, type checking, and a production build.
