# Trainer-trainee reliability and polish implementation plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development
> (if subagents available) or superpowers:executing-plans to implement this
> plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make trainer-trainee mode reliable and polished across session flow,
remote waveforms, and trainee phone controls.

**Architecture:** Keep the current authoritative WebSocket server and thin
remote clients. Block active-session commands while disconnected, harden remote
waveform reconstruction around elapsed-time ordering, centralize canvas sizing,
and add a trainee-first bottom action tray on phone-sized screens.

**Tech Stack:** Vite, React 19, TypeScript, Vitest, Node.js, Express, `ws`, CSS.

---

## Reference documents

Read these files before implementation. They define the approved scope and the
current collaboration architecture.

- Spec: `docs/superpowers/specs/2026-05-23-trainer-trainee-polish-design.md`
- Existing collaboration spec:
  `docs/superpowers/specs/2026-05-20-trainer-trainee-collaboration-design.md`
- Existing bugfix plan: `.opencode/plans/2026-05-20-trainer-trainee-bugfixes.md`
- Repository guidance: `CLAUDE.md`

## File structure

This plan changes existing files and adds focused helper files. Do not refactor
unrelated UI or engine code.

**Create files:**

- `ui/components/Monitor/canvasSizing.ts`: Shared canvas DPR and resize helper.
- `ui/components/Monitor/canvasSizing.test.ts`: Unit tests for DPR sizing and
  transform reset behavior.

**Modify files:**

- `ui/network/WebSocketClient.ts`: Add active-session command queue policy and
  expose whether messages were sent.
- `ui/network/WebSocketClient.test.ts`: Cover allowed queued session messages and
  blocked active commands while disconnected.
- `server/index.test.ts`: Audit and, if needed, add WebSocket reconnect coverage
  for token-based same-page reconnect behavior.
- `server/SimulationSession.test.ts`: Audit and, if needed, add coverage for
  session terminal state and reconnect snapshot behavior.
- `server/protocolValidation.test.ts`: Audit existing validation coverage for
  command shapes. Change only if new payload behavior is introduced.
- `ui/context/RemoteSimulationContext.tsx`: Use send result to block stale
  commands, surface disconnected state to bridge consumers, and prevent manual
  ventilation replay.
- `ui/context/SimulationBridge.tsx`: Add remote connection state and command
  availability to the shared bridge.
- `ui/context/SimulationContext.tsx`: Set local bridge command availability to
  always available.
- `ui/components/Trainer/OverridePanel.tsx`: Disable trainer override commands
  while disconnected.
- `ui/components/Trainer/PhaseTimeline.tsx`: Disable phase commands while
  disconnected.
- `ui/components/Trainer/EventInjector.tsx`: Disable event broadcast while
  disconnected.
- `ui/remote/RemoteWaveformStore.ts`: Drop stale snapshots, avoid equal-time
  waveform writes, cap large elapsed gaps, and preserve buffers after reconnect.
- `ui/remote/RemoteWaveformStore.test.ts`: Cover waveform ordering, equal-time
  snapshots, capped gaps, and prefill behavior.
- `ui/components/Monitor/ECGCanvas.tsx`: Use shared canvas sizing helper.
- `ui/components/Monitor/SimpleWaveformCanvas.tsx`: Use shared canvas sizing
  helper.
- `ui/pages/TraineeView.tsx`: Add trainee shell classes and mobile action tray
  structure.
- `ui/components/RightPanel/RightPanel.tsx`: Support tray mode, touch-friendly
  class names, event-log affordance, and disabled state while disconnected.
- `ui/index.css`: Add responsive trainee tray, touch targets, scroll behavior,
  and high-DPR-safe layout refinements.

**Verification commands:**

- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

---

## Chunk 0: Bug-bash and failing-layer audit

This chunk captures the required reproduce-first pass. Do this before changing
behavior. The output is a short audit note in the plan or implementation notes
that identifies which flows already have coverage and which flows need fixes.

### Task 0: Reproduce the collaboration flow matrix

**Files:**

- Read: `server/index.test.ts`
- Read: `server/SimulationSession.test.ts`
- Read: `server/protocolValidation.test.ts`
- Read: `ui/network/WebSocketClient.test.ts`
- Read: `ui/remote/RemoteWaveformStore.test.ts`
- Verify: running app if practical with `npm run dev:full`

- [ ] **Step 1: Run the existing automated collaboration tests**

  Run: `npx vitest run server/index.test.ts server/SimulationSession.test.ts server/protocolValidation.test.ts ui/network/WebSocketClient.test.ts ui/remote/RemoteWaveformStore.test.ts`

  Expected: PASS before behavior changes. If this fails, stop and diagnose the
  existing failure before starting Chunk 1.

- [ ] **Step 2: Audit server and protocol coverage**

  Confirm existing tests cover these server behaviors:

  - Create session and trainer token.
  - Trainee join and initial snapshot.
  - Token reconnect and resync.
  - Trainer-only command rejection from trainees.
  - Terminal phase broadcast and snapshot resync.
  - Protocol validation for all declared command shapes.

  If a behavior is missing, add the smallest failing test in the matching file
  before implementing any product fix:

  - `server/index.test.ts` for WebSocket routing and reconnect through real
    sockets.
  - `server/SimulationSession.test.ts` for session state, authorization, and
    snapshot behavior.
  - `server/protocolValidation.test.ts` only for payload validation gaps.

- [ ] **Step 3: Manually reproduce the session-flow matrix if the stack starts**

  Run: `npm run dev:full`

  Check these flows and record whether the failing layer is UI, WebSocket client,
  protocol validation, server session, engine state, or remote rendering:

  - Trainer creates a session.
  - Trainee joins by manual code entry.
  - Trainee joins from a QR invite URL.
  - Trainer and trainee disconnect and reconnect.
  - Trainer pauses and resumes a running scenario.
  - Trainee applies interventions.
  - Trainee changes machine settings.
  - Trainee uses manual ventilation.
  - Trainer applies a vitals override.
  - Trainer forces or clears a scenario phase.
  - Trainer injects an event.
  - Trainer ends a session.

  Expected: known defects are mapped to a failing layer. Do not fix multiple
  layers at once.

- [ ] **Step 4: Add focused tests for discovered deterministic failures**

  If the audit finds a deterministic server, protocol, WebSocket, or waveform
  failure, add a focused failing test before implementation. If the issue is
  visual or touch-only, add it to the manual acceptance checklist for Chunk 4.

---

## Chunk 1: Active-session command safety

This chunk prevents stale clinical or trainer commands from replaying after a
disconnect. It implements the approved policy: only initial session-establishing
messages can queue while the socket is not open.

### Task 1: Add WebSocket send policy tests

**Files:**

- Modify: `ui/network/WebSocketClient.test.ts`
- Modify: `ui/network/WebSocketClient.ts`

- [ ] **Step 1: Write a failing test for queued session-establishment commands**

  Add this test to `ui/network/WebSocketClient.test.ts`:

  ```ts
  it('queues only session-establishment messages before the socket opens', () => {
    const client = new WebSocketClient({
      url: 'ws://test/ws',
      socketFactory: url => new FakeSocket(url) as unknown as WebSocket,
    })

    client.connect()
    const socket = FakeSocket.latest
    if (!socket) throw new Error('missing socket')

    expect(client.send({ type: 'join_session', sessionCode: '7K3M9P', name: 'John' })).toBe(true)
    expect(client.send({ type: 'intervene', interventionId: 'adrenaline-1' })).toBe(false)

    socket.onopen?.()

    expect(socket.sent).toEqual([
      JSON.stringify({ type: 'join_session', sessionCode: '7K3M9P', name: 'John' } satisfies ClientMessage),
    ])
  })
  ```

- [ ] **Step 2: Run the focused test and confirm it fails**

  Run: `npx vitest run ui/network/WebSocketClient.test.ts -t "queues only session-establishment"`

  Expected: FAIL because `send` currently returns `void` and queues all messages.

- [ ] **Step 3: Change `send` to return whether the message was accepted**

  In `ui/network/WebSocketClient.ts`, update the signature to:

  ```ts
  send(message: ClientMessage): boolean
  ```

  Add this helper near the top of the file:

  ```ts
  const QUEUEABLE_WHILE_CONNECTING = new Set<ClientMessage['type']>([
    'create_session',
    'join_session',
    'reconnect',
  ])
  ```

  Update `send` to return `false` for non-queueable messages while the socket is
  not open:

  ```ts
  send(message: ClientMessage): boolean {
    if (!this.socket || !this.isOpen) {
      if (!QUEUEABLE_WHILE_CONNECTING.has(message.type)) return false
      this.queuedMessages.push(message)
      return true
    }
    this.socket.send(JSON.stringify(message))
    return true
  }
  ```

- [ ] **Step 4: Run the focused test and confirm it passes**

  Run: `npx vitest run ui/network/WebSocketClient.test.ts -t "queues only session-establishment"`

  Expected: PASS.

- [ ] **Step 5: Run all WebSocket client tests**

  Run: `npx vitest run ui/network/WebSocketClient.test.ts`

  Expected: PASS.

### Task 2: Surface disconnected command blocking in the remote bridge

**Files:**

- Modify: `ui/context/SimulationBridge.tsx`
- Modify: `ui/context/SimulationContext.tsx`
- Modify: `ui/context/RemoteSimulationContext.tsx`
- Modify: `ui/components/RightPanel/RightPanel.tsx`
- Modify: `ui/pages/TrainerView.tsx`
- Modify: `ui/pages/TraineeView.tsx`
- Modify: `ui/components/Trainer/OverridePanel.tsx`
- Modify: `ui/components/Trainer/PhaseTimeline.tsx`
- Modify: `ui/components/Trainer/EventInjector.tsx`

- [ ] **Step 1: Extend the bridge value**

  In `ui/context/SimulationBridge.tsx`, add these fields to
  `SimulationBridgeValue`:

  ```ts
  connectionStatus?: 'connecting' | 'connected' | 'disconnected'
  commandsAvailable: boolean
  ```

  In `ui/context/SimulationContext.tsx`, update the local `bridgeValue` to set:

  ```ts
  connectionStatus: 'connected',
  commandsAvailable: true,
  ```

- [ ] **Step 2: Make remote context sends return a boolean**

  In `ui/context/RemoteSimulationContext.tsx`, update
  `RemoteSimulationContextValue`:

  ```ts
  send: (message: ClientMessage) => boolean
  commandsAvailable: boolean
  ```

  Update the callback:

  ```ts
  const send = useCallback((message: ClientMessage) => client.send(message), [client])
  const commandsAvailable = connectionStatus === 'connected'
  ```

  Include `commandsAvailable` in the provider value.

- [ ] **Step 3: Update remote bridge senders to respect availability**

  Update the `bridgeValue` fields:

  ```ts
  connectionStatus,
  commandsAvailable,
  applyIntervention: id => { if (commandsAvailable) send({ type: 'intervene', interventionId: id }) },
  updateMachineSettings: settings => { if (commandsAvailable) send({ type: 'update_machine_settings', settings }) },
  setManualVentilation: active => { if (commandsAvailable) send({ type: 'set_manual_ventilation', active }) },
  togglePause: () => { if (commandsAvailable) send({ type: 'pause' }) },
  ```

  Include `commandsAvailable`, `connectionStatus`, and `send` in the relevant
  memo dependencies.

- [ ] **Step 4: Disable trainee controls while disconnected**

  In `ui/components/RightPanel/RightPanel.tsx`, destructure `commandsAvailable`
  from `useSimulationBridge()`. Treat every intervention and machine control as
  disabled when `commandsAvailable === false`.

  For manual ventilation, add this guard to pointer handlers:

  ```tsx
  if (!commandsAvailable) return
  ```

  Add a small disabled notice above the active tab content when commands are not
  available:

  ```tsx
  {!commandsAvailable && (
    <div className="command-unavailable">Reconnecting. Actions are paused.</div>
  )}
  ```

- [ ] **Step 4: Disable trainer topbar controls while disconnected**

  In `ui/pages/TrainerView.tsx`, derive:

  ```ts
  const commandsAvailable = connectionStatus === 'connected'
  ```

  Disable pause, resume, and end buttons when `!commandsAvailable`. The copy
  invite button can remain enabled because it does not send a WebSocket command.

- [ ] **Step 5: Disable trainer control panels while disconnected**

  In `ui/components/Trainer/OverridePanel.tsx`, destructure
  `commandsAvailable` from `useRemoteSimulation()`. Disable **Set now**,
  **Set target**, and **Reset to scenario** when commands are unavailable.

  In `ui/components/Trainer/PhaseTimeline.tsx`, destructure
  `commandsAvailable` from `useRemoteSimulation()`. Disable **Advance now** and
  **Return to automatic** buttons when commands are unavailable.

  In `ui/components/Trainer/EventInjector.tsx`, destructure
  `commandsAvailable` from `useRemoteSimulation()`. Disable **Broadcast** when
  `!commandsAvailable || !clean.trim()`. **Preview** can stay enabled because it
  is local.

  Add a shared notice to these panels when commands are unavailable:

  ```tsx
  {!commandsAvailable && (
    <div className="command-unavailable">Reconnecting. Trainer commands are paused.</div>
  )}
  ```

- [ ] **Step 6: Add styles for blocked actions**

  In `ui/index.css`, add:

  ```css
  .command-unavailable {
    margin: 8px;
    padding: 10px 12px;
    border: 1px solid #e6b84f;
    border-radius: 8px;
    background: #fff4ce;
    color: #765800;
    font-size: 13px;
    font-weight: 800;
  }
  ```

- [ ] **Step 7: Run typecheck**

  Run: `npm run typecheck`

  Expected: PASS.

---

## Chunk 2: Remote waveform and canvas crispness

This chunk hardens the monitor path without changing the server protocol. It
uses `elapsedSeconds` as the ordering key and centralizes DPR canvas sizing.

### Task 3: Harden remote waveform reconstruction

**Files:**

- Modify: `ui/remote/RemoteWaveformStore.ts`
- Modify: `ui/remote/RemoteWaveformStore.test.ts`

- [ ] **Step 1: Write failing tests for ordering and equal-time snapshots**

  Add tests to `ui/remote/RemoteWaveformStore.test.ts`:

  ```ts
  it('ignores older snapshots for waveform writes', () => {
    const store = new RemoteWaveformStore()
    store.writeSnapshot(snapshot({ elapsedSeconds: 5 }))
    const position = store.source.state.bufferWritePos

    store.writeSnapshot(snapshot({ elapsedSeconds: 4 }))

    expect(store.source.state.bufferWritePos).toBe(position)
  })

  it('does not write waveform samples for equal-time snapshots', () => {
    const store = new RemoteWaveformStore()
    store.writeSnapshot(snapshot({ elapsedSeconds: 5 }))
    const position = store.source.state.bufferWritePos

    store.writeSnapshot(snapshot({ elapsedSeconds: 5, hr: 120 }))

    expect(store.source.state.bufferWritePos).toBe(position)
  })
  ```

- [ ] **Step 2: Write a failing test for large gap capping**

  Add:

  ```ts
  it('caps sample writes after a large elapsed gap', () => {
    const store = new RemoteWaveformStore()
    store.writeSnapshot(snapshot({ elapsedSeconds: 1 }))
    const position = store.source.state.bufferWritePos

    store.writeSnapshot(snapshot({ elapsedSeconds: 20 }))

    const advanced = (store.source.state.bufferWritePos - position + BUFFER_SIZE) % BUFFER_SIZE
    expect(advanced).toBeLessThanOrEqual(60 * SAMPLES_PER_TICK)
  })
  ```

- [ ] **Step 3: Run the focused waveform tests and confirm failures**

  Run: `npx vitest run ui/remote/RemoteWaveformStore.test.ts`

  Expected: FAIL on the new ordering and gap-cap tests.

- [ ] **Step 4: Implement snapshot ordering and gap cap**

  In `ui/remote/RemoteWaveformStore.ts`, add constants:

  ```ts
  const MAX_REMOTE_GAP_SECONDS = 0.5
  ```

  Update `writeSnapshot` so it returns before writing only when
  `snapshot.elapsedSeconds < this.lastElapsedSeconds`. For equal-time snapshots
  with no `requestedSampleCount`, skip waveform sample generation but still let
  `RemoteSimulationContext` apply the incoming snapshot to React state. Do not
  make `RemoteWaveformStore` the owner of numeric state.

  Clamp the elapsed delta used for sample generation:

  ```ts
  const elapsedDelta = this.lastElapsedSeconds === null
    ? 0
    : Math.max(0, snapshot.elapsedSeconds - this.lastElapsedSeconds)
  const generationDelta = Math.min(elapsedDelta, MAX_REMOTE_GAP_SECONDS)
  const sampleCount = requestedSampleCount ?? Math.max(2, Math.round(generationDelta * REMOTE_SAMPLE_RATE))
  ```

  Ensure equal-time snapshots do not advance buffers. Keep `lastElapsedSeconds`
  unchanged when the value is equal because it is already current.

- [ ] **Step 5: Run waveform tests**

  Run: `npx vitest run ui/remote/RemoteWaveformStore.test.ts`

  Expected: PASS.

### Task 4: Centralize canvas DPR sizing

**Files:**

- Create: `ui/components/Monitor/canvasSizing.ts`
- Create: `ui/components/Monitor/canvasSizing.test.ts`
- Modify: `ui/components/Monitor/ECGCanvas.tsx`
- Modify: `ui/components/Monitor/SimpleWaveformCanvas.tsx`

- [ ] **Step 1: Write tests for canvas sizing helper**

  Create `ui/components/Monitor/canvasSizing.test.ts`:

  ```ts
  import { describe, expect, it, vi } from 'vitest'
  import { ensureCanvasSize } from './canvasSizing'

  describe('ensureCanvasSize', () => {
    it('sizes backing canvas to css pixels times dpr and resets transform', () => {
      const resetTransform = vi.fn()
      const setTransform = vi.fn()
      const canvas = {
        clientWidth: 200,
        clientHeight: 100,
        width: 0,
        height: 0,
      } as HTMLCanvasElement
      const ctx = { canvas, resetTransform, setTransform } as unknown as CanvasRenderingContext2D

      const size = ensureCanvasSize(ctx, 2)

      expect(canvas.width).toBe(400)
      expect(canvas.height).toBe(200)
      expect(resetTransform).toHaveBeenCalled()
      expect(setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0)
      expect(size).toEqual({ width: 200, height: 100, dpr: 2 })
    })
  })
  ```

- [ ] **Step 2: Run the helper test and confirm it fails**

  Run: `npx vitest run ui/components/Monitor/canvasSizing.test.ts`

  Expected: FAIL because the file does not exist.

- [ ] **Step 3: Create the helper**

  Create `ui/components/Monitor/canvasSizing.ts`:

  ```ts
  export interface CanvasSize {
    width: number
    height: number
    dpr: number
  }

  export function ensureCanvasSize(
    ctx: CanvasRenderingContext2D,
    dpr = window.devicePixelRatio || 1,
  ): CanvasSize {
    const width = ctx.canvas.clientWidth
    const height = ctx.canvas.clientHeight
    const backingWidth = Math.max(1, Math.round(width * dpr))
    const backingHeight = Math.max(1, Math.round(height * dpr))

    if (ctx.canvas.width !== backingWidth || ctx.canvas.height !== backingHeight) {
      ctx.canvas.width = backingWidth
      ctx.canvas.height = backingHeight
    }

    if ('resetTransform' in ctx) ctx.resetTransform()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    return { width, height, dpr }
  }
  ```

- [ ] **Step 4: Update waveform canvases to use the helper**

  In `ECGCanvas.tsx` and `SimpleWaveformCanvas.tsx`, replace duplicated DPR
  code with:

  ```ts
  const { width: w, height: h } = ensureCanvasSize(ctx)
  ```

  Import `ensureCanvasSize` from `./canvasSizing`.

- [ ] **Step 5: Run monitor and waveform tests**

  Run: `npx vitest run ui/components/Monitor/canvasSizing.test.ts ui/remote/RemoteWaveformStore.test.ts`

  Expected: PASS.

---

## Chunk 3: Trainee phone action tray

This chunk adds phone-first controls without making the trainer view phone-first.
It reuses `RightPanel` content and changes the shell around it at small widths.
Phone widths below `700px` use the collapsible tray. Phone landscape also uses
the tray when the viewport is short, defined as `max-height: 480px` and
`max-width: 899px`. Tablet portrait from `700px` to `1023px` keeps controls
below the monitor as a persistent bottom panel so the monitor remains wider than
it would with a side panel. Desktop and large tablet landscape at `1024px` and
wider keep the side panel.

### Task 5: Add trainee tray structure and tablet panel behavior

**Files:**

- Modify: `ui/pages/TraineeView.tsx`
- Modify: `ui/components/RightPanel/RightPanel.tsx`
- Modify: `ui/index.css`

- [ ] **Step 1: Add tray state to trainee view**

  In `ui/pages/TraineeView.tsx`, import `useState` and add:

  ```ts
  const [trayOpen, setTrayOpen] = useState(false)
  ```

  Update the root element class:

  ```tsx
  <div className={`remote-session remote-session--trainee${trayOpen ? ' remote-session--tray-open' : ''}`}>
  ```

- [ ] **Step 2: Wrap the right panel in an action tray**

  Replace the direct `<RightPanel />` with:

  ```tsx
  <aside className="trainee-action-tray" aria-label="Trainee actions">
    <button
      className="trainee-action-tray__handle"
      type="button"
      aria-expanded={trayOpen}
      onClick={() => setTrayOpen(open => !open)}
    >
      <span>{trayOpen ? 'Hide actions' : 'Actions'}</span>
    </button>
    <div className="trainee-action-tray__content">
      <RightPanel compact trayMode />
    </div>
  </aside>
  ```

- [ ] **Step 3: Collapse the tray when the monitor is touched**

  In `ui/pages/TraineeView.tsx`, add `onPointerDown={() => setTrayOpen(false)}`
  to the monitor container. The handler must be on the monitor container, not
  the page root, so controls inside the tray do not close the tray while the user
  is interacting with them.

  The monitor container should look like this:

  ```tsx
  <div className="remote-session__monitor" onPointerDown={() => setTrayOpen(false)}>
    <Monitor />
  </div>
  ```

- [ ] **Step 4: Add optional compact prop to RightPanel**

  In `ui/components/RightPanel/RightPanel.tsx`, update the component signature:

  ```ts
  interface RightPanelProps {
    compact?: boolean
    trayMode?: boolean
  }

  const RightPanel: FC<RightPanelProps> = ({ compact = false, trayMode = false }) => {
  ```

  Apply a class name that keeps event-log behavior tray-specific even when the
  tray is expanded:

  ```tsx
  <div className={[
    'right-panel',
    compact ? 'right-panel--compact' : '',
    trayMode ? 'right-panel--tray' : '',
  ].filter(Boolean).join(' ')}>
  ```

  The props only change CSS and event-log affordance behavior in this chunk.
  They must not remove controls from the DOM.

- [ ] **Step 5: Add tray CSS**

  In `ui/index.css`, add responsive rules:

  ```css
  .trainee-action-tray {
    display: contents;
  }

  .trainee-action-tray__handle {
    display: none;
  }

  @media (max-width: 699px), (max-width: 899px) and (max-height: 480px) {
    .remote-session--trainee {
      min-height: 100dvh;
      height: 100dvh;
    }

    .remote-session--trainee .remote-topbar {
      min-height: 44px;
      padding: 6px 10px;
      gap: 8px;
      font-size: 12px;
    }

    .remote-session--trainee .remote-session__body {
      position: relative;
      flex-direction: column;
      overflow: hidden;
    }

    .remote-session--trainee .remote-session__monitor {
      flex: 1;
      min-height: 0;
      padding: 6px;
    }

    .trainee-action-tray {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 10;
      display: flex;
      flex-direction: column;
      max-height: 55dvh;
      background: #fffdf7;
      border-top: 1px solid #cfc7ba;
      border-radius: 18px 18px 0 0;
      box-shadow: 0 -12px 28px rgba(0, 0, 0, 0.28);
      transform: translateY(calc(100% - 64px));
      transition: transform 0.18s ease;
    }

    .remote-session--tray-open .trainee-action-tray {
      transform: translateY(0);
    }

    .trainee-action-tray__handle {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 64px;
      border: 0;
      background: #1d83a6;
      color: #fff;
      font-size: 16px;
      font-weight: 900;
    }

    .trainee-action-tray__content {
      min-height: 0;
      overflow: hidden;
    }

    .remote-session--trainee .right-panel {
      width: 100%;
      height: calc(55dvh - 64px);
      min-width: 0;
      border-left: 0;
    }
  }
  ```

  Add tablet-specific behavior after the phone rule. Exclude short phone
  landscape viewports so they keep the tray:

  ```css
  @media (min-width: 700px) and (max-width: 1023px) and (min-height: 481px) {
    .remote-session--trainee .remote-session__body {
      flex-direction: column;
    }

    .remote-session--trainee .remote-session__monitor {
      min-height: 45dvh;
    }

    .remote-session--trainee .right-panel {
      width: 100%;
      max-height: 42dvh;
      min-width: 0;
      border-left: 0;
      border-top: 1px solid #e0ddd5;
    }
  }
  ```

- [ ] **Step 6: Run typecheck**

  Run: `npm run typecheck`

  Expected: PASS.

### Task 6: Make trainee controls touch-friendly and move events behind an affordance

**Files:**

- Modify: `ui/components/RightPanel/RightPanel.tsx`
- Modify: `ui/index.css`

- [ ] **Step 1: Add event log collapsed state for tray and compact mode**

  In `RightPanel.tsx`, add state near the active tab state:

  ```ts
  const [eventsOpen, setEventsOpen] = useState(false)
  ```

  Wrap the event log section in a classed container:

  ```tsx
  <div className={(compact || trayMode) && !eventsOpen ? 'right-panel__event-log right-panel__event-log--collapsed' : 'right-panel__event-log'}>
  ```

  Replace the static **Event Log** header with a button when `compact || trayMode`
  is true:

  ```tsx
  <button
    className="right-panel__events-toggle"
    type="button"
    onClick={() => setEventsOpen(open => !open)}
  >
    Events {eventLog.length > 0 ? `(${eventLog.length})` : ''}
  </button>
  ```

  In non-compact, non-tray mode, keep the existing event log visible by default.
  In tray mode, keep the log behind the **Events** affordance even when the tray
  is expanded so urgent actions stay first.

- [ ] **Step 2: Replace inline tab styles with class names**

  In `RightPanel.tsx`, replace the tab wrapper inline style with:

  ```tsx
  <div className="right-panel__tabs">
  ```

  Replace each tab button inline style with class names:

  ```tsx
  className={activeTab === tab.id ? 'right-panel__tab right-panel__tab--active' : 'right-panel__tab'}
  ```

- [ ] **Step 3: Replace intervention grid inline styles with class names**

  Replace the intervention grid wrapper inline style with:

  ```tsx
  <div className="right-panel__action-grid">
  ```

  For non-drug buttons, use a class name instead of inline style:

  ```tsx
  className={activeTab === 'drug' ? 'drug-action-button' : 'right-panel__action-button'}
  ```

  Keep minimal dynamic inline style only for opacity if needed, or prefer the
  disabled attribute and CSS.

- [ ] **Step 4: Add touch-target and event-log CSS**

  In `ui/index.css`, add:

  ```css
  .right-panel__tabs {
    display: flex;
    border-bottom: 1px solid #e0ddd5;
    background: #fafafa;
  }

  .right-panel__tab {
    flex: 1;
    min-height: 44px;
    padding: 12px 6px;
    border: 0;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: #777;
    cursor: pointer;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .right-panel__tab--active {
    border-bottom-color: #1a5276;
    background: #fff;
    color: #1a5276;
  }

  .right-panel__action-grid {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    align-content: start;
  }

  .right-panel__action-button {
    min-height: 56px;
    padding: 14px 16px;
    border: 1px solid #e0ddd5;
    border-radius: 8px;
    background: #fafafa;
    color: #2c2c2c;
    cursor: pointer;
    font-size: 15px;
    line-height: 1.35;
    text-align: left;
  }

  .right-panel__action-button:disabled,
  .drug-action-button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .right-panel__event-log {
    border-top: 1px solid #e0ddd5;
    display: flex;
    flex-direction: column;
    max-height: 30%;
  }

  .right-panel__events-toggle {
    min-height: 44px;
    border: 0;
    border-bottom: 1px solid #ecece5;
    background: #fafafa;
    color: #57636a;
    cursor: pointer;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .right-panel__event-log--collapsed {
    max-height: 44px;
    overflow: hidden;
  }

  @media (max-width: 699px) {
    .right-panel__tab {
      min-height: 52px;
      font-size: 12px;
    }

    .right-panel__action-grid {
      grid-template-columns: 1fr;
      gap: 10px;
      padding: 10px;
    }

    .drug-action-button,
    .right-panel__action-button,
    .machine-mode__button,
    .machine-control,
    .bag-control {
      min-height: 52px;
    }

    .right-panel__event-log {
      max-height: 34dvh;
    }
  }
  ```

- [ ] **Step 5: Remove hover-only behavior from non-drug buttons**

  Delete the `onMouseEnter` and `onMouseLeave` handlers from non-drug action
  buttons in `RightPanel.tsx`. Use CSS `:hover` only where useful. Touch devices
  must not depend on hover.

- [ ] **Step 6: Run lint and typecheck**

  Run: `npm run lint`

  Expected: PASS.

  Run: `npm run typecheck`

  Expected: PASS.

---

## Chunk 4: Final verification and manual acceptance

This chunk validates that the implementation meets the approved spec. Do not
claim completion until these checks have been run or explicitly skipped with a
reason.

### Task 7: Automated verification

**Files:**

- Verify: repository-wide tests and build.

- [ ] **Step 1: Run full tests**

  Run: `npm run test`

  Expected: PASS.

- [ ] **Step 2: Run lint**

  Run: `npm run lint`

  Expected: PASS.

- [ ] **Step 3: Run typecheck**

  Run: `npm run typecheck`

  Expected: PASS.

- [ ] **Step 4: Run production build**

  Run: `npm run build`

  Expected: PASS and server bundle emits to `dist/server/index.js`.

### Task 8: Manual acceptance checklist

**Files:**

- Verify: browser UI only.

- [ ] **Step 1: Start the full development stack**

  Run: `npm run dev:full`

  Expected: Vite and the Node server both start without errors.

- [ ] **Step 2: Check desktop trainer and tablet trainee flow**

  Use desktop viewport `1440px` by `900px` for trainer and tablet viewport
  `768px` by `1024px` for trainee. Create a session, join by code, and verify
  roster, phase, event log, monitor, and interventions.

- [ ] **Step 3: Check phone trainee flow**

  Use phone viewport `390px` by `844px`, DPR 3. Join by QR URL or manual code.
  Verify the monitor is readable, the action tray opens and closes, controls are
  reachable, and scroll gestures do not fight nested panels.

- [ ] **Step 4: Check reconnect behavior**

  Disconnect the trainee socket or stop and restart the server. Verify active
  commands are blocked while disconnected and no stale intervention or manual
  ventilation command replays after reconnect.

- [ ] **Step 5: Check waveform stability**

  During reconnect, intervention, machine setting changes, and trainer override,
  verify waveforms stay crisp and do not visibly jump or clear.

- [ ] **Step 6: Check tablet landscape layout**

  Use tablet landscape viewport `1024px` by `768px`, DPR 2. Verify the trainee
  layout uses the large-screen side panel, the monitor remains readable, and the
  controls do not overlap or trap scroll.

- [ ] **Step 7: Check phone landscape layout**

  Use phone landscape viewport `844px` by `390px`, DPR 3. Verify the trainee
  tray can open and close, the monitor remains partially visible when open, and
  controls remain reachable without nested scroll traps.

- [ ] **Step 8: Optional physical phone check**

  If a physical phone is available on the local network, join by QR code and
  repeat the phone trainee flow. This is recommended before demo readiness but
  not required for merging the code.

## Next steps

After all chunks pass, summarize changed files, test results, and any skipped
manual acceptance items. Do not commit unless the user explicitly asks for a
commit.
