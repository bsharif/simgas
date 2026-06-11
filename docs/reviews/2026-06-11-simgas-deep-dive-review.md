# SimGas deep dive review

This document summarizes a high-level product, clinical education, and software
review of SimGas as of June 11, 2026. It focuses on issues that can affect user
experience, trainer-trainee flow, scenario starting and completion, and the
features that could make SimGas a standout open-source anaesthetic simulation
tool.

The review assumes the goal is not monetization. The most valuable direction is
an educator-owned, offline-capable, open-source simulator with clinically
reviewed scenario packs and strong local-network teaching workflows.

## Executive summary

SimGas has a strong foundation. The pure TypeScript physiology engine, markdown
scenario DSL, realistic monitor presentation, local-first architecture, and
early trainer-trainee support are all good building blocks for an excellent
simulation teaching tool.

The highest-risk area is trainer-trainee mode. It has enough infrastructure to
be promising, but it is not yet robust enough for real teaching sessions. The
main gaps are remote state synchronization, invisible connection errors, no
waiting-room/start workflow, stale roster state, no synced dose ledger, and no
shared remote debrief.

The second major risk is clinical fidelity. Several scenarios currently resolve
when the learner performs one key action, which can train a "magic button"
mental model rather than a complete crisis-management approach. The app needs a
structured rubric layer for critical actions, supporting actions, harmful
actions, omissions, and time-to-action metrics.

The highest-value next step is to stabilize trainer-trainee sessions first, then
strengthen scenario completion logic and educator debrief tooling.

## High-priority findings

These findings are the issues most likely to affect user experience, scenario
fairness, or teaching value.

### Remote terminal state can desynchronize

The remote server throttles routine state broadcasts to 10 Hz. That is sensible
for normal monitor updates, but terminal scenario state needs special handling.
The engine applies final resolve or fail snaps before changing phase, and a
remote client can receive the terminal phase without receiving the final vital
state if the final state update lands inside the throttle window.

Impact:

- The trainee can see that the case has resolved or failed while the monitor
  still shows a stale state.
- The trainer can lose confidence that both screens are showing the same
  outcome.
- The debrief can start from a monitor state that doesn't match the scenario
  result.

Recommended direction:

- Keep throttling routine tick updates.
- Force-send state after terminal ticks.
- Force-send command-driven state changes, such as manual ventilation, machine
  setting changes, pause, resume, restart, and end-session commands.
- Add tests that assert terminal state is delivered even immediately after a
  routine state broadcast.

### Join and create errors are not visible enough

The app currently routes to trainer or trainee screens immediately after the
user creates or joins a session. If the server rejects the action, the remote
context doesn't surface that error clearly in the UI.

Impact:

- A trainee entering the wrong code can land on a confusing remote screen.
- Expired rooms, full rooms, unauthorized reconnects, and invalid payloads can
  fail without an actionable recovery path.
- This creates friction at the exact point where educators need the app to feel
  reliable.

Recommended direction:

- Keep the user in the lobby until the server acknowledges `session_created` or
  `session_joined`, or show a clear transitional state with a back/retry action.
- Store and render session errors in remote context.
- Translate server error codes into human-readable messages.
- Provide explicit retry, change code, and return-to-lobby actions.

### Trainer sessions start too early

Trainer rooms start the selected scenario as soon as the trainer connects. For a
real teaching session, this is awkward. The trainer usually needs to set up the
room, invite learners, confirm the display, brief the scenario, and then start.

Impact:

- Trainees can join after the physiology has already deteriorated.
- The educator loses control of when the learning event starts.
- It is difficult to use the app in a classroom, theatre teaching room, or sim
  centre workflow.

Recommended direction:

- Add an explicit room lifecycle: create room, waiting room, started, ended,
  debrief, and restart.
- Let the trainer choose when to start the scenario.
- Show trainees a waiting screen before the case starts.
- Let the trainer restart the same case or select a new case after debrief.

### Manual bagging and scenario predicates are disconnected

The realistic hold-to-ventilate bag control changes ventilation state and
physiology, but some scenarios check for the separate `manual-vent`
intervention. A learner can perform realistic manual ventilation and still fail
to satisfy the scenario's scripted recovery condition.

Impact:

- The scenario can feel unfair.
- The app can teach learners to press abstract action buttons instead of using
  realistic machine controls.
- Bronchospasm and laryngospasm are especially affected because manual
  ventilation is central to management.

Recommended direction:

- Make manual ventilation a first-class scenario signal.
- Prefer state-based predicates for actions that are represented by machine
  controls, such as FiO2, ventilation mode, respiratory rate, PEEP, and volatile
  concentration.
- If needed, record a manual ventilation action when the bag is used, while
  preserving the realistic hold-to-ventilate interaction.

### Remote dose ledger and cooldown state are not synchronized

The remote UI uses an empty local dose ledger. The authoritative engine records
doses and enforces cooldowns, but the remote client doesn't receive the ledger
state that drives button badges, cooldown labels, and max-dose UI.

Impact:

- Trainees can repeatedly press buttons that the server silently rejects or only
  explains through delayed event text.
- Button states can feel wrong or inconsistent between solo and remote mode.
- Drug teaching is weakened because dosing history is not visible in the shared
  session.

Recommended direction:

- Add remote dose ledger snapshots or updates.
- Include dose count, last applied time, cooldown state, and max-dose status.
- Attribute interventions to actors so the trainer can see who did what and
  when.

### Remote mode lacks a proper debrief

Solo mode has a debrief overlay, but trainer-trainee mode doesn't render an
equivalent debrief for trainer or trainee. Remote scenario metadata also drops
the debrief body and teaching content.

Impact:

- The most educational part of the simulation is missing from shared sessions.
- The trainer cannot easily guide a structured after-action review.
- Trainees don't get a clear summary of what happened, what they did, and what
  they missed.

Recommended direction:

- Add a shared remote debrief view.
- Send safe scenario teaching content to remote clients.
- Give the trainer a richer view than the trainee, including phase transitions,
  action attribution, omissions, and notes.
- Let the trainer control when the debrief opens for the group.

### Scenario completion can reward single-action management

Several scenarios resolve when one key intervention occurs. That can be useful
for a prototype, but it is not enough for a high-quality educational simulator.
Real anaesthetic crisis management requires bundles of actions, prioritization,
reassessment, communication, and avoidance of harmful actions.

Impact:

- Learners can pass scenarios with incomplete clinical management.
- The app risks reinforcing simplified algorithms rather than clinical
  reasoning.
- Educators may not trust the scenario outcomes as a meaningful assessment.

Recommended direction:

- Add structured scenario metadata for critical actions, supporting actions,
  dangerous actions, and omissions.
- Track whether each expected action was done, when it was done, and by whom.
- Resolve scenarios based on management bundles and physiological response, not
  only one action trigger.
- Use the debrief to distinguish correct, late, omitted, unnecessary, repeated,
  and harmful actions.

### Guided, exam, and free-play modes need real behavior

The app exposes guided, exam, and free-play modes, but the implementation is
mostly a UI label. Guided mode hides or shows the hint panel, while scenario
events can still leak hints into the event log.

Impact:

- Exam mode is not a true no-hint assessment mode.
- Free play is not yet a real physiology sandbox.
- The mode selector can create expectations that the app doesn't meet.

Recommended direction:

- Make mode a first-class simulation setting.
- In guided mode, provide progressive hints, QRH support, and optional
  pause-and-teach overlays.
- In exam mode, suppress hints, score critical actions, and show feedback only
  after completion.
- In free-play mode, disable scripted fail/resolve behavior unless explicitly
  selected.

## Trainer-trainee mode review

Trainer-trainee mode is the highest-potential feature in the app. It changes
SimGas from a solo monitor toy into a real teaching platform. The current
architecture is close to the right shape, but the workflow needs to be more
deliberate and reliable.

### Trainer experience

The trainer needs to create a room, invite learners, start and pause the case,
inject events, override physiology, watch the learner timeline, and lead the
debrief. The current trainer view provides room code, QR invite, monitor,
override controls, event injection, phase timeline, and roster. That is a good
start.

The main missing pieces are workflow control and trust. The trainer needs to see
who is connected, whether each client is synchronized, whether commands are
being accepted, and when the case is ready to start. The trainer also needs a
proper debrief cockpit after completion.

Recommended trainer improvements:

- Add a waiting room with a clear **Start case** button.
- Show connected, disconnected, and reconnecting states per learner.
- Show a synchronized clock and current phase.
- Show an action timeline with actor names.
- Let the trainer add notes during the case.
- Let the trainer mark teaching moments during the case.
- Add a trainer-only debrief view with omissions, critical-action timing, and
  suggested discussion prompts.

### Trainee experience

The trainee needs to join quickly, understand whether the session is ready, see
the monitor clearly, and access actions without fighting the interface. The
current trainee view is compact and mobile-aware, which is a good direction.

The main risks are error handling, cognitive load, and lack of feedback. If a
join fails, the trainee needs a clear message. If the case hasn't started, the
trainee needs a waiting state. During the case, the action tray needs to be fast
and predictable. After the case, the trainee needs a shared debrief.

Recommended trainee improvements:

- Add a clear waiting screen before the trainer starts the case.
- Show friendly errors for wrong, expired, or full sessions.
- Keep the monitor dominant and make actions easy to open on mobile.
- Add quick access to likely crisis actions in guided mode.
- Show dose/cooldown feedback in remote mode.
- Add a trainee debrief that explains what happened without exposing trainer
  controls.

### Multi-screen synchronization

The app needs a simple synchronization contract: the server is authoritative,
routine monitor data can be throttled, and discrete state changes must be sent
immediately. That distinction is important for simulation trust.

State that must be immediate:

- Scenario start, restart, resolve, and fail states.
- Pause and resume.
- Machine setting changes.
- Manual ventilation engagement and release.
- Trainer overrides.
- Phase changes.
- Intervention application and rejection.
- Dose ledger updates.

State that can be throttled:

- Routine vital drift.
- Routine waveform snapshots.
- Continuous monitor refresh.

## Scenario and clinical education review

The scenario DSL is one of the strongest parts of the project. Markdown files
make scenarios easy to read, review, and share. The current schema is good for a
prototype, but the app now needs a clinical education layer above the phase
machine.

### Add a rubric layer

Scenarios need to describe not only physiology but also expected management.
This makes completion fairer, debrief richer, and community review easier.

Recommended scenario fields:

- `learning_objectives`
- `critical_actions`
- `supporting_actions`
- `dangerous_actions`
- `omissions`
- `assessment_rubric`
- `expected_time_windows`
- `references`
- `guideline_version`
- `author`
- `reviewers`
- `last_reviewed`
- `license`

### Expand predicate inputs

Many clinically meaningful actions happen through machine settings, not action
buttons. The scenario engine needs to reason about those settings.

Useful predicate inputs include:

- FiO2.
- Ventilation mode.
- Manual ventilation activity.
- Respiratory rate.
- Tidal volume.
- PEEP.
- Gas flow.
- Sevoflurane concentration.
- Tube position.
- Capnography shape.
- Dose counts and repeated doses.

### Improve drug and action realism

Some available drug buttons represent anaesthetic bolus doses, while emergency
scenarios require algorithmic doses. For example, cardiac arrest and anaphylaxis
need different adrenaline dosing from routine anaesthetic vasopressor boluses.

Recommended direction:

- Separate anaesthetic bolus drugs from emergency algorithm drugs.
- Show route, dose, concentration, and context clearly.
- Make scenario-specific emergency panels available in guided mode.
- Avoid hiding important actions, but reduce visual noise during crises.

### Strengthen scenario validation

Scenario authoring is powerful, which means validation needs to catch authoring
mistakes before a teaching session. The linter needs to check more than YAML
shape and predicate syntax.

Recommended validation checks:

- Unknown predicate variables.
- Unknown predicate functions.
- Unknown intervention IDs in `any()` and `count()`.
- Unknown phase IDs in `phase_done()`.
- Duplicate timed event timestamps in the same phase.
- Shadowed or unreachable phases.
- Scenarios that cannot resolve or cannot fail.
- Scenarios whose debrief mentions actions not represented in the controls.

## High-value fix plan

This plan is intentionally high level. It prioritizes reliability and teaching
value before adding more scenarios or visual polish.

### Phase 1: Stabilize trainer-trainee reliability

This phase makes shared sessions dependable enough for real use in a teaching
room.

Key outcomes:

- Trainers can create a room without automatically starting the scenario.
- Trainees can join a waiting room and see a ready state.
- Errors are visible and recoverable.
- Terminal scenario state always reaches every connected client.
- Command-driven state changes are sent immediately.
- Dose ledger state is synchronized.
- Roster state reflects connected and disconnected participants.
- Remote sessions can end, restart, and return to debrief cleanly.

Why this comes first:

Trainer-trainee mode is the highest-leverage feature for education, but it is
also the least forgiving. If setup or synchronization feels unreliable, faculty
will not use it even if the physiology model is good.

### Phase 2: Make scenario completion clinically fair

This phase changes scenarios from button-triggered scripts into educational
cases with clear management expectations.

Key outcomes:

- Scenarios define critical actions, supporting actions, harmful actions, and
  omissions.
- Completion depends on a clinically coherent management bundle.
- Machine controls count when they represent clinical actions.
- Emergency drug dosing matches the scenario context.
- Scenario outcomes distinguish stabilization from incomplete management.
- Built-in scenarios have regression tests for expected success and failure
  paths.

Why this matters:

The app must not reward incomplete management. For example, malignant
hyperthermia teaching needs dantrolene, stopping triggers, hyperventilation,
cooling, help, monitoring, and ongoing reassessment. The debrief can still
credit partial management, but scenario success needs a higher standard.

### Phase 3: Build a real educator workflow

This phase turns SimGas from a monitor simulator into a teaching tool.

Key outcomes:

- Trainers get an action-attributed timeline.
- Trainers can add notes and mark teaching moments.
- Debrief includes critical-action timing, omissions, repeated actions, and
  harmful actions.
- Debrief compares learner actions against the scenario rubric and QRH content.
- Trainees receive a learner-friendly debrief view.
- Trainers can export or copy a session summary for teaching records.

Why this matters:

Simulation learning happens mostly in debrief. A great monitor gets attention,
but a great debrief makes the tool educationally valuable.

### Phase 4: Make guided, exam, and free-play modes meaningful

This phase aligns the mode selector with real learning behaviors.

Guided mode:

- Progressive hints.
- QRH/checklist drawer.
- Optional educator explanations.
- Recommended action groups.
- Low-stakes feedback during the case.

Exam mode:

- No hints during the case.
- Structured scoring after the case.
- Time-to-critical-action metrics.
- Clear pass, partial pass, and fail criteria.
- Hidden trainer controls from trainees.

Free-play mode:

- No scripted failure or resolution by default.
- Manual physiology adjustment.
- Optional trainer-triggered events.
- Useful sandbox behavior for demonstration and teaching.

Why this matters:

The same scenario can support novice teaching, exam preparation, and faculty
demonstration if the mode semantics are real.

### Phase 5: Improve scenario authoring and community review

This phase makes SimGas sustainable as an open-source education project.

Key outcomes:

- Scenario metadata includes author, reviewers, references, guideline version,
  review date, and license.
- Scenario packs can be imported and exported.
- CI validates scenario mechanics and clinical metadata.
- Pull requests include a clinical review checklist.
- Example packs cover common anaesthetic emergencies and exam-style cases.

Why this matters:

Open-source medical education tools need trust. A transparent review workflow is
more valuable than a large number of unreviewed scenarios.

## Killer app features

These ideas would make SimGas feel unusually useful for educators while staying
consistent with an open-source, non-SaaS direction.

### Local-network simulation room mode

This is the most important killer feature. A trainer runs SimGas on a laptop,
trainees join from phones or tablets, and a projector shows an observer monitor.
No accounts, cloud service, or external data storage are required.

Useful views:

- Trainer control view.
- Trainee action view.
- Projector monitor view.
- Observer-only view.
- Debrief view.

Why it is powerful:

It matches how simulation centres, theatre teaching rooms, and small-group
teaching actually work. It also keeps the project aligned with privacy,
offline-first use, and open-source deployment.

### Shared debrief with timeline replay

A replayable timeline would let the trainer scrub through monitor state,
interventions, alarms, phase changes, and notes.

Useful capabilities:

- Replay vitals over time.
- Show interventions on the timeline.
- Highlight critical windows.
- Compare learner actions to expected actions.
- Add trainer comments.
- Export a concise debrief summary.

Why it is powerful:

Timeline replay turns a fast, chaotic crisis into a teachable sequence. It helps
learners understand recognition, prioritization, and consequences.

### QRH and checklist integration

The app can become a practical way to teach emergency manuals and crisis
checklists.

Useful capabilities:

- Scenario-linked QRH checklist drawer.
- Guided-mode prompts that reference checklist steps.
- Debrief comparison against QRH priorities.
- Trainer option to reveal checklist at a chosen time.
- Scenario metadata that links to guideline sections.

Why it is powerful:

Anaesthetic crisis management is team-based and checklist-supported. Integrating
QRH content makes SimGas more educationally authentic than a pure physiology
game.

### Scenario packs

Scenario packs would let educators share coherent teaching sets rather than
single cases.

Example packs:

- Novice airway emergencies.
- Core anaesthetic crises.
- Obstetric anaesthesia emergencies.
- Paediatric anaesthesia emergencies.
- Cardiac arrest and peri-arrest rhythms.
- FRCA or board-exam practice.
- Theatre team drills.
- ICU transfer and deterioration cases.

Why it is powerful:

Faculty usually teach curricula, not isolated scenarios. Packs make SimGas
easier to adopt for courses and departmental teaching.

### Structured assessment and feedback

Assessment doesn't need to be punitive or commercial. It can be a transparent,
educator-owned rubric.

Useful capabilities:

- Time to recognition.
- Time to first critical action.
- Missed critical actions.
- Harmful actions.
- Repeated or unnecessary actions.
- Team communication prompts.
- Overall outcome: achieved, partially achieved, or not achieved.

Why it is powerful:

Structured feedback helps learners improve and helps educators run consistent
sessions across groups.

### Scenario creator with clinical review workflow

The existing scenario creator can become a community authoring tool if it helps
authors build clinically reviewable cases.

Useful capabilities:

- Guided scenario authoring wizard.
- Rubric editor.
- Predicate validation.
- Built-in preview and dry run.
- Clinical review checklist.
- Scenario pack export.
- Metadata for references, reviewers, and guideline version.

Why it is powerful:

The best open-source advantage is community content. The challenge is quality.
A review workflow gives educators confidence that shared content is safe and
teachable.

### Faculty-friendly deployment

SimGas can be excellent if non-technical educators can run it easily.

Useful capabilities:

- Clear local-network setup docs.
- One-command production server.
- QR invite links.
- Offline asset support.
- Sample classroom setup diagrams.
- Troubleshooting guide for Wi-Fi and browser issues.
- No account requirement.

Why it is powerful:

The easier it is to run in a hospital teaching environment, the more likely it
is to be used.

### Accessibility and cognitive load improvements

Simulation crises are cognitively demanding. The interface must help users act
quickly without hiding important information.

Useful capabilities:

- Larger event log text.
- Colorblind-safe alarm states with text and symbols.
- Reduced-motion support.
- Screen-reader-friendly vital summaries.
- Keyboard shortcuts for common actions.
- Search, favorites, and recents for interventions.
- Scenario-specific action groups in guided mode.

Why it is powerful:

Better accessibility improves usability for everyone, especially under time
pressure.

## Open-source positioning

The project needs documentation and governance that match the intended
non-commercial direction.

Recommended positioning:

> SimGas is an educator-owned, offline-capable anaesthetic crisis simulator with
> peer-reviewed scenario packs for local and remote teaching.

Recommended project improvements:

- Add a clear license for code.
- Decide whether scenario and QRH-derived educational content need a separate
  content license.
- Update the README to describe the current server-backed trainer-trainee mode.
- Remove or rewrite monetization assumptions from the PRD.
- Add contribution guidelines.
- Add a clinical review checklist for scenario pull requests.
- Add local-network deployment documentation for simulation centres.

## Recommended next steps

The recommended sequence is to improve reliability first, then clinical depth,
then community scale.

1. Stabilize trainer-trainee session reliability and state synchronization.
2. Add a waiting-room/start workflow and visible session errors.
3. Sync dose ledger, intervention attribution, and roster connection state.
4. Add remote debrief for trainers and trainees.
5. Define scenario rubric metadata and update built-in scenarios.
6. Make guided, exam, and free-play modes semantically distinct.
7. Add scenario validation for clinical and mechanical authoring mistakes.
8. Update open-source documentation, license, and contribution workflow.
9. Build scenario packs and QRH-integrated debrief features.

If the project follows this order, SimGas can become a serious open-source
simulation teaching platform rather than only a compelling monitor prototype.
