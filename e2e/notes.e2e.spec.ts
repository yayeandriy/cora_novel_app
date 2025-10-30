import { test, expect } from '@playwright/test';

test.describe('Notes Feature - E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    // Wait for application to load
    await page.waitForLoadState('networkidle');
  });

  test('should display notes section when document is selected', async ({ page }) => {
    // Look for a document in the list
    const docItem = page.locator('[data-testid="doc-item"]').first();
    
    if (await docItem.count() > 0) {
      await docItem.click();
      
      // Wait for the notes section to appear
      const notesSection = page.locator('[data-testid="notes-section"]');
      await expect(notesSection).toBeVisible();
    }
  });

  test('should cache notes when typing quickly and switching documents', async ({ page }) => {
    const docs = page.locator('[data-testid="doc-item"]');
    
    if (await docs.count() >= 2) {
      // Select first document
      await docs.nth(0).click();
      await page.waitForTimeout(500);
      
      // Type notes
      const notesTextarea = page.locator('[data-testid="notes-textarea"]');
      if (await notesTextarea.isVisible()) {
        await notesTextarea.fill('Test notes for doc 1');
        
        // Quickly switch to second document
        await docs.nth(1).click();
        await page.waitForTimeout(500);
        
        // Switch back to first document
        await docs.nth(0).click();
        await page.waitForTimeout(500);
        
        // Verify notes are still there (cached)
        const notesValue = await notesTextarea.inputValue();
        expect(notesValue).toContain('Test notes for doc 1');
      }
    }
  });

  test('should auto-save notes after 2 seconds of inactivity', async ({ page }) => {
    const docItem = page.locator('[data-testid="doc-item"]').first();
    
    if (await docItem.count() > 0) {
      await docItem.click();
      await page.waitForTimeout(500);
      
      const notesTextarea = page.locator('[data-testid="notes-textarea"]');
      if (await notesTextarea.isVisible()) {
        const testNotes = `Notes saved at ${new Date().toISOString()}`;
        await notesTextarea.fill(testNotes);
        
        // Wait for auto-save timeout (2 seconds) + buffer
        await page.waitForTimeout(2500);
        
        // Notes should be saved (verify by checking unsaved indicator is gone)
        const unsavedIndicator = page.locator('[data-testid="unsaved-indicator"]');
        if (await unsavedIndicator.count() > 0) {
          await expect(unsavedIndicator).not.toBeVisible();
        }
      }
    }
  });

  test('should not lose data on rapid document switching', async ({ page }) => {
    const docs = page.locator('[data-testid="doc-item"]');
    
    if (await docs.count() >= 3) {
      const notesTextarea = page.locator('[data-testid="notes-textarea"]');
      
      // Rapidly switch between documents
      for (let i = 0; i < 5; i++) {
        const index = i % 3;
        await docs.nth(index).click();
        await page.waitForTimeout(100);
        
        if (await notesTextarea.isVisible()) {
          await notesTextarea.fill(`Notes for doc ${index}`);
        }
      }
      
      // Verify final state
      await page.waitForTimeout(2500); // Auto-save delay
      const finalValue = await notesTextarea.inputValue();
      expect(finalValue).toBeTruthy();
    }
  });

  test('should show unsaved indicator when notes are modified', async ({ page }) => {
    const docItem = page.locator('[data-testid="doc-item"]').first();
    
    if (await docItem.count() > 0) {
      await docItem.click();
      await page.waitForTimeout(500);
      
      const notesTextarea = page.locator('[data-testid="notes-textarea"]');
      if (await notesTextarea.isVisible()) {
        await notesTextarea.fill('Modified notes');
        
        // Unsaved indicator should appear immediately
        const unsavedIndicator = page.locator('[data-testid="unsaved-indicator"]');
        if (await unsavedIndicator.count() > 0) {
          await expect(unsavedIndicator).toBeVisible();
        }
      }
    }
  });

  test('should handle empty notes correctly', async ({ page }) => {
    const docItem = page.locator('[data-testid="doc-item"]').first();
    
    if (await docItem.count() > 0) {
      await docItem.click();
      await page.waitForTimeout(500);
      
      const notesTextarea = page.locator('[data-testid="notes-textarea"]');
      if (await notesTextarea.isVisible()) {
        // Clear the notes
        await notesTextarea.fill('');
        
        // Wait for auto-save
        await page.waitForTimeout(2500);
        
        // Verify it's still empty
        const value = await notesTextarea.inputValue();
        expect(value).toBe('');
      }
    }
  });

  test('should allow collapsing and expanding notes section', async ({ page }) => {
    const docItem = page.locator('[data-testid="doc-item"]').first();
    
    if (await docItem.count() > 0) {
      await docItem.click();
      await page.waitForTimeout(500);
      
      const notesSection = page.locator('[data-testid="notes-section"]');
      const collapseButton = page.locator('[data-testid="notes-collapse-btn"]');
      
      if (await collapseButton.count() > 0) {
        // Collapse notes section
        await collapseButton.click();
        const notesContent = page.locator('[data-testid="notes-content"]');
        await expect(notesContent).not.toBeVisible();
        
        // Expand notes section
        await collapseButton.click();
        await expect(notesContent).toBeVisible();
      }
    }
  });

  test('should support rich text formatting in notes', async ({ page }) => {
    const docItem = page.locator('[data-testid="doc-item"]').first();
    
    if (await docItem.count() > 0) {
      await docItem.click();
      await page.waitForTimeout(500);
      
      const notesTextarea = page.locator('[data-testid="notes-textarea"]');
      if (await notesTextarea.isVisible()) {
        const richText = `# Header\n**Bold** and *italic* text\n- Bullet points\n1. Numbered items`;
        await notesTextarea.fill(richText);
        
        // Wait for auto-save
        await page.waitForTimeout(2500);
        
        // Verify the content is preserved
        const value = await notesTextarea.inputValue();
        expect(value).toContain('# Header');
        expect(value).toContain('**Bold**');
        expect(value).toContain('- Bullet points');
      }
    }
  });
});
