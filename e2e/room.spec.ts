import { test, expect } from '@playwright/test'

/**
 * Full trainer→trainee round trip over the real websocket server: the trainer
 * creates a room, a trainee joins by code, the trainer starts the case, the
 * trainee performs an action, and that action surfaces — attributed to the
 * trainee — on the trainer's live action timeline.
 */
test('trainer creates a room, trainee joins and acts, action reaches the trainer timeline', async ({ browser }) => {
  const trainerContext = await browser.newContext()
  const traineeContext = await browser.newContext()
  const trainer = await trainerContext.newPage()
  const trainee = await traineeContext.newPage()

  // Trainer creates the room.
  await trainer.goto('/')
  await trainer.getByPlaceholder('Dr Smith').fill('Dr Smith')
  await trainer.getByRole('button', { name: 'Create room' }).click()

  // Read the six-character session code from the waiting room.
  const codeEl = trainer.getByTestId('session-code')
  await expect(codeEl).toHaveText(/^[A-HJ-NP-Z2-9]{6}$/)
  const sessionCode = (await codeEl.textContent())!.trim()

  // Trainee joins with that code.
  await trainee.goto('/')
  await trainee.getByPlaceholder('John').fill('Jordan')
  await trainee.getByPlaceholder('7K3M9P').fill(sessionCode)
  await trainee.getByRole('button', { name: 'Join session' }).click()

  // Trainer sees the trainee in the roster.
  await expect(trainer.getByText('Jordan').first()).toBeVisible()

  // Trainer starts the case.
  await trainer.getByRole('button', { name: 'Start case' }).click()

  // Trainee performs the first available intervention.
  const action = trainee.locator('.action-button:not([disabled])').first()
  await expect(action).toBeVisible()
  await action.click()

  // The action appears on the trainer's action timeline, attributed to the
  // trainee (the timeline renders the actor name in a <strong>; the roster
  // uses <span>, so this asserts the action, not just the roster entry).
  await expect(trainer.locator('strong', { hasText: 'Jordan' }).first()).toBeVisible()

  await trainerContext.close()
  await traineeContext.close()
})
