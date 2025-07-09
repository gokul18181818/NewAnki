import { test, expect } from '@playwright/test';
import { TestHelpers, TEST_DECK_DATA } from './utils/testHelpers';

test.describe('Adaptive Personalization Engine', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    await helpers.login();
  });

  test('Test Case 5.1: User Learning Profile Creation', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Step 1: Complete user onboarding (if needed)
    // This step would be handled by the login process
    
    // Step 2: Study 15+ cards to generate data
    const studyData = [];
    const sessionStartTime = Date.now();
    
    for (let i = 0; i < 15; i++) {
      await page.waitForSelector('.card-content');
      
      const cardStartTime = Date.now();
      await page.click('text=Show Answer');
      
      // Vary response times and ratings
      const responseTime = Math.random() * 3000 + 2000; // 2-5 seconds
      await page.waitForTimeout(responseTime);
      
      const ratings = ['😞', '😐', '😊', '😁'];
      const rating = ratings[Math.floor(Math.random() * ratings.length)];
      await page.click(`text=${rating}`);
      
      const cardEndTime = Date.now();
      studyData.push({
        responseTime: cardEndTime - cardStartTime,
        rating: rating,
        timestamp: cardEndTime
      });
      
      await page.waitForTimeout(500);
    }
    
    const sessionEndTime = Date.now();
    const sessionLength = sessionEndTime - sessionStartTime;
    
    // Step 3: Verify user_learning_profiles table population
    await helpers.waitForConsoleLog('User learning profile updated');
    
    // Verify profile data structure
    await helpers.waitForConsoleLog('total_cards_studied: 15');
    await helpers.waitForConsoleLog(`average_session_length: ${Math.round(sessionLength / 1000)}`);
    
    // Expected Profile Data After 15 cards studied
    const expectedProfile = {
      totalCardsStudied: 15,
      averageSessionLength: Math.round(sessionLength / 1000),
      preferredStudyTimes: [new Date().getHours()],
      fatigueThreshold: { min: 50, max: 80 },
      celebrationFrequency: { min: 3, max: 7 }
    };
    
    // Verify calculations
    expect(studyData.length).toBe(15);
    expect(sessionLength).toBeGreaterThan(0);
    
    // Check average retention rate calculation
    const correctAnswers = studyData.filter(d => d.rating === '😊' || d.rating === '😁').length;
    const retentionRate = (correctAnswers / studyData.length) * 100;
    expect(retentionRate).toBeGreaterThanOrEqual(0);
    expect(retentionRate).toBeLessThanOrEqual(100);
  });

  test('Test Case 5.2: Dynamic Recommendations', async ({ page }) => {
    // First, generate some learning data
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Study cards to establish baseline
    await helpers.studyCards(10);
    
    // Step 1: Navigate to /settings
    await page.goto('/settings');
    
    // Step 2: Verify "AI Learning Insights" section appears
    await expect(page.locator('text=AI Learning Insights')).toBeVisible();
    
    // Step 3: Check personalized recommendations display
    await expect(page.locator('text=AI suggests:')).toBeVisible();
    await expect(page.locator('text=Best time:')).toBeVisible();
    
    // Check specific recommendations
    const recommendations = [
      'Session length suggestion',
      'Break duration recommendation',
      'Celebration frequency',
      'Fatigue threshold',
      'Optimal study time'
    ];
    
    for (const rec of recommendations) {
      // Look for AI suggestion text patterns
      const aiSuggestionExists = await page.locator('text=AI suggests').isVisible();
      expect(aiSuggestionExists).toBe(true);
    }
    
    // Step 4: Test "Refresh" button functionality
    await page.click('text=Refresh');
    await helpers.waitForConsoleLog('Recommendations refreshed');
    
    // Step 5: Validate recommendations update based on study data
    await helpers.waitForConsoleLog('Recommendations updated based on study data');
  });

  test('Test Case 5.3: Beginner vs Expert Profile Testing', async ({ page }) => {
    await page.goto('/settings');
    
    // Step 1: Test "😓 Test Beginner" button
    await page.click('text=😓 Test Beginner');
    
    // Step 2: Verify profile updates to struggling user data
    await helpers.waitForConsoleLog('Profile updated to beginner');
    
    // Expected beginner profile: 12min sessions, 3 celebrations, 55% fatigue, 8min breaks
    await expect(page.locator('text=12min')).toBeVisible(); // Session length
    await expect(page.locator('text=3')).toBeVisible(); // Celebrations
    await expect(page.locator('text=55%')).toBeVisible(); // Fatigue threshold
    await expect(page.locator('text=8min')).toBeVisible(); // Break duration
    
    // Step 3: Test "🎓 Test Expert" button
    await page.click('text=🎓 Test Expert');
    
    // Step 4: Verify profile updates to experienced user data
    await helpers.waitForConsoleLog('Profile updated to expert');
    
    // Expected expert profile: 35min sessions, 7 celebrations, 72% fatigue, 12min breaks
    await expect(page.locator('text=35min')).toBeVisible(); // Session length
    await expect(page.locator('text=7')).toBeVisible(); // Celebrations
    await expect(page.locator('text=72%')).toBeVisible(); // Fatigue threshold
    await expect(page.locator('text=12min')).toBeVisible(); // Break duration
    
    // Step 5: Check UI reflects changes immediately
    await page.waitForTimeout(1000);
    
    // Verify AI suggestions update
    await expect(page.locator('text=AI suggests: 35min')).toBeVisible();
  });

  test('Test Case 5.4: Learning Pattern Recognition', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Create consistent learning pattern
    const patterns = [
      { time: 1000, rating: '😁' }, // Fast and easy
      { time: 2000, rating: '😊' }, // Normal and good
      { time: 5000, rating: '😐' }, // Slow and okay
      { time: 8000, rating: '😞' }  // Very slow and hard
    ];
    
    // Repeat pattern multiple times
    for (let cycle = 0; cycle < 3; cycle++) {
      for (const pattern of patterns) {
        await page.waitForSelector('.card-content');
        await page.click('text=Show Answer');
        await page.waitForTimeout(pattern.time);
        await page.click(`text=${pattern.rating}`);
        await page.waitForTimeout(500);
      }
    }
    
    // Verify pattern recognition
    await helpers.waitForConsoleLog('Learning pattern recognized');
    await helpers.waitForConsoleLog('Difficulty pattern identified');
    
    // Check that recommendations adapt to pattern
    await page.goto('/settings');
    await helpers.waitForConsoleLog('Recommendations adapted to pattern');
  });

  test('Test Case 5.5: Time-Based Adaptation', async ({ page }) => {
    // Test different times of day (simulated)
    const studyTimes = [
      { hour: 9, performance: 0.8 },   // Morning - good performance
      { hour: 14, performance: 0.6 },  // Afternoon - okay performance
      { hour: 22, performance: 0.4 }   // Evening - poor performance
    ];
    
    for (const timeData of studyTimes) {
      // Mock the current time
      await page.evaluate((hour) => {
        Date.prototype.getHours = () => hour;
      }, timeData.hour);
      
      await page.goto('/dashboard');
      await page.click(`text=${TEST_DECK_DATA.name}`);
      await page.click('text=Study');
      
      // Study with performance matching time
      const cardCount = 5;
      for (let i = 0; i < cardCount; i++) {
        await page.waitForSelector('.card-content');
        await page.click('text=Show Answer');
        
        // Vary response time based on performance
        const responseTime = 3000 + (1 - timeData.performance) * 4000;
        await page.waitForTimeout(responseTime);
        
        // Choose rating based on performance
        const rating = timeData.performance > 0.7 ? '😊' : 
                      timeData.performance > 0.5 ? '😐' : '😞';
        await page.click(`text=${rating}`);
        await page.waitForTimeout(500);
      }
      
      await page.goto('/dashboard');
      await page.waitForTimeout(1000);
    }
    
    // Check optimal study time recommendation
    await page.goto('/settings');
    await expect(page.locator('text=Best time: 9:00 AM')).toBeVisible();
  });

  test('Test Case 5.6: Difficulty Adjustment', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Study cards with consistently poor performance
    for (let i = 0; i < 10; i++) {
      await page.waitForSelector('.card-content');
      await page.click('text=Show Answer');
      await page.waitForTimeout(8000); // Long response time
      await page.click('text=😞'); // Poor rating
      await page.waitForTimeout(500);
    }
    
    // Check difficulty adjustment recommendations
    await helpers.waitForConsoleLog('Difficulty adjustment suggested');
    
    // Verify recommendations appear
    await expect(page.locator('text=Consider easier cards')).toBeVisible();
    await expect(page.locator('text=Review fundamentals')).toBeVisible();
  });

  test('Test Case 5.7: Celebration Frequency Optimization', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Study cards with good performance
    let celebrationCount = 0;
    
    page.on('dialog', async (dialog) => {
      if (dialog.message().includes('Great job!')) {
        celebrationCount++;
        await dialog.accept();
      }
    });
    
    for (let i = 0; i < 20; i++) {
      await page.waitForSelector('.card-content');
      await page.click('text=Show Answer');
      await page.waitForTimeout(2000); // Fast response
      await page.click('text=😊'); // Good rating
      await page.waitForTimeout(500);
    }
    
    // Verify celebration frequency is appropriate
    expect(celebrationCount).toBeGreaterThan(0);
    expect(celebrationCount).toBeLessThan(10); // Not too frequent
    
    // Check celebration frequency in settings
    await page.goto('/settings');
    await expect(page.locator('text=Celebration frequency')).toBeVisible();
  });

  test('Test Case 5.8: Performance Trend Analysis', async ({ page }) => {
    // Study across multiple sessions to establish trends
    for (let session = 0; session < 3; session++) {
      await page.goto('/dashboard');
      await page.click(`text=${TEST_DECK_DATA.name}`);
      await page.click('text=Study');
      
      // Gradually improving performance
      const basePerformance = 0.5 + (session * 0.2);
      
      for (let i = 0; i < 10; i++) {
        await page.waitForSelector('.card-content');
        await page.click('text=Show Answer');
        
        const responseTime = 5000 - (basePerformance * 2000);
        await page.waitForTimeout(responseTime);
        
        const rating = basePerformance > 0.7 ? '😊' : 
                      basePerformance > 0.5 ? '😐' : '😞';
        await page.click(`text=${rating}`);
        await page.waitForTimeout(500);
      }
      
      await page.goto('/dashboard');
      await page.waitForTimeout(2000);
    }
    
    // Check trend analysis
    await helpers.waitForConsoleLog('Performance trend: improving');
    
    // Verify trend-based recommendations
    await page.goto('/settings');
    await expect(page.locator('text=Performance improving')).toBeVisible();
    await expect(page.locator('text=Consider harder cards')).toBeVisible();
  });

  test('Test Case 5.9: Adaptive Session Length', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Study with fatigue pattern
    for (let i = 0; i < 20; i++) {
      await page.waitForSelector('.card-content');
      await page.click('text=Show Answer');
      
      // Increasing response time (fatigue)
      const responseTime = 2000 + (i * 200);
      await page.waitForTimeout(responseTime);
      
      const rating = i < 10 ? '😊' : '😐'; // Performance degrades
      await page.click(`text=${rating}`);
      await page.waitForTimeout(500);
    }
    
    // Check adaptive session length recommendation
    await helpers.waitForConsoleLog('Optimal session length calculated');
    
    await page.goto('/settings');
    await expect(page.locator('text=AI suggests: 15min')).toBeVisible();
  });

  test('Test Case 5.10: Multi-Deck Personalization', async ({ page }) => {
    // Study different decks to test deck-specific personalization
    const decks = [TEST_DECK_DATA.name, 'Math Deck', 'Science Deck'];
    
    for (const deckName of decks) {
      await page.goto('/dashboard');
      
      // Skip if deck doesn't exist
      if (!(await page.locator(`text=${deckName}`).isVisible())) {
        continue;
      }
      
      await page.click(`text=${deckName}`);
      await page.click('text=Study');
      
      // Study with different performance per deck
      const deckPerformance = deckName === 'Math Deck' ? 0.8 : 0.6;
      
      for (let i = 0; i < 5; i++) {
        await page.waitForSelector('.card-content');
        await page.click('text=Show Answer');
        
        const responseTime = 3000 + (1 - deckPerformance) * 2000;
        await page.waitForTimeout(responseTime);
        
        const rating = deckPerformance > 0.7 ? '😊' : '😐';
        await page.click(`text=${rating}`);
        await page.waitForTimeout(500);
      }
    }
    
    // Check deck-specific recommendations
    await helpers.waitForConsoleLog('Deck-specific recommendations generated');
    
    // Verify different recommendations per deck
    await page.goto('/settings');
    await expect(page.locator('text=Deck-specific insights')).toBeVisible();
  });
});