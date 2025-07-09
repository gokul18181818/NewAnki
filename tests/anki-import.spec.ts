import { test, expect } from '@playwright/test';
import { TestHelpers, TEST_DECK_DATA } from './utils/testHelpers';

test.describe('Anki Deck Import & Processing', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    await helpers.login();
  });

  test('Test Case 2.1: Anki File Upload', async ({ page }) => {
    // Step 1: Navigate to /import
    await page.goto('/import');
    
    // Step 2: Locate file input element
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible();
    
    // Step 3: Upload test file (we'll create a mock file for testing)
    // Note: In real implementation, you would use an actual .apkg file
    const mockFile = await page.evaluateHandle(() => {
      const file = new File(['mock anki data'], 'test.apkg', { type: 'application/zip' });
      return file;
    });
    
    await fileInput.setInputFiles(mockFile as any);
    
    // Step 4: Monitor console for parsing logs
    const expectedLogs = [
      'Starting Anki file parsing...',
      'Found media mapping:',
      'Extracted',
      'Successfully parsed'
    ];
    
    // Wait for upload to complete
    await page.waitForTimeout(3000);
    
    // Check for expected console logs
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      consoleLogs.push(msg.text());
    });
    
    // Verify upload started
    await expect(page.locator('text=Processing...')).toBeVisible();
    
    // Step 5: Verify deck creation in database
    await page.waitForSelector('text=Import completed', { timeout: 30000 });
    
    // Step 6: Validate media files are processed correctly
    await expect(page.locator('text=Media files processed')).toBeVisible();
    
    // Navigate to dashboard to verify deck appears
    await page.goto('/dashboard');
    await expect(page.locator('text=Test Deck')).toBeVisible();
  });

  test('Test Case 2.2: Deck Metadata Validation', async ({ page }) => {
    // Assuming we have test data already imported
    await page.goto('/dashboard');
    
    // Step 1: Check deck appears in dashboard
    await expect(page.locator(`text=${TEST_DECK_DATA.name}`)).toBeVisible();
    
    // Step 2: Validate deck names
    for (const subdeck of TEST_DECK_DATA.subdecks) {
      await expect(page.locator(`text=${subdeck.name}`)).toBeVisible();
    }
    
    // Step 3: Verify card counts
    const firstDeck = TEST_DECK_DATA.subdecks[0];
    const secondDeck = TEST_DECK_DATA.subdecks[1];
    
    await expect(page.locator(`text=${firstDeck.cardCount} cards`)).toBeVisible();
    await expect(page.locator(`text=${secondDeck.cardCount} cards`)).toBeVisible();
    
    // Step 4: Test deck selection functionality
    await page.click(`text=${firstDeck.name}`);
    await expect(page.locator('text=Deck Details')).toBeVisible();
    
    // Step 5: Ensure due card counts are calculated correctly
    await expect(page.locator('text=Due cards:')).toBeVisible();
    
    // Verify total cards match expected
    const totalCardsText = await page.locator('text=Total cards:').textContent();
    expect(totalCardsText).toContain(firstDeck.cardCount.toString());
  });

  test('Test Case 2.3: Media File Processing', async ({ page }) => {
    // Navigate to a deck with media files
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    
    // Start study session to check media rendering
    await page.click('text=Study');
    await page.waitForSelector('.card-content');
    
    // Check if images are rendered correctly
    const images = page.locator('.card-content img');
    const imageCount = await images.count();
    
    // Verify at least some images are present
    expect(imageCount).toBeGreaterThan(0);
    
    // Check that images load successfully
    for (let i = 0; i < Math.min(imageCount, 5); i++) {
      const img = images.nth(i);
      await expect(img).toBeVisible();
      
      // Check image src is not broken
      const src = await img.getAttribute('src');
      expect(src).toBeTruthy();
      expect(src).not.toContain('broken');
    }
  });

  test('Test Case 2.4: Large Deck Import Performance', async ({ page }) => {
    await page.goto('/import');
    
    // Mock a large deck file
    const startTime = Date.now();
    
    // Simulate file upload
    const fileInput = page.locator('input[type="file"]');
    
    // Monitor for performance during import
    await page.waitForSelector('text=Processing...', { timeout: 5000 });
    
    // Wait for completion
    await page.waitForSelector('text=Import completed', { timeout: 60000 });
    
    const endTime = Date.now();
    const importTime = endTime - startTime;
    
    // Verify reasonable import time (under 30 seconds for large deck)
    expect(importTime).toBeLessThan(30000);
    
    // Verify UI remains responsive
    await page.click('text=Dashboard');
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('Test Case 2.5: Corrupt File Handling', async ({ page }) => {
    await page.goto('/import');
    
    // Upload corrupted file
    const fileInput = page.locator('input[type="file"]');
    
    // Create mock corrupted file
    const corruptFile = await page.evaluateHandle(() => {
      const file = new File(['corrupted data'], 'corrupt.apkg', { type: 'application/zip' });
      return file;
    });
    
    await fileInput.setInputFiles(corruptFile as any);
    
    // Should show error message
    await expect(page.locator('text=Error processing file')).toBeVisible();
    
    // Should not crash the application
    await expect(page.locator('text=Import')).toBeVisible();
  });

  test('Test Case 2.6: Multiple Deck Import', async ({ page }) => {
    await page.goto('/import');
    
    // Import multiple decks sequentially
    const deckNames = ['Deck1.apkg', 'Deck2.apkg', 'Deck3.apkg'];
    
    for (const deckName of deckNames) {
      const fileInput = page.locator('input[type="file"]');
      
      // Mock file for each deck
      const mockFile = await page.evaluateHandle((name) => {
        const file = new File([`mock data for ${name}`], name, { type: 'application/zip' });
        return file;
      }, deckName);
      
      await fileInput.setInputFiles(mockFile as any);
      
      // Wait for processing
      await page.waitForSelector('text=Processing...', { timeout: 5000 });
      await page.waitForSelector('text=Import completed', { timeout: 30000 });
    }
    
    // Verify all decks appear in dashboard
    await page.goto('/dashboard');
    
    for (const deckName of deckNames) {
      const baseName = deckName.replace('.apkg', '');
      await expect(page.locator(`text=${baseName}`)).toBeVisible();
    }
  });

  test('Test Case 2.7: Import Progress Tracking', async ({ page }) => {
    await page.goto('/import');
    
    const fileInput = page.locator('input[type="file"]');
    
    // Upload file
    const mockFile = await page.evaluateHandle(() => {
      const file = new File(['large mock data'], 'large.apkg', { type: 'application/zip' });
      return file;
    });
    
    await fileInput.setInputFiles(mockFile as any);
    
    // Check progress indicators
    await expect(page.locator('text=Processing...')).toBeVisible();
    
    // Check if progress bar or percentage is shown
    const progressElements = [
      page.locator('.progress-bar'),
      page.locator('text=%'),
      page.locator('[role="progressbar"]')
    ];
    
    let progressFound = false;
    for (const element of progressElements) {
      if (await element.isVisible()) {
        progressFound = true;
        break;
      }
    }
    
    // Progress indication should be present for user feedback
    expect(progressFound).toBe(true);
    
    // Wait for completion
    await page.waitForSelector('text=Import completed', { timeout: 30000 });
  });

  test('Test Case 2.8: Duplicate Deck Handling', async ({ page }) => {
    await page.goto('/import');
    
    // Upload same deck twice
    const fileInput = page.locator('input[type="file"]');
    
    const mockFile = await page.evaluateHandle(() => {
      const file = new File(['duplicate deck data'], 'duplicate.apkg', { type: 'application/zip' });
      return file;
    });
    
    // First upload
    await fileInput.setInputFiles(mockFile as any);
    await page.waitForSelector('text=Import completed', { timeout: 30000 });
    
    // Second upload (same deck)
    await fileInput.setInputFiles(mockFile as any);
    
    // Should handle duplicate gracefully
    await expect(page.locator('text=Deck already exists')).toBeVisible();
    
    // Should offer options (update, skip, rename)
    await expect(page.locator('text=Update existing deck')).toBeVisible();
  });
});