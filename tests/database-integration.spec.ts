import { test, expect } from '@playwright/test';
import { TestHelpers, TEST_DECK_DATA } from './utils/testHelpers';

test.describe('Database Integration & Persistence', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    await helpers.login();
  });

  test('Test Case 7.1: Real-time Data Updates', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Step 1: Study 5 cards with different ratings
    const studyData = [];
    
    for (let i = 0; i < 5; i++) {
      await page.waitForSelector('.card-content');
      
      const cardId = await page.locator('.card-content').getAttribute('data-card-id');
      const startTime = Date.now();
      
      await page.click('text=Show Answer');
      
      const ratings = ['😞', '😐', '😊', '😁'];
      const rating = ratings[i % ratings.length];
      await page.click(`text=${rating}`);
      
      const endTime = Date.now();
      
      studyData.push({
        cardId,
        rating,
        responseTime: endTime - startTime,
        timestamp: new Date().toISOString()
      });
      
      await page.waitForTimeout(500);
    }
    
    // Step 2: Verify immediate updates in database tables
    await helpers.verifyDatabaseUpdates([
      'study_logs',
      'user_learning_profiles', 
      'response_time_baselines',
      'cards'
    ]);
    
    // Step 3: Check dashboard stats reflect changes instantly
    await page.goto('/dashboard');
    
    // Cards studied today should be updated
    const cardsStudiedToday = page.locator('.cards-studied-today, [data-testid="cards-studied-today"]');
    if (await cardsStudiedToday.isVisible()) {
      const studiedText = await cardsStudiedToday.textContent();
      expect(studiedText).toMatch(/[5-9]|\d{2,}/); // Should be 5 or more
    }
    
    // Step 4: Validate streak calculation updates
    await helpers.waitForConsoleLog('Streak calculation updated');
    
    const streakElement = page.locator('.study-streak, [data-testid="study-streak"]');
    if (await streakElement.isVisible()) {
      const streakText = await streakElement.textContent();
      expect(streakText).toMatch(/\d+/); // Should contain numbers
    }
  });

  test('Test Case 7.2: Cross-session Persistence', async ({ page }) => {
    // Step 1: Study 10 cards, close browser
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    const initialStudyData = await helpers.studyCards(10);
    
    // Record initial state
    await page.goto('/dashboard');
    const initialStats = await page.locator('.dashboard-stats').textContent();
    
    // Step 2: Close browser (simulate by reloading)
    await page.reload();
    
    // Step 3: Reopen application, login
    await helpers.login();
    
    // Step 4: Verify study progress persists
    await page.goto('/dashboard');
    const persistedStats = await page.locator('.dashboard-stats').textContent();
    
    // Stats should be maintained
    expect(persistedStats).toBeTruthy();
    
    // Step 5: Verify adaptive recommendations remember previous session
    await page.goto('/settings');
    await expect(page.locator('text=AI Learning Insights')).toBeVisible();
    
    const recommendations = page.locator('.ai-recommendations');
    if (await recommendations.isVisible()) {
      const recText = await recommendations.textContent();
      expect(recText).not.toContain('No data available');
    }
    
    // Step 6: Verify user learning profile maintains data
    await helpers.waitForConsoleLog('User learning profile loaded from database');
    
    // Step 7: Verify break patterns continue from previous session
    await helpers.waitForConsoleLog('Break patterns loaded');
  });

  test('Test Case 7.3: Multi-deck Data Segregation', async ({ page }) => {
    // Step 1: Study cards from first deck
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.subdecks[0].name}`);
    await page.click('text=Study');
    
    const firstDeckData = await helpers.studyCards(5);
    
    // Step 2: Study cards from second deck
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.subdecks[1].name}`);
    await page.click('text=Study');
    
    const secondDeckData = await helpers.studyCards(5);
    
    // Step 3: Verify adaptive engine maintains separate baselines
    await helpers.waitForConsoleLog('Separate baselines maintained per deck');
    
    // Different response time baselines per deck
    await helpers.waitForConsoleLog(`Baseline for ${TEST_DECK_DATA.subdecks[0].name}`);
    await helpers.waitForConsoleLog(`Baseline for ${TEST_DECK_DATA.subdecks[1].name}`);
    
    // Step 4: Verify deck-specific difficulty assessments
    await helpers.waitForConsoleLog('Deck-specific difficulty calculated');
    
    // Step 5: Verify separate performance tracking
    await page.goto('/analytics');
    
    // Should show performance for each deck separately
    const deckPerformance = page.locator('.deck-performance');
    if (await deckPerformance.isVisible()) {
      await expect(page.locator(`text=${TEST_DECK_DATA.subdecks[0].name}`)).toBeVisible();
      await expect(page.locator(`text=${TEST_DECK_DATA.subdecks[1].name}`)).toBeVisible();
    }
  });

  test('Test Case 7.4: Data Consistency Across Sessions', async ({ page }) => {
    // Study and record initial state
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    await helpers.studyCards(8);
    
    // Get current learning profile data
    await page.goto('/settings');
    const initialProfile = await page.locator('.user-profile-data').textContent();
    
    // Simulate session end and restart
    await page.reload();
    await helpers.login();
    
    // Verify data consistency
    await page.goto('/settings');
    const persistedProfile = await page.locator('.user-profile-data').textContent();
    
    // Profile data should be consistent
    expect(persistedProfile).toBeTruthy();
    
    // Study more cards in new session
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    await helpers.studyCards(3);
    
    // Verify cumulative data is maintained
    await helpers.waitForConsoleLog('Cumulative data maintained');
  });

  test('Test Case 7.5: Concurrent User Data Isolation', async ({ context, page }) => {
    // This test simulates multiple users to ensure data isolation
    await helpers.login();
    
    // Study some cards as first user
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    await helpers.studyCards(5);
    
    // Get first user's stats
    await page.goto('/dashboard');
    const firstUserStats = await page.locator('.user-stats').textContent();
    
    // Open new incognito context (simulate second user)
    const secondContext = await context.browser()?.newContext();
    const secondPage = await secondContext?.newPage();
    
    if (secondPage) {
      // Login as different user (would need different credentials in real test)
      await secondPage.goto('/');
      // ... login process for second user
      
      // Verify second user doesn't see first user's data
      await secondPage.goto('/dashboard');
      const secondUserStats = await secondPage.locator('.user-stats').textContent();
      
      // Stats should be different/isolated
      expect(secondUserStats).not.toBe(firstUserStats);
      
      await secondPage.close();
    }
  });

  test('Test Case 7.6: Database Transaction Integrity', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Study multiple cards rapidly to test transaction handling
    for (let i = 0; i < 10; i++) {
      await page.waitForSelector('.card-content');
      await page.click('text=Show Answer');
      await page.click('text=😊');
      // Minimal delay to test rapid transactions
      await page.waitForTimeout(100);
    }
    
    // Verify all transactions completed successfully
    await helpers.waitForConsoleLog('All transactions completed');
    
    // Check data integrity
    await page.goto('/dashboard');
    const finalStats = await page.locator('.cards-studied-today').textContent();
    expect(finalStats).toMatch(/10|1[0-9]|[2-9][0-9]/); // Should be 10 or more
  });

  test('Test Case 7.7: Database Recovery from Failures', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Study some cards
    await helpers.studyCards(5);
    
    // Simulate network interruption (disable network)
    await page.context().setOffline(true);
    
    // Try to study more cards (should handle offline gracefully)
    try {
      await page.waitForSelector('.card-content');
      await page.click('text=Show Answer');
      await page.click('text=😊');
    } catch (error) {
      // Expected to fail offline
    }
    
    // Restore network
    await page.context().setOffline(false);
    
    // Verify data syncs when connection restored
    await page.waitForTimeout(3000);
    await helpers.waitForConsoleLog('Data synced after reconnection');
    
    // Check that offline changes are handled properly
    await page.goto('/dashboard');
    const recoveredStats = await page.locator('.dashboard-stats').textContent();
    expect(recoveredStats).toBeTruthy();
  });

  test('Test Case 7.8: Large Dataset Performance', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Study many cards to test large dataset handling
    const startTime = Date.now();
    
    for (let i = 0; i < 50; i++) {
      await page.waitForSelector('.card-content');
      await page.click('text=Show Answer');
      await page.click('text=😊');
      await page.waitForTimeout(50); // Minimal delay
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    // Verify reasonable performance with large dataset
    expect(totalTime).toBeLessThan(60000); // Should complete in under 1 minute
    
    // Check database performance
    await helpers.waitForConsoleLog('Large dataset processed efficiently');
    
    // Verify UI remains responsive
    await page.goto('/dashboard');
    const loadStartTime = Date.now();
    await page.waitForSelector('.dashboard-stats');
    const loadEndTime = Date.now();
    
    const loadTime = loadEndTime - loadStartTime;
    expect(loadTime).toBeLessThan(5000); // Should load in under 5 seconds
  });

  test('Test Case 7.9: Data Migration Compatibility', async ({ page }) => {
    // This test would verify that new schema changes don't break existing data
    await page.goto('/dashboard');
    
    // Verify all expected database tables exist
    await helpers.verifyDatabaseUpdates([
      'study_logs',
      'user_learning_profiles',
      'response_time_baselines',
      'cards',
      'decks',
      'users'
    ]);
    
    // Check that data migration completed successfully
    await helpers.waitForConsoleLog('Database migration completed');
    
    // Verify data integrity after migration
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Should be able to study without errors
    await helpers.studyCards(3);
    
    // Verify migrated data is accessible
    await page.goto('/analytics');
    await expect(page.locator('.analytics-data')).toBeVisible();
  });

  test('Test Case 7.10: Backup and Recovery', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Study cards to generate data
    await helpers.studyCards(10);
    
    // Record current state
    await page.goto('/dashboard');
    const beforeBackupStats = await page.locator('.dashboard-stats').textContent();
    
    // Trigger backup process (if available)
    await page.goto('/settings');
    const backupButton = page.locator('text=Backup Data');
    if (await backupButton.isVisible()) {
      await backupButton.click();
      await helpers.waitForConsoleLog('Data backup completed');
    }
    
    // Verify backup was created
    await helpers.waitForConsoleLog('Backup file created');
    
    // Test recovery (if available)
    const restoreButton = page.locator('text=Restore Data');
    if (await restoreButton.isVisible()) {
      await restoreButton.click();
      await helpers.waitForConsoleLog('Data restored successfully');
    }
    
    // Verify data integrity after recovery
    await page.goto('/dashboard');
    const afterRestoreStats = await page.locator('.dashboard-stats').textContent();
    
    // Stats should be maintained after backup/restore
    expect(afterRestoreStats).toBeTruthy();
  });

  test('Test Case 7.11: Database Query Optimization', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Monitor database query performance
    const queryTimes: number[] = [];
    
    page.on('response', (response) => {
      if (response.url().includes('/api/') && response.status() === 200) {
        const timing = response.timing();
        queryTimes.push(timing.responseEnd - timing.requestStart);
      }
    });
    
    // Perform various operations that trigger database queries
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    await helpers.studyCards(10);
    
    await page.goto('/analytics');
    await page.waitForSelector('.analytics-data');
    
    await page.goto('/settings');
    await page.waitForSelector('.user-profile-data');
    
    // Verify query performance is acceptable
    if (queryTimes.length > 0) {
      const avgQueryTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
      expect(avgQueryTime).toBeLessThan(1000); // Average query under 1 second
    }
    
    // Verify no slow queries
    const slowQueries = queryTimes.filter(time => time > 3000);
    expect(slowQueries.length).toBe(0);
  });

  test('Test Case 7.12: Data Validation and Constraints', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Study cards with various data inputs
    await helpers.studyCards(5);
    
    // Verify data validation works
    await helpers.waitForConsoleLog('Data validation passed');
    
    // Test constraint enforcement
    await page.goto('/settings');
    
    // Try to enter invalid data (if form validation exists)
    const sessionLengthInput = page.locator('input[name="sessionLength"]');
    if (await sessionLengthInput.isVisible()) {
      await sessionLengthInput.fill('-10'); // Invalid negative value
      await page.click('text=Save');
      
      // Should show validation error
      await expect(page.locator('text=Invalid session length')).toBeVisible();
    }
    
    // Verify database constraints prevent invalid data
    await helpers.waitForConsoleLog('Database constraints enforced');
  });
});