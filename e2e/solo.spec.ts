import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * Accessibility gate over the gated screens (lobby, scenario picker,
 * simulation). Enforces the full WCAG 2 A/AA rule set including color-contrast
 * — the muted-grey palette was darkened to meet 4.5:1, so this guards against
 * regressions on both structure (labels/roles/headings/landmarks) and contrast.
 */
async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()
  expect(results.violations).toEqual([])
}

test.describe('solo practice', () => {
  test('lobby → scenario picker (grouped by pack) → simulation', async ({ page }) => {
    await page.goto('/')

    // Lobby.
    await expect(page.getByRole('heading', { name: 'SimGas' })).toBeVisible()
    await expectNoA11yViolations(page)

    // Scenario picker — cases are grouped under pack headers.
    await page.getByRole('button', { name: 'Choose scenario' }).click()
    await expect(page.getByText('Airway emergencies')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start Simulation' })).toBeVisible()
    await expectNoA11yViolations(page)

    // Pick a scenario and start.
    await page.getByRole('button', { name: /Anaphylaxis/ }).click()
    await page.getByRole('button', { name: 'Start Simulation' }).click()

    // Simulation view: monitor header + intervention controls are present.
    await expect(page.getByText('SimGas')).toBeVisible()
    await expect(page.locator('.action-button').first()).toBeVisible()
    await expectNoA11yViolations(page)
  })

  test('scenario reaches terminal → debrief opens → copy summary works', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])

    // `?timescale=60` fast-forwards the sim so an untreated scenario reaches a
    // terminal state in ~2s instead of ~90s of real wall-clock.
    await page.goto('/?timescale=60')
    await page.getByRole('button', { name: 'Choose scenario' }).click()
    await page.getByRole('button', { name: /Anaphylaxis/ }).click()
    await page.getByRole('button', { name: 'Start Simulation' }).click()

    // No treatment → the scenario fails; the debrief dialog auto-opens.
    const dialog = page.getByRole('dialog', { name: 'Scenario debrief' })
    await expect(dialog).toBeVisible({ timeout: 30_000 })

    // Copy summary writes the teaching-record markdown to the clipboard.
    await dialog.getByRole('button', { name: 'Copy summary' }).click()
    const clip = await page.evaluate(() => navigator.clipboard.readText())
    expect(clip).toContain('Anaphylaxis')
  })
})
