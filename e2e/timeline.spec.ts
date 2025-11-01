import { test, expect } from '@playwright/test';

test.describe('Project Timeline', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Create a test project
    await page.click('button:has-text("New Project")');
    await page.fill('input[name="name"]', 'Timeline Test Project');
    await page.click('button:has-text("Create")');
    
    // Wait for navigation to project view
    await page.waitForURL(/\/project\/\d+/);
  });

  test('should display timeline section below header', async ({ page }) => {
    // Check that timeline section exists
    const timelineSection = page.locator('.timeline-section');
    await expect(timelineSection).toBeVisible();
    
    // Check that timeline component is rendered
    const timeline = page.locator('app-project-timeline');
    await expect(timeline).toBeVisible();
  });

  test('should show start and end date buttons', async ({ page }) => {
    const startButton = page.locator('button:has-text("Set Start")');
    const endButton = page.locator('button:has-text("Set End")');
    
    await expect(startButton).toBeVisible();
    await expect(endButton).toBeVisible();
  });

  test('should allow setting start date', async ({ page }) => {
    // Click the start date button
    await page.click('button:has-text("Set Start")');
    
    // Wait for inline date input to appear (fallback for Tauri)
    const inlineDateInput = page.locator('input[type="date"].inline-date-input').first();
    await expect(inlineDateInput).toBeVisible({ timeout: 2000 });
    
    // Set a start date
    await inlineDateInput.fill('2025-01-01');
    await inlineDateInput.dispatchEvent('change');
    
    // Wait a moment for the save to complete
    await page.waitForTimeout(500);
    
    // Check that the button now shows the date
    const startButton = page.locator('button').filter({ hasText: '2025-01-01' });
    await expect(startButton).toBeVisible();
  });

  test('should allow setting end date', async ({ page }) => {
    // Click the end date button
    await page.click('button:has-text("Set End")');
    
    // Wait for inline date input to appear
    const inlineDateInput = page.locator('input[type="date"].inline-date-input').last();
    await expect(inlineDateInput).toBeVisible({ timeout: 2000 });
    
    // Set an end date
    await inlineDateInput.fill('2025-12-31');
    await inlineDateInput.dispatchEvent('change');
    
    // Wait a moment for the save to complete
    await page.waitForTimeout(500);
    
    // Check that the button now shows the date
    const endButton = page.locator('button').filter({ hasText: '2025-12-31' });
    await expect(endButton).toBeVisible();
  });

  test('should display timeline ticks after setting both dates', async ({ page }) => {
    // Set start date
    await page.click('button:has-text("Set Start")');
    const startInput = page.locator('input[type="date"].inline-date-input').first();
    await expect(startInput).toBeVisible({ timeout: 2000 });
    await startInput.fill('2025-01-01');
    await startInput.dispatchEvent('change');
    await page.waitForTimeout(300);
    
    // Set end date
    await page.click('button:has-text("Set End")');
    const endInput = page.locator('input[type="date"].inline-date-input').last();
    await expect(endInput).toBeVisible({ timeout: 2000 });
    await endInput.fill('2025-12-31');
    await endInput.dispatchEvent('change');
    await page.waitForTimeout(300);
    
    // Check that timeline ticks are visible
    const ticks = page.locator('.tick');
    const tickCount = await ticks.count();
    expect(tickCount).toBeGreaterThan(0);
    
    // Check that tick labels are visible
    const tickLabels = page.locator('.tick-label');
    const firstLabel = tickLabels.first();
    await expect(firstLabel).toBeVisible();
  });

  test('should show placeholder when no dates are set', async ({ page }) => {
    const placeholder = page.locator('.timeline-placeholder');
    await expect(placeholder).toBeVisible();
    await expect(placeholder).toHaveText('Set start and end dates to view timeline');
  });

  test('should adjust timeline section margin when left sidebar is toggled', async ({ page }) => {
    const timelineSection = page.locator('.timeline-section');
    
    // Get initial margin
    const initialMargin = await timelineSection.evaluate((el) => {
      return window.getComputedStyle(el).marginLeft;
    });
    
    // Toggle left sidebar
    await page.click('button[title="Toggle left sidebar"]');
    await page.waitForTimeout(300); // Wait for transition
    
    // Get new margin
    const newMargin = await timelineSection.evaluate((el) => {
      return window.getComputedStyle(el).marginLeft;
    });
    
    // Margins should be different
    expect(initialMargin).not.toBe(newMargin);
  });

  test('should persist timeline dates on page reload', async ({ page }) => {
    // Set dates
    await page.click('button:has-text("Set Start")');
    const startInput = page.locator('input[type="date"].inline-date-input').first();
    await expect(startInput).toBeVisible({ timeout: 2000 });
    await startInput.fill('2025-03-15');
    await startInput.dispatchEvent('change');
    await page.waitForTimeout(300);
    
    await page.click('button:has-text("Set End")');
    const endInput = page.locator('input[type="date"].inline-date-input').last();
    await expect(endInput).toBeVisible({ timeout: 2000 });
    await endInput.fill('2025-09-30');
    await endInput.dispatchEvent('change');
    await page.waitForTimeout(500);
    
    // Reload the page
    await page.reload();
    await page.waitForTimeout(500);
    
    // Check that dates are still displayed
    const startButton = page.locator('button').filter({ hasText: '2025-03-15' });
    const endButton = page.locator('button').filter({ hasText: '2025-09-30' });
    
    await expect(startButton).toBeVisible();
    await expect(endButton).toBeVisible();
  });

  test('should show appropriate tick scale for different date ranges', async ({ page }) => {
    // Test with a multi-year range
    await page.click('button:has-text("Set Start")');
    let startInput = page.locator('input[type="date"].inline-date-input').first();
    await expect(startInput).toBeVisible({ timeout: 2000 });
    await startInput.fill('2023-01-01');
    await startInput.dispatchEvent('change');
    await page.waitForTimeout(300);
    
    await page.click('button:has-text("Set End")');
    let endInput = page.locator('input[type="date"].inline-date-input').last();
    await expect(endInput).toBeVisible({ timeout: 2000 });
    await endInput.fill('2027-12-31');
    await endInput.dispatchEvent('change');
    await page.waitForTimeout(300);
    
    // Check for year ticks (should contain just year numbers like "2024", "2025")
    const tickLabels = page.locator('.tick-label');
    const firstLabelText = await tickLabels.first().textContent();
    
    // For multi-year timeline, we expect year labels
    expect(firstLabelText).toMatch(/^\d{4}$/);
  });

  test('should handle updating existing timeline dates', async ({ page }) => {
    // Set initial dates
    await page.click('button:has-text("Set Start")');
    let startInput = page.locator('input[type="date"].inline-date-input').first();
    await expect(startInput).toBeVisible({ timeout: 2000 });
    await startInput.fill('2025-01-01');
    await startInput.dispatchEvent('change');
    await page.waitForTimeout(300);
    
    await page.click('button:has-text("Set End")');
    let endInput = page.locator('input[type="date"].inline-date-input').last();
    await expect(endInput).toBeVisible({ timeout: 2000 });
    await endInput.fill('2025-06-30');
    await endInput.dispatchEvent('change');
    await page.waitForTimeout(500);
    
    // Update start date
    await page.locator('button').filter({ hasText: '2025-01-01' }).click();
    startInput = page.locator('input[type="date"].inline-date-input').first();
    await expect(startInput).toBeVisible({ timeout: 2000 });
    await startInput.fill('2025-02-01');
    await startInput.dispatchEvent('change');
    await page.waitForTimeout(500);
    
    // Verify the updated date is displayed
    const updatedButton = page.locator('button').filter({ hasText: '2025-02-01' });
    await expect(updatedButton).toBeVisible();
  });
});
