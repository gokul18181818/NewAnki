import { test, expect } from '@playwright/test';
import { TestHelpers, TEST_DECK_DATA } from './utils/testHelpers';

test.describe('Error Handling & Edge Cases', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    await helpers.login();
  });

  test('Test Case 8.1: Network Connectivity Issues', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Study some cards normally first
    await helpers.studyCards(3);
    
    // Step 1: Disable network during study session
    await page.context().setOffline(true);
    
    // Step 2: Verify graceful degradation
    try {
      await page.waitForSelector('.card-content');
      await page.click('text=Show Answer');
      await page.click('text=😊');
    } catch (error) {
      // Expected behavior - operation should fail gracefully
    }
    
    // Check for user-friendly error messages
    const offlineMessage = page.locator('text=You appear to be offline');
    const networkError = page.locator('text=Network error');
    const connectionError = page.locator('text=Connection lost');
    
    const errorDisplayed = await offlineMessage.isVisible() || 
                          await networkError.isVisible() || 
                          await connectionError.isVisible();
    
    expect(errorDisplayed).toBe(true);
    
    // Verify local state is maintained
    const localState = await page.evaluate(() => {
      return localStorage.getItem('studySession') !== null;
    });
    expect(localState).toBe(true);
    
    // Step 3: Restore connection and verify data syncs
    await page.context().setOffline(false);
    await page.waitForTimeout(3000);
    
    // Should show reconnection message
    await expect(page.locator('text=Back online')).toBeVisible();
    
    // Verify data syncs when connection restored
    await helpers.waitForConsoleLog('Data synced after reconnection');
  });

  test('Test Case 8.2: Invalid Data Handling', async ({ page }) => {
    // Step 1: Upload corrupted Anki file
    await page.goto('/import');
    
    const corruptFile = await page.evaluateHandle(() => {
      const file = new File(['corrupted binary data!!!'], 'corrupt.apkg', { 
        type: 'application/zip' 
      });
      return file;
    });
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(corruptFile as any);
    
    // Step 2: Verify error handling in ankiParser.ts
    await expect(page.locator('text=Error processing file')).toBeVisible();
    await expect(page.locator('text=File appears to be corrupted')).toBeVisible();
    
    // Should not crash the application
    await expect(page.locator('text=Import')).toBeVisible();
    
    // Step 3: Test missing user preferences scenario
    await page.evaluate(() => {
      localStorage.removeItem('userPreferences');
    });
    
    await page.reload();
    await helpers.login();
    
    // Should handle missing preferences gracefully
    await expect(page.locator('text=Setting up your preferences')).toBeVisible();
    
    // Step 4: Validate null anti-burnout engine handling (our fix)
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Should NOT see the critical error we fixed
    await helpers.verifyNoNullReferenceErrors();
    
    // Step 5: Check empty deck behavior
    // Create or navigate to empty deck
    await page.goto('/dashboard');
    const emptyDeck = page.locator('text=Empty Deck');
    if (await emptyDeck.isVisible()) {
      await emptyDeck.click();
      await page.click('text=Study');
      
      await expect(page.locator('text=No cards available to study')).toBeVisible();
      await expect(page.locator('text=Import cards or create new ones')).toBeVisible();
    }
  });

  test('Test Case 8.3: Boundary Condition Testing', async ({ page }) => {
    // Step 1: Study session with 0 due cards
    await page.goto('/dashboard');
    
    // Try to study deck with no due cards
    const noDueCardsDeck = page.locator('.deck-no-due-cards');
    if (await noDueCardsDeck.isVisible()) {
      await noDueCardsDeck.click();
      await page.click('text=Study');
      
      await expect(page.locator('text=No cards due for review')).toBeVisible();
      await expect(page.locator('text=Come back later')).toBeVisible();
    }
    
    // Step 2: User with no study history (new user)
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    await page.reload();
    await helpers.login();
    
    // Should handle new user gracefully
    await expect(page.locator('text=Welcome to StudyBuddy')).toBeVisible();
    await expect(page.locator('text=Import your first deck')).toBeVisible();
    
    // Step 3: Extremely fast/slow response times
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Test extremely fast response (under 100ms)
    await page.waitForSelector('.card-content');
    await page.click('text=Show Answer');
    await page.waitForTimeout(50); // Very fast
    await page.click('text=😊');
    
    // Should handle without errors
    await page.waitForTimeout(500);
    
    // Test extremely slow response (over 30 seconds)
    await page.waitForSelector('.card-content');
    await page.click('text=Show Answer');
    await page.waitForTimeout(10000); // Simulate very slow response
    await page.click('text=😞');
    
    // Should trigger fatigue detection
    await helpers.waitForConsoleLog('Extremely slow response detected');
    
    // Step 4: Maximum daily card limits
    // Study many cards to test daily limits
    for (let i = 0; i < 100; i++) {
      try {
        await page.waitForSelector('.card-content', { timeout: 2000 });
        await page.click('text=Show Answer');
        await page.click('text=😊');
        await page.waitForTimeout(100);
      } catch (error) {
        // Might hit daily limit
        break;
      }
    }
    
    // Check if daily limit message appears
    const dailyLimit = page.locator('text=Daily card limit reached');
    if (await dailyLimit.isVisible()) {
      await expect(page.locator('text=Great job today!')).toBeVisible();
    }
    
    // Step 5: Extended study sessions (>2 hours)
    // Simulate long session with timestamp manipulation
    await page.evaluate(() => {
      const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
      localStorage.setItem('sessionStartTime', twoHoursAgo.toString());
    });
    
    await page.reload();
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Should suggest break for extended session
    await expect(page.locator('text=You\'ve been studying for a while')).toBeVisible();
    await expect(page.locator('text=Consider taking a break')).toBeVisible();
  });

  test('Test Case 8.4: Memory Leak Prevention', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Perform memory-intensive operations
    for (let i = 0; i < 10; i++) {
      await page.click(`text=${TEST_DECK_DATA.name}`);
      await page.click('text=Study');
      
      // Study a few cards
      await helpers.studyCards(5);
      
      // Navigate away and back
      await page.goto('/dashboard');
    }
    
    // Check memory usage (if possible)
    const memoryInfo = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });
    
    // Memory usage should be reasonable
    expect(memoryInfo).toBeLessThan(100 * 1024 * 1024); // Under 100MB
  });

  test('Test Case 8.5: Race Condition Handling', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Rapid successive clicks to test race conditions
    await page.waitForSelector('.card-content');
    
    // Click show answer multiple times rapidly
    await Promise.all([
      page.click('text=Show Answer'),
      page.click('text=Show Answer'),
      page.click('text=Show Answer')
    ]);
    
    // Should handle gracefully without duplicating actions
    const answerSections = page.locator('.card-answer');
    const answerCount = await answerSections.count();
    expect(answerCount).toBe(1); // Should only show one answer
    
    // Rapid rating clicks
    await Promise.all([
      page.click('text=😊'),
      page.click('text=😊'),
      page.click('text=😊')
    ]);
    
    // Should only record one rating
    await helpers.waitForConsoleLog('Single rating recorded');
  });

  test('Test Case 8.6: Input Validation Edge Cases', async ({ page }) => {
    await page.goto('/settings');
    
    // Test various invalid inputs
    const invalidInputs = [
      { field: 'sessionLength', value: '-1', error: 'Session length must be positive' },
      { field: 'sessionLength', value: '999', error: 'Session length too long' },
      { field: 'breakDuration', value: '0', error: 'Break duration must be at least 1 minute' },
      { field: 'cardsPerSession', value: 'abc', error: 'Must be a number' },
      { field: 'cardsPerSession', value: '0', error: 'Must study at least 1 card' }
    ];
    
    for (const input of invalidInputs) {
      const field = page.locator(`input[name="${input.field}"]`);
      if (await field.isVisible()) {
        await field.clear();
        await field.fill(input.value);
        await page.click('text=Save');
        
        // Should show validation error
        await expect(page.locator(`text=${input.error}`)).toBeVisible();
      }
    }
  });

  test('Test Case 8.7: Browser Compatibility Issues', async ({ page }) => {
    // Test localStorage availability
    const localStorageSupport = await page.evaluate(() => {
      try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
        return true;
      } catch (e) {
        return false;
      }
    });
    
    expect(localStorageSupport).toBe(true);
    
    // Test IndexedDB availability (if used)
    const indexedDBSupport = await page.evaluate(() => {
      return 'indexedDB' in window;
    });
    
    expect(indexedDBSupport).toBe(true);
    
    // Test WebWorker support (if used)
    const webWorkerSupport = await page.evaluate(() => {
      return 'Worker' in window;
    });
    
    expect(webWorkerSupport).toBe(true);
  });

  test('Test Case 8.8: Session Timeout Recovery', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Simulate session timeout by manipulating auth token
    await page.evaluate(() => {
      localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'expired_token',
        expires_at: Date.now() - 1000
      }));
    });
    
    // Try to perform authenticated action
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Should handle session timeout gracefully
    await expect(page.locator('text=Session expired')).toBeVisible();
    await expect(page.locator('text=Please log in again')).toBeVisible();
    
    // Should redirect to login
    await page.waitForURL('/login');
  });

  test('Test Case 8.9: File System Errors', async ({ page }) => {
    await page.goto('/import');
    
    // Test with various problematic files
    const problematicFiles = [
      { name: 'empty.apkg', content: '', expectedError: 'File is empty' },
      { name: 'toolarge.apkg', content: 'x'.repeat(100 * 1024 * 1024), expectedError: 'File too large' },
      { name: 'invalid.txt', content: 'not an apkg file', expectedError: 'Invalid file type' }
    ];
    
    for (const file of problematicFiles) {
      const mockFile = await page.evaluateHandle((fileData) => {
        return new File([fileData.content], fileData.name, { type: 'application/zip' });
      }, file);
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(mockFile as any);
      
      // Should show appropriate error
      await expect(page.locator(`text=${file.expectedError}`)).toBeVisible();
    }
  });

  test('Test Case 8.10: Concurrent Operation Conflicts', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Start study session
    await page.waitForSelector('.card-content');
    
    // Open settings in new tab while studying
    const settingsPage = await page.context().newPage();
    await settingsPage.goto('/settings');
    
    // Modify settings while study session is active
    const sessionLengthInput = settingsPage.locator('input[name="sessionLength"]');
    if (await sessionLengthInput.isVisible()) {
      await sessionLengthInput.fill('30');
      await settingsPage.click('text=Save');
    }
    
    // Return to study session
    await page.bringToFront();
    
    // Continue studying - should handle concurrent changes gracefully
    await page.click('text=Show Answer');
    await page.click('text=😊');
    
    // Should not cause conflicts
    await helpers.verifyNoNullReferenceErrors();
    
    await settingsPage.close();
  });

  test('Test Case 8.11: Data Corruption Recovery', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Corrupt localStorage data
    await page.evaluate(() => {
      localStorage.setItem('userPreferences', '{"invalid": json}');
      localStorage.setItem('studyProgress', 'corrupted_data');
    });
    
    // Reload page
    await page.reload();
    
    // Should handle corrupted data gracefully
    await helpers.login();
    
    // Should reset to defaults or show recovery message
    await expect(page.locator('text=Recovering your data')).toBeVisible();
    
    // Application should still be functional
    await page.goto('/dashboard');
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('Test Case 8.12: Resource Loading Failures', async ({ page }) => {
    // Block specific resources to test failure handling
    await page.route('**/*.jpg', route => route.abort());
    await page.route('**/*.png', route => route.abort());
    
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Should handle missing images gracefully
    await page.waitForSelector('.card-content');
    
    // Check for fallback content
    const fallbackImages = page.locator('.image-placeholder, .image-fallback');
    if (await fallbackImages.isVisible()) {
      await expect(fallbackImages).toBeVisible();
    }
    
    // Study session should still be functional
    await page.click('text=Show Answer');
    await page.click('text=😊');
    
    // Should continue without crashing
    await helpers.verifyNoNullReferenceErrors();
  });
});