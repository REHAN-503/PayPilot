import { test, expect } from '@playwright/test';

test.describe('PayPilot Autonomous Procurement Smoke Test', () => {
  test('login as demo -> run prompt 1 -> verify plan and timeline', async ({ page }) => {
    // 1. Visit Welcome or Login page
    await page.goto('/welcome');
    await expect(page).toHaveTitle(/PayPilot/);

    // 2. Click Continue as Demo User
    const demoButton = page.locator('button:has-text("Continue as Demo User")').first();
    await expect(demoButton).toBeVisible();
    await demoButton.click();

    // 3. Arrive at Command Center
    await page.waitForURL('/', { timeout: 10000 });
    await expect(page.locator('h1').first()).toContainText('Plan a purchase');

    // 4. Click Prompt 1 chip: Developer Monitor
    const prompt1Chip = page.locator('button:has-text("Developer Monitor")').first();
    await expect(prompt1Chip).toBeVisible();
    await prompt1Chip.click();

    // 5. Verify agent steps animate into completed states
    await expect(page.locator('text=Parsing Purchase Intent').first()).toBeVisible();

    // 6. Wait for Plan Card to appear
    await expect(page.locator('text=PixelView 24-inch QHD Developer Monitor').or(page.locator('text=NovaView')).first()).toBeVisible({
      timeout: 15000,
    });

    // 7. Click Authorize & Pay to open Approval Sheet
    const authorizeBtn = page.locator('button:has-text("Authorize & Pay")').first();
    if (await authorizeBtn.isVisible()) {
      await authorizeBtn.click();

      // Verify Policy Checklist and Risk Gate
      await expect(page.locator('text=Two-Party Governance Check')).toBeVisible();
      await expect(page.locator('text=Deterministic Spending Rules')).toBeVisible();
      await expect(page.locator('text=Behavioral Risk Assessment')).toBeVisible();

      // Click Approve & Proceed
      const approveBtn = page.locator('button:has-text("Approve & Proceed")');
      if (await approveBtn.isVisible()) {
        await approveBtn.click();
        await expect(page.locator('text=Authorized by user')).toBeVisible({ timeout: 10000 });
      }
    }

    // 8. Visit Trust Timeline and verify events exist
    await page.goto('/timeline');
    await expect(page.locator('h1').first()).toContainText('Verifiable Trust Timeline');
    await expect(page.locator('main').getByText(/INTENT|PLAN|POLICY|APPROVAL|Autonomous/).first()).toBeVisible({
      timeout: 10000,
    });
  });
});

