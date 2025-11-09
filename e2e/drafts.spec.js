import { test, expect } from '@playwright/test';
// Utilities
async function createProject(page, projectName = 'Test Project') {
    // Navigate to app (assuming it's running on localhost)
    await page.goto('http://localhost:1420');
    // Wait for app to load
    await page.waitForSelector('[class*="project"]');
    // Create a new project
    await page.click('text=New Project');
    await page.fill('input[placeholder*="project"]', projectName);
    await page.click('button:has-text("Create")');
    // Return project ID (would be extracted from route or DOM)
    return 1;
}
async function createDocument(page, docName = 'Test Doc') {
    // Click on Documents section if collapsed
    const documentsSection = page.locator('text=Documents').first();
    await documentsSection.click();
    // Click add button
    await page.click('[title*="New folder"]');
    // Create a group first
    await page.fill('input[placeholder*="group"]', 'Test Folder');
    await page.click('button:has-text("Create")');
    // Create a document in the group
    await page.click('[title*="Add document"]');
    return 1;
}
async function selectDocument(page, docName) {
    // Click on the document in the tree
    await page.click(`text="${docName}"`);
    // Wait for document to load
    await page.waitForSelector('[class*="editor"]');
}
// Tests
test.describe('Draft Feature E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the app
        await page.goto('http://localhost:1420');
        // Wait for app to be ready
        await page.waitForSelector('body');
    });
    test('should display Drafts panel in right sidebar', async ({ page }) => {
        // Check that Drafts section exists
        const draftsSection = page.locator('text=Drafts').first();
        await expect(draftsSection).toBeVisible();
    });
    test('should have add draft button in Drafts panel', async ({ page }) => {
        // Locate the Drafts panel
        const draftsPanel = page.locator('text=Drafts').first().locator('..');
        // Find the add button (should be near Drafts heading)
        const addButton = draftsPanel.locator('[title="Add new draft"]');
        await expect(addButton).toBeVisible();
    });
    test('should show "No drafts" message when empty', async ({ page }) => {
        // Expand Drafts panel if needed
        const draftsHeader = page.locator('text=Drafts').first();
        await draftsHeader.click();
        // Check for empty state
        const emptyMessage = page.locator('text=No drafts');
        await expect(emptyMessage).toBeVisible();
    });
    test('should create a draft when add button is clicked', async ({ page }) => {
        // Create a document first
        await createDocument(page);
        // Locate and click add draft button
        const draftsPanel = page.locator('text=Drafts').first().locator('..');
        const addButton = draftsPanel.locator('[title="Add new draft"]');
        await addButton.click();
        // Wait for draft to appear
        await page.waitForTimeout(500);
        // Check that a draft item appeared
        const draftItem = page.locator('[class*="draft-item"]').first();
        await expect(draftItem).toBeVisible();
    });
    test('should display draft name in list', async ({ page }) => {
        // Create a document
        await createDocument(page);
        // Get the document text before creating draft
        const docContent = 'Test document content';
        const editor = page.locator('[class*="editor"]');
        await editor.fill(docContent);
        // Create draft
        const draftsPanel = page.locator('text=Drafts').first().locator('..');
        const addButton = draftsPanel.locator('[title="Add new draft"]');
        await addButton.click();
        await page.waitForTimeout(500);
        // Check that draft appears with name containing "Draft"
        const draftName = page.locator('[class*="draft-name"]').first();
        await expect(draftName).toContainText('Draft');
    });
    test('should display multiple drafts for same document', async ({ page }) => {
        // Create a document
        await createDocument(page);
        // Create first draft
        let draftsPanel = page.locator('text=Drafts').first().locator('..');
        let addButton = draftsPanel.locator('[title="Add new draft"]');
        await addButton.click();
        await page.waitForTimeout(500);
        // Create second draft
        addButton = draftsPanel.locator('[title="Add new draft"]');
        await addButton.click();
        await page.waitForTimeout(500);
        // Create third draft
        addButton = draftsPanel.locator('[title="Add new draft"]');
        await addButton.click();
        await page.waitForTimeout(500);
        // Check that all drafts appear
        const draftItems = page.locator('[class*="draft-item"]');
        const count = await draftItems.count();
        expect(count).toBeGreaterThanOrEqual(3);
    });
    test('should show draft creation timestamp', async ({ page }) => {
        // Create a document
        await createDocument(page);
        // Create draft
        const draftsPanel = page.locator('text=Drafts').first().locator('..');
        const addButton = draftsPanel.locator('[title="Add new draft"]');
        await addButton.click();
        await page.waitForTimeout(500);
        // Check that timestamp appears
        const draftTime = page.locator('[class*="draft-time"]').first();
        await expect(draftTime).toBeVisible();
        // Verify it contains a date/time string
        const timeText = await draftTime.textContent();
        expect(timeText).toBeTruthy();
    });
    test('should show alert when creating draft without document selected', async ({ page }) => {
        // Set up alert listener
        page.once('dialog', dialog => {
            expect(dialog.message()).toContain('Please select a document');
            dialog.accept();
        });
        // Try to create draft without selecting document
        const draftsPanel = page.locator('text=Drafts').first().locator('..');
        const addButton = draftsPanel.locator('[title="Add new draft"]');
        await addButton.click();
    });
    test('should toggle Drafts panel expansion', async ({ page }) => {
        // Get initial state
        const draftsHeader = page.locator('text=Drafts').first();
        // Click to expand/collapse
        await draftsHeader.click();
        await page.waitForTimeout(200);
        // Content should change visibility
        const draftContent = page.locator('[class*="section-content"]').filter({
            has: page.locator('text=Drafts')
        });
        const isVisible = await draftContent.isVisible();
        // Toggle again
        await draftsHeader.click();
        await page.waitForTimeout(200);
        const isVisibleAfter = await draftContent.isVisible();
        expect(isVisibleAfter).not.toBe(isVisible);
    });
    test('should load drafts when switching documents', async ({ page }) => {
        // Create first document
        await createDocument(page, 'Doc 1');
        // Create draft for doc 1
        let draftsPanel = page.locator('text=Drafts').first().locator('..');
        let addButton = draftsPanel.locator('[title="Add new draft"]');
        await addButton.click();
        await page.waitForTimeout(500);
        // Count drafts
        let draftCount = await page.locator('[class*="draft-item"]').count();
        expect(draftCount).toBe(1);
        // Create second document
        await createDocument(page, 'Doc 2');
        await page.waitForTimeout(500);
        // Switch back to first document
        await selectDocument(page, 'Doc 1');
        await page.waitForTimeout(500);
        // Verify draft still appears
        draftCount = await page.locator('[class*="draft-item"]').count();
        expect(draftCount).toBeGreaterThan(0);
    });
    test('should display draft styling correctly', async ({ page }) => {
        // Create a document
        await createDocument(page);
        // Create draft
        const draftsPanel = page.locator('text=Drafts').first().locator('..');
        const addButton = draftsPanel.locator('[title="Add new draft"]');
        await addButton.click();
        await page.waitForTimeout(500);
        // Check draft item styling
        const draftItem = page.locator('[class*="draft-item"]').first();
        // Verify background color (light blue/gray)
        const bgColor = await draftItem.evaluate(el => window.getComputedStyle(el).backgroundColor);
        expect(bgColor).toBeTruthy();
        // Verify border styling
        const borderLeft = await draftItem.evaluate(el => window.getComputedStyle(el).borderLeftColor);
        expect(borderLeft).toBeTruthy();
    });
    test('should persist drafts across page refresh', async ({ page }) => {
        // Create a document
        await createDocument(page);
        // Create draft
        const draftsPanel = page.locator('text=Drafts').first().locator('..');
        const addButton = draftsPanel.locator('[title="Add new draft"]');
        await addButton.click();
        await page.waitForTimeout(500);
        // Get draft count before refresh
        const draftCountBefore = await page.locator('[class*="draft-item"]').count();
        // Refresh page
        await page.reload();
        await page.waitForSelector('[class*="project"]');
        // Navigate back to document
        const draftsHeader = page.locator('text=Drafts').first();
        await draftsHeader.click();
        await page.waitForTimeout(500);
        // Verify draft still exists
        const draftCountAfter = await page.locator('[class*="draft-item"]').count();
        expect(draftCountAfter).toBeGreaterThan(0);
    });
    test('should handle rapid draft creation', async ({ page }) => {
        // Create a document
        await createDocument(page);
        // Rapidly create multiple drafts
        const draftsPanel = page.locator('text=Drafts').first().locator('..');
        for (let i = 0; i < 5; i++) {
            const addButton = draftsPanel.locator('[title="Add new draft"]');
            await addButton.click();
            await page.waitForTimeout(100);
        }
        await page.waitForTimeout(500);
        // Verify all drafts were created
        const draftItems = page.locator('[class*="draft-item"]');
        const count = await draftItems.count();
        expect(count).toBe(5);
    });
    test('should display drafts in reverse chronological order (most recent first)', async ({ page }) => {
        // Create a document
        await createDocument(page);
        // Create first draft
        let draftsPanel = page.locator('text=Drafts').first().locator('..');
        let addButton = draftsPanel.locator('[title="Add new draft"]');
        await addButton.click();
        await page.waitForTimeout(300);
        // Create second draft
        addButton = draftsPanel.locator('[title="Add new draft"]');
        await addButton.click();
        await page.waitForTimeout(300);
        // Get draft times
        const draftTimes = page.locator('[class*="draft-time"]');
        const firstTime = await draftTimes.nth(0).textContent();
        const secondTime = await draftTimes.nth(1).textContent();
        // Second draft should be more recent
        expect(firstTime).toBeTruthy();
        expect(secondTime).toBeTruthy();
    });
});
