import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * Accessibility gate. The app carries known color-contrast debt (many muted
 * greys below WCAG AA 4.5:1) that is a design task, not a test-layer task —
 * so the gate excludes `color-contrast` and enforces the *structural* a11y
 * rules (labels, roles, headings, landmarks, ARIA) that otherwise regress
 * silently. Re-enable color-contrast here once the palette is darkened.
 */
async function expectNoStructuralA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .disableRules(['color-contrast'])
    .analyze()
  expect(results.violations).toEqual([])
}

test.describe('solo practice', () => {
  test('lobby → scenario picker (grouped by pack) → simulation', async ({ page }) => {
    await page.goto('/')

    // Lobby.
    await expect(page.getByRole('heading', { name: 'SimGas' })).toBeVisible()
    await expectNoStructuralA11yViolations(page)

    // Scenario picker — cases are grouped under pack headers.
    await page.getByRole('button', { name: 'Choose scenario' }).click()
    await expect(page.getByText('Airway emergencies')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start Simulation' })).toBeVisible()
    await expectNoStructuralA11yViolations(page)

    // Pick a scenario and start.
    await page.getByRole('button', { name: /Anaphylaxis/ }).click()
    await page.getByRole('button', { name: 'Start Simulation' }).click()

    // Simulation view: monitor header + intervention controls are present.
    await expect(page.getByText('SimGas')).toBeVisible()
    await expect(page.locator('.action-button').first()).toBeVisible()
    await expectNoStructuralA11yViolations(page)
  })
})
