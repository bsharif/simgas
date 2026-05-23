# Trainer-trainee reliability and polish design

**Date:** May 23, 2026  
**Status:** Draft  
**Scope:** Improve trainer-trainee reliability, remote monitor sync, and
trainee phone usability.

This spec defines a reliability-first polish pass for SimGas trainer-trainee
mode. The work makes collaborative sessions feel like a professional product by
fixing session-flow bugs first, then tightening waveform rendering and
touch-first trainee controls.

> **Note:** This is a preview feature currently under active development.

## Goals

The polish pass must make trainer-trainee mode trustworthy during mixed-device
simulation sessions. Trainers can use tablet, laptop, or desktop devices.
Trainees can use tablets or phones, with phone support focused on trainee
interaction rather than trainer control.

The work must support these outcomes:

- A trainer can create a session and share a QR code or session code.
- A trainee can join from a tablet or phone and recover from reconnects.
- Session state, roster, phase, event log, and commands stay in sync.
- Remote waveforms render sharply and do not visibly jump after snapshots or
  reconnects.
- Trainee phone controls are easy to reach without covering the monitor for the
  full session.
- Bugs are diagnosed at the failing layer before fixes are implemented.

## Non-goals

This pass is a focused quality pass, not a redesign of the whole product. It
keeps the current collaboration architecture unless debugging proves a boundary
is causing repeated failures.

The following items are out of scope:

- Streaming every waveform sample from the server.
- Making the trainer view fully optimized for phone screens.
- Adding persistent accounts, recordings, analytics, or multi-server session
  storage.
- Replacing the current WebSocket protocol with WebRTC or another transport.
- Redesigning the monitor visual language.

## Product flow

The existing WebSocket trainer-trainee architecture remains the product model.
The server stays authoritative for scenario state, phase, event log, roster,
interventions, machine settings, trainer overrides, and trainer-only commands.

The trainer experience must stay optimized for larger screens. A trainer needs
clear session creation, QR and code sharing, connection status, roster status,
scenario steering controls, vitals override controls, event injection, and
pause/resume or end controls. The trainer view can be usable on tablets and
desktops without being compressed into a phone-first layout.

The trainee experience must be phone-capable. A trainee needs to join, see the
monitor, apply interventions, adjust machine and ventilation settings, and
recover after a network interruption. The UI must communicate connection state
and unavailable commands clearly so users understand whether an action is
queued, sent, or blocked.

Command handling must be conservative while disconnected. The client must queue
only the initial `create_session`, `join_session`, or token-based `reconnect`
message needed to establish the session. Once a session is active, clinical and
trainer commands must be blocked while the socket is disconnected. This includes
interventions, machine sliders, manual ventilation, trainer overrides, phase
controls, event injection, pause, resume, and end-session commands. Manual
ventilation is time-sensitive and must never replay stale pointer-down or
pointer-up actions after reconnect.

Reconnect recovery covers transient WebSocket reconnects within the same loaded
page. Token persistence across page reloads is out of scope for this polish
pass unless implementation discovers a low-risk existing token-storage path.
After a full reload, trainees can rejoin with the QR invite or session code.

## Bug-bash method

The implementation must start with reproducible flows rather than visual
tweaking. Each flow must be checked against the UI, WebSocket client, protocol
validation, session handling, engine state, and remote UI rendering layers.

The initial bug-bash matrix includes these flows:

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

When a flow fails, the fix must address the root cause at the failing layer.
Protocol and session bugs need automated tests where practical. Visual and touch
issues need manual acceptance checks across target breakpoints because the
current test stack does not exercise browser layout or touch gestures.

## Waveform and sync polish

Remote clients remain thin clients. The server broadcasts compact authoritative
state snapshots, and remote browsers reconstruct waveform buffers locally for
smooth drawing. This keeps network use reasonable and preserves high-frequency
canvas rendering without streaming every sample.

The remote waveform path needs hardening in these areas:

- Buffer prefill so the first remote frame shows a plausible waveform.
- Snapshot interpolation so 10 Hz state updates produce smooth local buffers.
- Handling of elapsed-time gaps after reconnects or tab suspension.
- Handling of stale or out-of-order snapshots by dropping any snapshot whose
  `elapsedSeconds` is less than the last applied `elapsedSeconds`.
- Consistency between numerics and reconstructed waveforms after interventions,
  trainer overrides, reconnects, and pause/resume.

The implementation does not need a protocol sequence number for this pass. The
server's authoritative `elapsedSeconds` is the snapshot ordering key. Equal-time
snapshots can update numerics and state but must not rewind waveform buffers.
Future protocol work can add a sequence number if elapsed-time ordering proves
insufficient.

Canvas rendering must centralize device-pixel-ratio and resize handling so every
waveform uses the same crisp drawing behavior. ECG, SpO2, CO2, respiration, and
ART traces must remain sharp on high-DPR tablets and phones. The drawing loop
must stay independent from throttled React state so waveforms continue to render
smoothly while numerics update at a lower rate.

Waveform acceptance is measured with these criteria:

- Remote buffers are prefilled before the first visible remote monitor frame.
- Canvas backing dimensions equal CSS pixel size multiplied by
  `window.devicePixelRatio`, rounded to integer pixels.
- Canvas resize code resets the transform before applying DPR scaling, so
  repeated resizes do not accumulate scale transforms.
- Older snapshots are ignored for waveform writes.
- Equal-time snapshots do not add synthetic waveform samples.
- Normal 10 Hz snapshots write enough samples to keep the local buffer advancing
  at the expected remote sample rate.
- Large elapsed gaps after reconnect or tab suspension are capped to avoid a
  sudden multi-second waveform fast-forward.
- Reconnect does not clear existing waveform buffers unless a new session starts.

## Touch and responsive UX

Phone support is trainee-first. Trainer controls remain optimized for tablet,
laptop, and desktop screens. On small screens, the monitor stays the primary
view and controls move into a deliberate action tray instead of a squeezed side
panel.

The responsive design must follow these principles:

- Preserve monitor readability on phone and tablet screens.
- Use touch targets large enough for fast clinical-simulation interaction.
- Avoid nested scroll regions that trap touch gestures.
- Keep one obvious scroll direction per screen state.
- Make connection and session status visible without consuming excessive space.
- Preserve existing desktop and tablet side-panel behavior where it works.

Responsive breakpoints use CSS width, not device detection:

- Phone: less than `700px`. Use the trainee action tray.
- Tablet: `700px` to `1023px`. Prefer a bottom tray or bottom panel when the
  side panel would make the monitor unreadable.
- Desktop and large tablet landscape: `1024px` and wider. Keep the existing
  side panel layout unless testing shows a specific defect.

Interactive touch targets must be at least `44px` tall or wide. Urgent action
buttons should target `52px` or larger where space allows.

## Trainee action tray

The trainee phone view gets a bottom action tray. The collapsed tray leaves the
monitor readable and provides a clear affordance for opening controls. The
expanded tray shows the same main action groups as the current right panel:
drugs, airway, ventilation, procedures, and machine settings.

The tray must include these behaviors:

- Open and close from a clear bottom handle or action button.
- Show large tab controls for intervention categories.
- Show large action buttons with dose counts and cooldown state where relevant.
- Support machine controls and manual ventilation without accidental taps.
- Keep the event log accessible without competing with urgent actions.
- Collapse cleanly when the user returns focus to the monitor.

On phones, the collapsed tray target height should stay between `56px` and
`72px`. The expanded tray should use about `55vh` by default and must leave a
visible strip of monitor above it. The tray content can scroll vertically inside
the tray, but the monitor area must not also scroll while the tray is open.
The event log belongs behind an **Events** affordance inside the tray or as a
compact collapsible section below the action tabs. It must not consume the
default urgent-action view.

On tablet-sized screens, the implementation can choose a bottom tray or a wider
side or bottom panel based on the breakpoint. On desktop, the existing side
panel remains appropriate.

## Testing and verification

The work must combine automated tests with manual acceptance checks. Automated
tests cover deterministic protocol, session, and waveform behavior. Manual
checks cover device layout, touch ergonomics, and perceived monitor smoothness.

Automated coverage must target these areas:

- WebSocket reconnect behavior and queued messages.
- Server session creation, join, reconnect, roster, authorization, and terminal
  state behavior.
- Protocol validation for trainer-only and trainee-safe commands.
- Remote waveform reconstruction, including prefill, elapsed gaps, and edge
  cases that could cause jumps.
- UI utility logic for responsive sizing and control values.

Manual acceptance must cover these scenarios:

1. Create a trainer session and join with a trainee tablet.
2. Join the same session with a trainee phone.
3. Disconnect and reconnect trainer and trainee clients.
4. Apply interventions and machine changes from the trainee phone.
5. Use the trainer override and phase controls while trainees watch.
6. Confirm waveforms remain crisp and visually stable after reconnects.
7. Confirm phone controls are reachable without trapping scroll or hiding the
   monitor permanently.

The minimum manual viewport matrix is:

- Desktop: `1440px` by `900px`, DPR 1 or 2, latest Chrome or Safari.
- Tablet portrait: `768px` by `1024px`, DPR 2.
- Tablet landscape: `1024px` by `768px`, DPR 2.
- Phone portrait: `390px` by `844px`, DPR 3.
- Phone landscape: `844px` by `390px`, DPR 3.

Browser device emulation is acceptable for the first pass. At least one physical
phone on the local network is recommended before treating the feature as demo
ready, because QR join, touch gestures, and WebSocket reconnects can differ from
desktop emulation.

## Implementation order

The implementation must proceed from reliability to polish. This order avoids
building a slick interface on top of unreliable session behavior.

1. Audit and reproduce trainer-trainee flows.
2. Fix root-cause session and protocol issues with tests.
3. Harden remote waveform reconstruction and canvas sizing.
4. Add the trainee phone action tray and responsive layout refinements.
5. Run automated tests and manual acceptance checks across target breakpoints.

## Open decisions

The implementation plan must resolve only these remaining details before code
changes begin:

- The exact visual treatment for the tray handle, close button, and active tab.
- Whether tablet portrait uses the same tray component as phone or a persistent
  bottom panel.
- Whether a physical phone is available for final demo readiness verification.

## Next steps

After this spec is reviewed and approved, create an implementation plan that
breaks the work into small chunks. The first implementation chunk must focus on
reproducing and testing session-flow failures before changing user-facing
layout.
