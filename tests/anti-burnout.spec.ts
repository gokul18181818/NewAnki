import { test, expect } from '@playwright/test';
import { TestHelpers, TEST_DECK_DATA } from './utils/testHelpers';

test.describe('Anti-Burnout & Fatigue Detection', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    await helpers.login();
  });

  test('Test Case 4.1: Response Time Baseline Learning', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Step 1: Study 10+ cards at normal pace (3-5 seconds per card)
    const responseTimes = [];
    
    for (let i = 0; i < 10; i++) {
      await page.waitForSelector('.card-content');
      
      const startTime = Date.now();
      await page.click('text=Show Answer');
      
      // Normal pace response time
      await page.waitForTimeout(Math.random() * 2000 + 3000); // 3-5 seconds
      
      await page.click('text=😊');
      const endTime = Date.now();
      
      responseTimes.push(endTime - startTime);
      await page.waitForTimeout(500);
    }
    
    // Step 2: Monitor response_time_baselines table population
    await helpers.waitForConsoleLog('Response time baseline updated');
    
    // Step 3: Verify baseline calculations in console
    await helpers.waitForConsoleLog('Baseline response time calculated');
    
    // Step 4: Test personalized threshold generation
    await helpers.waitForConsoleLog('Personalized threshold generated');
    
    // Step 5: Validate difficulty-specific baselines
    await helpers.waitForConsoleLog('Difficulty-specific baseline created');
    
    // Database Validation - Check if baselines are being created
    // (This would be validated through API calls or database queries in real test)
    await helpers.verifyDatabaseUpdates(['response_time_baselines']);
    
    // Verify response times are within expected range
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    expect(avgResponseTime).toBeGreaterThan(3000); // At least 3 seconds
    expect(avgResponseTime).toBeLessThan(8000); // Less than 8 seconds
  });

  test('Test Case 4.2: Fatigue Detection Triggers', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Step 1: Study cards rapidly (simulate fatigue)
    await helpers.simulateFatigue();
    
    // Step 2: Monitor fatigue score calculations
    await helpers.waitForConsoleLog('Fatigue score calculated');
    
    // Step 3: Verify break suggestions appear
    await helpers.verifyBreakSuggestion();
    
    // Verify smart break popup appears
    await expect(page.locator('text=Take a Smart Break')).toBeVisible();
    
    // Verify recovery protocol offers options
    await expect(page.locator('text=Recovery Protocol')).toBeVisible();
    
    // Verify break duration is personalized
    await expect(page.locator('text=Recommended break: 15 minutes')).toBeVisible();
  });

  test('Test Case 4.3: Recovery Protocol Testing', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Step 1: Trigger fatigue warning
    await helpers.simulateFatigue();
    
    // Step 2: Verify RecoveryProtocol component renders
    await expect(page.locator('.recovery-protocol')).toBeVisible();
    
    // Step 3: Test break duration personalization
    const breakDurationText = await page.locator('text=Recommended break:').textContent();
    expect(breakDurationText).toContain('minutes');
    
    // Should use: antiBurnoutEngine?.getSessionOptimization()?.recommendedBreakDuration || 15
    // Verify fallback to 15 minutes if engine is null
    const durationMatch = breakDurationText?.match(/(\d+)\s*minutes/);
    const duration = durationMatch ? parseInt(durationMatch[1]) : 0;
    expect(duration).toBeGreaterThan(0);
    expect(duration).toBeLessThanOrEqual(60); // Reasonable upper bound
    
    // Step 4: Test "Take Break" vs "Skip" options
    await expect(page.locator('text=Take Break')).toBeVisible();
    await expect(page.locator('text=Skip')).toBeVisible();
    
    // Test taking break
    await page.click('text=Take Break');
    await expect(page.locator('text=Break in progress')).toBeVisible();
    
    // Step 5: Validate post-break performance tracking
    await helpers.waitForConsoleLog('Post-break performance tracked');
  });

  test('Test Case 4.4: Baseline Establishment Over Time', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Simulate multiple study sessions to establish baselines
    for (let session = 0; session < 3; session++) {
      // Study cards with consistent response times
      for (let i = 0; i < 5; i++) {
        await page.waitForSelector('.card-content');
        await page.click('text=Show Answer');
        
        // Consistent response time for baseline
        await page.waitForTimeout(4000);
        
        await page.click('text=😊');
        await page.waitForTimeout(500);
      }
      
      // Short break between sessions
      await page.waitForTimeout(2000);
    }
    
    // Verify baseline becomes more accurate over time
    await helpers.waitForConsoleLog('Baseline accuracy improved');
    
    // Check sample size increases
    await helpers.waitForConsoleLog('Sample size: 15');
  });

  test('Test Case 4.5: Fatigue Score Calculation', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Monitor fatigue score changes
    const fatigueScores: number[] = [];
    
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('Fatigue score:')) {
        const match = text.match(/Fatigue score: ([\d.]+)/);
        if (match) {
          fatigueScores.push(parseFloat(match[1]));
        }
      }
    });
    
    // Study with increasing response times to simulate fatigue
    const baseTimes = [3000, 4000, 5000, 6000, 8000, 10000];
    
    for (const baseTime of baseTimes) {
      await page.waitForSelector('.card-content');
      await page.click('text=Show Answer');
      await page.waitForTimeout(baseTime);
      await page.click('text=😞'); // Difficult rating
      await page.waitForTimeout(500);
    }
    
    // Verify fatigue score increases over time
    expect(fatigueScores.length).toBeGreaterThan(0);
    
    if (fatigueScores.length > 2) {
      const firstScore = fatigueScores[0];
      const lastScore = fatigueScores[fatigueScores.length - 1];
      expect(lastScore).toBeGreaterThan(firstScore);
    }
  });

  test('Test Case 4.6: Break Reminder Timing', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Study for extended period
    const startTime = Date.now();
    let breakSuggested = false;
    
    page.on('console', (msg) => {
      if (msg.text().includes('Break suggested')) {
        breakSuggested = true;
      }
    });
    
    // Study continuously until break is suggested
    while (!breakSuggested && (Date.now() - startTime < 30000)) {
      try {
        await page.waitForSelector('.card-content', { timeout: 2000 });
        await page.click('text=Show Answer');
        await page.waitForTimeout(6000); // Slower response times
        await page.click('text=😐');
        await page.waitForTimeout(500);
      } catch (error) {
        break;
      }
    }
    
    // Verify break was suggested within reasonable time
    expect(breakSuggested).toBe(true);
  });

  test('Test Case 4.7: Personalized Break Recommendations', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Simulate fatigue to trigger break recommendation
    await helpers.simulateFatigue();
    
    // Check break recommendation appears
    await expect(page.locator('.recovery-protocol')).toBeVisible();
    
    // Verify break activities are suggested
    const breakActivities = [
      'Take a walk',
      'Do some stretches',
      'Deep breathing',
      'Get some water'
    ];
    
    let activitiesFound = 0;
    for (const activity of breakActivities) {
      if (await page.locator(`text=${activity}`).isVisible()) {
        activitiesFound++;
      }
    }
    
    expect(activitiesFound).toBeGreaterThan(0);
    
    // Verify timer functionality
    await page.click('text=Take Break');
    await expect(page.locator('.break-timer')).toBeVisible();
  });

  test('Test Case 4.8: Performance Recovery Tracking', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Study until fatigue
    await helpers.simulateFatigue();
    
    // Take break
    await page.click('text=Take Break');
    await page.waitForTimeout(5000); // Simulate break time
    
    // Resume studying
    await page.click('text=Resume Study');
    
    // Study more cards and track performance improvement
    const postBreakTimes = await helpers.studyCards(5);
    
    // Verify performance metrics are tracked
    await helpers.waitForConsoleLog('Performance recovery tracked');
    
    // Check that response times improve after break
    const avgPostBreakTime = postBreakTimes.reduce((a, b) => a + b, 0) / postBreakTimes.length;
    expect(avgPostBreakTime).toBeLessThan(8000); // Should be better than fatigued state
  });

  test('Test Case 4.9: Adaptive Break Duration', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Simulate different levels of fatigue
    const fatigueTests = [
      { cards: 5, expectedBreakMin: 5, expectedBreakMax: 10 },
      { cards: 10, expectedBreakMin: 10, expectedBreakMax: 15 },
      { cards: 15, expectedBreakMin: 15, expectedBreakMax: 20 }
    ];
    
    for (const test of fatigueTests) {
      // Reset session
      await page.reload();
      await page.click('text=Study');
      
      // Study specified number of cards with fatigue
      for (let i = 0; i < test.cards; i++) {
        await page.waitForSelector('.card-content');
        await page.click('text=Show Answer');
        await page.waitForTimeout(7000 + i * 1000); // Increasing fatigue
        await page.click('text=😞');
        await page.waitForTimeout(500);
      }
      
      // Check break duration recommendation
      if (await page.locator('.recovery-protocol').isVisible()) {
        const breakText = await page.locator('text=Recommended break:').textContent();
        const durationMatch = breakText?.match(/(\d+)\s*minutes/);
        const duration = durationMatch ? parseInt(durationMatch[1]) : 0;
        
        expect(duration).toBeGreaterThanOrEqual(test.expectedBreakMin);
        expect(duration).toBeLessThanOrEqual(test.expectedBreakMax);
      }
    }
  });

  test('Test Case 4.10: Multi-Session Fatigue Pattern Recognition', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Simulate multiple study sessions across different times
    for (let session = 0; session < 3; session++) {
      await page.click(`text=${TEST_DECK_DATA.name}`);
      await page.click('text=Study');
      
      // Study with consistent fatigue pattern
      await helpers.simulateFatigue();
      
      // Return to dashboard
      await page.goto('/dashboard');
      await page.waitForTimeout(2000);
    }
    
    // Check if patterns are recognized
    await helpers.waitForConsoleLog('Fatigue pattern recognized');
    
    // Verify proactive break suggestions
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Should suggest break earlier based on pattern
    await helpers.waitForConsoleLog('Proactive break suggested');
  });
});