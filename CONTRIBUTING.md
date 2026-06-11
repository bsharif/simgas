# Contributing to SimGas

Thanks for helping build an educator-owned, offline-capable anaesthetic
crisis simulator. Contributions fall into two broad groups — **code** and
**clinical content** — and they have different review expectations.

## Code contributions

1. Fork, branch from `main`, and keep PRs focused.
2. `npm install` once; the pre-commit hook (`simple-git-hooks`) runs
   `npm run lint` and `npm run typecheck` automatically.
3. Before opening a PR run the full gate locally:

   ```bash
   npm run lint
   npm run typecheck
   npm test
   npm run lint:scenarios
   npm run build
   ```

4. Keep the architectural rule intact: **`ui/` imports from `engine/`,
   never the reverse.** The engine must stay free of React, the DOM, and
   browser globals so it can be ported to Swift.
5. New engine behaviour needs tests under `engine/**/*.test.ts` (vitest,
   node environment). Server behaviour is tested under `server/`.

## Scenario contributions

Scenarios are `.md` files in `/scenarios/` — YAML frontmatter (phase
machine + rubric) and a markdown debrief body. `npm run lint:scenarios`
validates the mechanics: predicate syntax, known variables/functions,
intervention and phase id references, rubric ids, shadowed phases, and
reachability of an ending.

Every scenario PR must also pass **clinical review**. Copy this checklist
into the PR description and have a clinician complete it:

### Clinical review checklist

- [ ] **Recognition is realistic.** The vital-sign trajectory and timings
      are plausible for the condition (accelerated timelines are fine if
      the debrief says so).
- [ ] **Management matches current guidance.** The `critical_actions`,
      `supporting_actions`, and resolution conditions follow a published
      guideline (QRH, ALS, AAGBI, local equivalent), and `references` /
      `guideline_version` name it.
- [ ] **Completion requires a coherent bundle**, not one "magic button".
      Where a single action genuinely is the treatment (e.g. needle
      decompression), the rubric still captures the supporting care.
- [ ] **Dangerous actions are flagged.** Anything a learner might
      plausibly do that worsens this condition appears in
      `dangerous_actions` with a rationale.
- [ ] **Doses and routes shown to learners are correct** for the modelled
      context (anaesthetic bolus vs emergency algorithm dosing).
- [ ] **The debrief teaches.** It explains recognition, management
      priorities, and what the simulation simplifies.
- [ ] **Hints don't give the diagnosis away in exam-relevant cases**
      unless that is the point of the scenario.
- [ ] **Metadata is complete**: `author`, `reviewers`, `last_reviewed`,
      `references`, `qrh` (where applicable), `pack`.
- [ ] Reviewer name + role recorded in `reviewers:`.

Scenario success/failure paths should also get a regression test in
`engine/scenarios/scenarios.integration.test.ts` (see the anaphylaxis
bundle tests for the pattern).

## Safety boundaries

SimGas is an educational tool, not a medical device. Don't add features
that present it as suitable for clinical monitoring, and keep the "not
for clinical use" warnings in place.
