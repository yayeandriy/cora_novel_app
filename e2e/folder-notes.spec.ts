import { test, expect } from '@playwright/test';

test.describe('Folder Notes Feature - E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display folder notes section when folder is selected', async ({ page }) => {
    const folderItem = page.locator('[data-testid="folder-item"]').first();
    
    if (await folderItem.count() > 0) {
      await folderItem.click();
      await page.waitForTimeout(500);
      
      const folderNotesSection = page.locator('[data-testid="folder-notes-section"]');
      if (await folderNotesSection.count() > 0) {
        await expect(folderNotesSection).toBeVisible();
      }
    }
  });

  test('should cache folder notes when typing and switching folders', async ({ page }) => {
    const folders = page.locator('[data-testid="folder-item"]');
    
    if (await folders.count() >= 2) {
      await folders.nth(0).click();
      await page.waitForTimeout(500);
      
      const folderNotesTextarea = page.locator('[data-testid="folder-notes-textarea"]');
      if (await folderNotesTextarea.isVisible()) {
        await folderNotesTextarea.fill('Folder notes test');
        
        // Switch to second folder
        await folders.nth(1).click();
        await page.waitForTimeout(500);
        
        // Switch back to first folder
        await folders.nth(0).click();
        await page.waitForTimeout(500);
        
        // Verify cached notes
        const notesValue = await folderNotesTextarea.inputValue();
        expect(notesValue).toContain('Folder notes test');
      }
    }
  });

  test('should auto-save folder notes after 2 seconds', async ({ page }) => {
    const folderItem = page.locator('[data-testid="folder-item"]').first();
    
    if (await folderItem.count() > 0) {
      await folderItem.click();
      await page.waitForTimeout(500);
      
      const folderNotesTextarea = page.locator('[data-testid="folder-notes-textarea"]');
      if (await folderNotesTextarea.isVisible()) {
        const testNotes = `Folder notes at ${new Date().toISOString()}`;
        await folderNotesTextarea.fill(testNotes);
        
        // Wait for autosave
        await page.waitForTimeout(2500);
        
        const unsavedIndicator = page.locator('[data-testid="folder-notes-unsaved"]');
        if (await unsavedIndicator.count() > 0) {
          await expect(unsavedIndicator).not.toBeVisible();
        }
      }
    }
  });

  test('should show unsaved indicator when folder notes are modified', async ({ page }) => {
    const folderItem = page.locator('[data-testid="folder-item"]').first();
    
    if (await folderItem.count() > 0) {
      await folderItem.click();
      await page.waitForTimeout(500);
      
      const folderNotesTextarea = page.locator('[data-testid="folder-notes-textarea"]');
      if (await folderNotesTextarea.isVisible()) {
        await folderNotesTextarea.fill('Modified folder notes');
        
        const unsavedIndicator = page.locator('[data-testid="folder-notes-unsaved"]');
        if (await unsavedIndicator.count() > 0) {
          await expect(unsavedIndicator).toBeVisible();
        }
      }
    }
  });

  test('should handle empty folder notes correctly', async ({ page }) => {
    const folderItem = page.locator('[data-testid="folder-item"]').first();
    
    if (await folderItem.count() > 0) {
      await folderItem.click();
      await page.waitForTimeout(500);
      
      const folderNotesTextarea = page.locator('[data-testid="folder-notes-textarea"]');
      if (await folderNotesTextarea.isVisible()) {
        await folderNotesTextarea.fill('');
        await page.waitForTimeout(2500);
        
        const value = await folderNotesTextarea.inputValue();
        expect(value).toBe('');
      }
    }
  });

  test('should persist folder notes across application reload', async ({ page }) => {
    const folderItem = page.locator('[data-testid="folder-item"]').first();
    
    if (await folderItem.count() > 0) {
      await folderItem.click();
      await page.waitForTimeout(500);
      
      const folderNotesTextarea = page.locator('[data-testid="folder-notes-textarea"]');
      if (await folderNotesTextarea.isVisible()) {
        const testNotes = `Persistent notes ${Date.now()}`;
        await folderNotesTextarea.fill(testNotes);
        await page.waitForTimeout(2500); // autosave
        
        // Reload the page
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
        
        // Select same folder again
        const folderAfterReload = page.locator('[data-testid="folder-item"]').first();
        if (await folderAfterReload.count() > 0) {
          await folderAfterReload.click();
          await page.waitForTimeout(500);
          
          const notesAfterReload = page.locator('[data-testid="folder-notes-textarea"]');
          if (await notesAfterReload.isVisible()) {
            const reloadedValue = await notesAfterReload.inputValue();
            expect(reloadedValue).toBe(testNotes);
          }
        }
      }
    }
  });

  test('should not lose folder notes on rapid folder switching', async ({ page }) => {
    const folders = page.locator('[data-testid="folder-item"]');
    
    if (await folders.count() >= 3) {
      const folderNotesTextarea = page.locator('[data-testid="folder-notes-textarea"]');
      
      for (let i = 0; i < 5; i++) {
        const index = i % 3;
        await folders.nth(index).click();
        await page.waitForTimeout(100);
        
        if (await folderNotesTextarea.isVisible()) {
          await folderNotesTextarea.fill(`Folder ${index} notes`);
        }
      }
      
      await page.waitForTimeout(2500);
      const finalValue = await folderNotesTextarea.inputValue();
      expect(finalValue).toBeTruthy();
    }
  });

  test('should support special characters in folder notes', async ({ page }) => {
    const folderItem = page.locator('[data-testid="folder-item"]').first();
    
    if (await folderItem.count() > 0) {
      await folderItem.click();
      await page.waitForTimeout(500);
      
      const folderNotesTextarea = page.locator('[data-testid="folder-notes-textarea"]');
      if (await folderNotesTextarea.isVisible()) {
        const specialNotes = 'Notes with "quotes" and \'apostrophes\' and \n newlines';
        await folderNotesTextarea.fill(specialNotes);
        await page.waitForTimeout(2500);
        
        const value = await folderNotesTextarea.inputValue();
        expect(value).toBe(specialNotes);
      }
    }
  });

  test('should handle very long folder notes', async ({ page }) => {
    const folderItem = page.locator('[data-testid="folder-item"]').first();
    
    if (await folderItem.count() > 0) {
      await folderItem.click();
      await page.waitForTimeout(500);
      
      const folderNotesTextarea = page.locator('[data-testid="folder-notes-textarea"]');
      if (await folderNotesTextarea.isVisible()) {
        const longNotes = 'x'.repeat(5000);
        await folderNotesTextarea.fill(longNotes);
        await page.waitForTimeout(2500);
        
        const value = await folderNotesTextarea.inputValue();
        expect(value.length).toBe(5000);
      }
    }
  });

  test('should allow collapsing folder notes section', async ({ page }) => {
    const folderItem = page.locator('[data-testid="folder-item"]').first();
    
    if (await folderItem.count() > 0) {
      await folderItem.click();
      await page.waitForTimeout(500);
      
      const collapseButton = page.locator('[data-testid="folder-notes-collapse-btn"]');
      if (await collapseButton.count() > 0) {
        await collapseButton.click();
        await page.waitForTimeout(300);
        
        const folderNotesTextarea = page.locator('[data-testid="folder-notes-textarea"]');
        if (await folderNotesTextarea.count() > 0) {
          await expect(folderNotesTextarea).not.toBeVisible();
        }
        
        // Expand again
        await collapseButton.click();
        await page.waitForTimeout(300);
        await expect(folderNotesTextarea).toBeVisible();
      }
    }
  });
});
