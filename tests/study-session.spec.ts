import { test, expect } from '@playwright/test';
import { TestHelpers, TEST_DECK_DATA } from './utils/testHelpers';

test.describe('Study Session Core Functionality', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    await helpers.login();
  });

  test('Test Case 3.1: Study Session Initialization', async ({ page }) => {
    // Step 1: Navigate to dashboard
    await page.goto('/dashboard');
    
    // Step 2: Click on EEI deck
    await page.click(`text=${TEST_DECK_DATA.name}`);
    
    // Step 3: Click "Study" or play button
    await page.click('text=Study');
    
    // Step 4: Monitor for our fixed error - SHOULD NOT see null reference error
    await helpers.verifyNoNullReferenceErrors();
    
    // Step 5: Verify anti-burnout engine initializes properly
    await helpers.waitForConsoleLog('Anti-burnout engine initialized');
    
    // Step 6: Check adaptive personalization engine loads user profile
    await helpers.waitForConsoleLog('Adaptive personalization loaded');
    
    // Console Log Validation - Expected logs in order:
    const expectedLogs = [
      '🚀 Initializing user session...',
      '✅ Auth change - Setting user with preferences',
      '🔄 Loading fresh adaptive recommendations...',
      '🎯 Fresh recommendations loaded:'
    ];
    
    // Monitor console logs
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      consoleLogs.push(msg.text());
    });
    
    await page.waitForTimeout(5000);
    
    // Verify expected logs appear
    for (const expectedLog of expectedLogs) {
      const found = consoleLogs.some(log => log.includes(expectedLog));
      expect(found).toBe(true);
    }
    
    // NO null reference errors
    const nullErrors = consoleLogs.filter(log => 
      log.includes('Cannot read properties of null (reading \'getSessionOptimization\')')
    );
    expect(nullErrors.length).toBe(0);
  });

  test('Test Case 3.2: Card Display & Interaction', async ({ page }) => {
    // Navigate to study session
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Step 1: Verify first card displays correctly
    await expect(page.locator('.card-content')).toBeVisible();
    
    // Step 2: Check image rendering (mathematical charts/graphs)
    const images = page.locator('.card-content img');
    const imageCount = await images.count();
    
    if (imageCount > 0) {
      // Should show mathematical charts/graphs
      await expect(images.first()).toBeVisible();
      
      // Check image loads successfully
      const src = await images.first().getAttribute('src');
      expect(src).toBeTruthy();
    }
    
    // Step 3: Test "Show Answer" button functionality
    await page.click('text=Show Answer');
    await expect(page.locator('.card-answer')).toBeVisible();
    
    // Step 4: Validate rating buttons (😞 😐 😊 😁) appear
    const ratingButtons = ['😞', '😐', '😊', '😁'];
    for (const rating of ratingButtons) {
      await expect(page.locator(`text=${rating}`)).toBeVisible();
    }
    
    // Step 5: Test card progression after rating
    await page.click('text=😊');
    
    // Should progress to next card or show completion
    await page.waitForTimeout(1000);
    const nextCard = page.locator('.card-content');
    const completion = page.locator('text=Session Complete');
    
    const nextCardVisible = await nextCard.isVisible();
    const completionVisible = await completion.isVisible();
    
    expect(nextCardVisible || completionVisible).toBe(true);
    
    // Step 6: Monitor response time tracking
    await helpers.waitForConsoleLog('Response time recorded');
  });

  test('Test Case 3.3: Advanced SRS Integration', async ({ page }) => {
    // Navigate to study session
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Step 1: Rate multiple cards with different emotions
    const ratings = ['😞', '😐', '😊', '😁'];
    const responseTimes = [];
    
    for (let i = 0; i < 5; i++) {
      await page.waitForSelector('.card-content');
      
      const startTime = Date.now();
      await page.click('text=Show Answer');
      
      const randomRating = ratings[Math.floor(Math.random() * ratings.length)];
      await page.click(`text=${randomRating}`);
      
      const endTime = Date.now();
      responseTimes.push(endTime - startTime);
      
      await page.waitForTimeout(1000);
    }
    
    // Step 2: Verify SRS algorithm updates
    await helpers.waitForConsoleLog('SRS algorithm updated');
    
    // Check for ease factor adjustments
    await helpers.waitForConsoleLog('Ease factor adjusted');
    
    // Check for next due date calculations
    await helpers.waitForConsoleLog('Next due date calculated');
    
    // Check for interval progression
    await helpers.waitForConsoleLog('Interval progression updated');
    
    // Step 3: Check database updates in real-time
    await helpers.verifyDatabaseUpdates(['cards', 'study_logs']);
    
    // Step 4: Validate learning state transitions
    await helpers.waitForConsoleLog('Learning state transition');
  });

  test('Test Case 3.4: Session Timing and Metrics', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    
    const startTime = Date.now();
    await page.click('text=Study');
    
    // Study multiple cards
    const responseTimes = await helpers.studyCards(10);
    
    const endTime = Date.now();
    const totalSessionTime = endTime - startTime;
    
    // Verify session metrics are tracked
    await expect(page.locator('text=Session Stats')).toBeVisible();
    
    // Check response time calculations
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    expect(avgResponseTime).toBeGreaterThan(0);
    expect(avgResponseTime).toBeLessThan(30000); // Should be under 30 seconds per card
    
    // Verify total session time is tracked
    expect(totalSessionTime).toBeGreaterThan(0);
  });

  test('Test Case 3.5: Card State Transitions', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Test different card states
    await page.waitForSelector('.card-content');
    
    // New card state
    await expect(page.locator('.card-state-new')).toBeVisible();
    
    await page.click('text=Show Answer');
    await page.click('text=😊'); // Good rating
    
    // Card should transition to learning state
    await helpers.waitForConsoleLog('Card state: learning');
    
    // Continue studying to test review state
    await page.waitForTimeout(1000);
  });

  test('Test Case 3.6: Image and Media Handling', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    await page.waitForSelector('.card-content');
    
    // Check for images in cards
    const images = page.locator('.card-content img');
    const imageCount = await images.count();
    
    if (imageCount > 0) {
      // Test image loading
      for (let i = 0; i < Math.min(imageCount, 3); i++) {
        const img = images.nth(i);
        await expect(img).toBeVisible();
        
        // Check image dimensions
        const boundingBox = await img.boundingBox();
        expect(boundingBox).toBeTruthy();
        expect(boundingBox!.width).toBeGreaterThan(0);
        expect(boundingBox!.height).toBeGreaterThan(0);
      }
    }
    
    // Test media file references
    const mediaSources = await page.locator('.card-content [src]').all();
    for (const element of mediaSources) {
      const src = await element.getAttribute('src');
      expect(src).not.toContain('undefined');
      expect(src).not.toContain('null');
    }
  });

  test('Test Case 3.7: Keyboard Navigation', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    await page.waitForSelector('.card-content');
    
    // Test keyboard shortcuts
    await page.keyboard.press('Space'); // Show answer
    await expect(page.locator('.card-answer')).toBeVisible();
    
    // Test rating with keyboard
    await page.keyboard.press('1'); // Hard rating
    await page.waitForTimeout(1000);
    
    // Should progress to next card
    await page.waitForSelector('.card-content');
    
    // Test answer reveal with Enter
    await page.keyboard.press('Enter');
    await expect(page.locator('.card-answer')).toBeVisible();
  });

  test('Test Case 3.8: Session Interruption Recovery', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Study a few cards
    await helpers.studyCards(3);
    
    // Simulate interruption by navigation
    await page.goto('/dashboard');
    
    // Return to study session
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Should resume from where left off
    await expect(page.locator('.card-content')).toBeVisible();
    
    // Progress should be maintained
    await helpers.waitForConsoleLog('Session resumed');
  });

  test('Test Case 3.9: Empty Deck Handling', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Try to study a deck with no due cards
    await page.click('text=Empty Deck');
    await page.click('text=Study');
    
    // Should show appropriate message
    await expect(page.locator('text=No cards due for study')).toBeVisible();
    
    // Should offer options to study anyway or return
    await expect(page.locator('text=Study anyway')).toBeVisible();
    await expect(page.locator('text=Return to dashboard')).toBeVisible();
  });

  test('Test Case 3.10: Session Completion Flow', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Complete all due cards
    let sessionComplete = false;
    let cardCount = 0;
    const maxCards = 50; // Prevent infinite loop
    
    while (!sessionComplete && cardCount < maxCards) {
      try {
        await page.waitForSelector('.card-content', { timeout: 5000 });
        await page.click('text=Show Answer');
        await page.click('text=😊');
        cardCount++;
        await page.waitForTimeout(1000);
      } catch (error) {
        sessionComplete = true;
      }
    }
    
    // Should show session completion
    await expect(page.locator('text=Session Complete')).toBeVisible();
    
    // Should show session statistics
    await expect(page.locator('text=Cards studied')).toBeVisible();
    await expect(page.locator('text=Session time')).toBeVisible();
    await expect(page.locator('text=Average response time')).toBeVisible();
    
    // Should offer next actions
    await expect(page.locator('text=Study more')).toBeVisible();
    await expect(page.locator('text=Return to dashboard')).toBeVisible();
  });
});