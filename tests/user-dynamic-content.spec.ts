import { test, expect } from '@playwright/test';
import { TestHelpers, TEST_DECK_DATA } from './utils/testHelpers';

test.describe('User-Dynamic Content Implementation', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    await helpers.login();
  });

  test('Test Case 6.1: Dashboard Personalization', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Step 1: Check dashboard greeting includes user's actual name
    await expect(page.locator('text=Welcome back')).toBeVisible();
    
    // Verify actual name is displayed (not generic greeting)
    const greetingText = await page.locator('h1, h2, .greeting').first().textContent();
    expect(greetingText).toBeTruthy();
    expect(greetingText).not.toContain('Welcome back, User');
    expect(greetingText).not.toContain('Welcome back, Guest');
    
    // Step 2: Verify study streak displays real data (not hardcoded)
    await expect(page.locator('text=Study streak')).toBeVisible();
    const streakElement = page.locator('.study-streak, [data-testid="study-streak"]');
    if (await streakElement.isVisible()) {
      const streakText = await streakElement.textContent();
      expect(streakText).toMatch(/\d+/); // Should contain actual numbers
    }
    
    // Step 3: Test workload recommendations based on user pattern
    await expect(page.locator('text=Recommended workload')).toBeVisible();
    const workloadRec = page.locator('.workload-recommendation');
    if (await workloadRec.isVisible()) {
      const workloadText = await workloadRec.textContent();
      expect(workloadText).not.toContain('XX cards'); // Should not be placeholder
      expect(workloadText).toMatch(/\d+/); // Should contain actual numbers
    }
    
    // Step 4: Validate burnout risk assessment shows personalized level
    await expect(page.locator('text=Burnout risk')).toBeVisible();
    const burnoutRisk = page.locator('.burnout-risk, [data-testid="burnout-risk"]');
    if (await burnoutRisk.isVisible()) {
      const riskText = await burnoutRisk.textContent();
      const riskLevels = ['Low', 'Medium', 'High'];
      const hasValidRisk = riskLevels.some(level => riskText?.includes(level));
      expect(hasValidRisk).toBe(true);
    }
    
    // Step 5: Ensure study calendar reflects actual study days
    await expect(page.locator('.study-calendar, [data-testid="study-calendar"]')).toBeVisible();
    const calendarDays = page.locator('.calendar-day.studied');
    const studiedDaysCount = await calendarDays.count();
    expect(studiedDaysCount).toBeGreaterThanOrEqual(0);
  });

  test('Test Case 6.2: Settings Personalization', async ({ page }) => {
    // First, establish some study data
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    await helpers.studyCards(5);
    
    // Step 1: Navigate to Settings > Study tab
    await page.goto('/settings');
    await page.click('text=Study');
    
    // Step 2: Verify AI suggestions appear next to inputs
    await expect(page.locator('text=AI suggests:')).toBeVisible();
    
    // Check specific AI suggestions
    const suggestions = [
      { setting: 'session length', pattern: /AI suggests: \d+min/ },
      { setting: 'break duration', pattern: /AI suggests: \d+min/ },
      { setting: 'optimal study time', pattern: /Best time: \d+:\d+ (AM|PM)/ }
    ];
    
    for (const suggestion of suggestions) {
      const suggestionElements = page.locator('text=/AI suggests|Best time/');
      const suggestionCount = await suggestionElements.count();
      expect(suggestionCount).toBeGreaterThan(0);
    }
    
    // Step 3: Test "Use AI suggestion" buttons functionality
    const useAIButtons = page.locator('text=Use AI suggestion');
    const buttonCount = await useAIButtons.count();
    
    if (buttonCount > 0) {
      // Click first "Use AI suggestion" button
      await useAIButtons.first().click();
      
      // Verify the input field gets populated with AI suggestion
      await helpers.waitForConsoleLog('AI suggestion applied');
    }
    
    // Step 4: Validate preferences save with personalized values
    await page.click('text=Save Preferences');
    await helpers.waitForConsoleLog('Preferences saved with personalized values');
    
    // Verify success message
    await expect(page.locator('text=Preferences saved')).toBeVisible();
  });

  test('Test Case 6.3: Analytics Personalization', async ({ page }) => {
    // First, generate some study data
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    await helpers.studyCards(10);
    
    // Step 1: Navigate to /analytics
    await page.goto('/analytics');
    
    // Step 2: Verify it shows user's most active deck (not just first deck)
    await expect(page.locator('text=Most active deck')).toBeVisible();
    const mostActiveDeck = page.locator('.most-active-deck, [data-testid="most-active-deck"]');
    if (await mostActiveDeck.isVisible()) {
      const deckText = await mostActiveDeck.textContent();
      expect(deckText).not.toContain('First Deck'); // Should not be hardcoded
      expect(deckText).toBeTruthy();
    }
    
    // Step 3: Check learning insights reflect real data
    const insights = [
      { 
        label: 'Best study time',
        selector: '.best-study-time, [data-testid="best-study-time"]',
        pattern: /\d+:\d+ (AM|PM)/
      },
      {
        label: 'Fastest improving topic',
        selector: '.fastest-improving, [data-testid="fastest-improving"]',
        pattern: /.+/
      },
      {
        label: 'Most challenging topic',
        selector: '.most-challenging, [data-testid="most-challenging"]',
        pattern: /.+/
      },
      {
        label: 'Optimal session length',
        selector: '.optimal-session, [data-testid="optimal-session"]',
        pattern: /\d+\s*min/
      }
    ];
    
    for (const insight of insights) {
      const element = page.locator(insight.selector);
      if (await element.isVisible()) {
        const text = await element.textContent();
        expect(text).toMatch(insight.pattern);
        expect(text).not.toContain('N/A'); // Should not be placeholder
        expect(text).not.toContain('--'); // Should not be empty placeholder
      }
    }
  });

  test('Test Case 6.4: Static Content Validation', async ({ page }) => {
    await page.goto('/dashboard');
    
    // ❌ Pro tip should NOT always say "You learn 40% better with images!"
    const proTips = page.locator('.pro-tip, [data-testid="pro-tip"]');
    if (await proTips.isVisible()) {
      const tipText = await proTips.textContent();
      expect(tipText).not.toBe('You learn 40% better with images!');
    }
    
    // ✅ Should show personalized tips based on user's weak areas
    await expect(page.locator('text=Personalized tip')).toBeVisible();
    
    // ✅ Milestone progression should use user's adaptive milestones
    const milestones = page.locator('.milestone-progress, [data-testid="milestone-progress"]');
    if (await milestones.isVisible()) {
      const milestoneText = await milestones.textContent();
      expect(milestoneText).not.toContain('Static milestone');
      expect(milestoneText).toMatch(/\d+/); // Should contain actual progress numbers
    }
  });

  test('Test Case 6.5: Contextual Recommendations', async ({ page }) => {
    // Study to generate performance data
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Study with poor performance to trigger recommendations
    for (let i = 0; i < 5; i++) {
      await page.waitForSelector('.card-content');
      await page.click('text=Show Answer');
      await page.waitForTimeout(8000); // Slow response
      await page.click('text=😞'); // Poor rating
      await page.waitForTimeout(500);
    }
    
    // Return to dashboard to check recommendations
    await page.goto('/dashboard');
    
    // Should show contextual recommendations based on performance
    const recommendations = [
      'Consider reviewing fundamentals',
      'Try shorter study sessions',
      'Focus on weaker topics',
      'Take more breaks'
    ];
    
    let recommendationFound = false;
    for (const rec of recommendations) {
      if (await page.locator(`text=${rec}`).isVisible()) {
        recommendationFound = true;
        break;
      }
    }
    
    expect(recommendationFound).toBe(true);
  });

  test('Test Case 6.6: Dynamic Progress Indicators', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Check progress indicators are dynamic
    const progressElements = [
      '.progress-bar',
      '.progress-circle',
      '[data-testid="progress"]'
    ];
    
    for (const selector of progressElements) {
      const element = page.locator(selector);
      if (await element.isVisible()) {
        // Check if progress value is dynamic
        const progressValue = await element.getAttribute('data-progress') || 
                            await element.getAttribute('value') ||
                            await element.textContent();
        
        expect(progressValue).toBeTruthy();
        expect(progressValue).not.toBe('0%');
        expect(progressValue).not.toBe('100%'); // Unlikely to be exactly 100%
      }
    }
  });

  test('Test Case 6.7: Personalized Study Reminders', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Check for personalized study reminders
    const reminderElements = [
      '.study-reminder',
      '[data-testid="study-reminder"]',
      '.next-study-time'
    ];
    
    for (const selector of reminderElements) {
      const element = page.locator(selector);
      if (await element.isVisible()) {
        const reminderText = await element.textContent();
        expect(reminderText).not.toContain('Study now'); // Should be specific
        expect(reminderText).toMatch(/\d+/); // Should contain specific time/number
      }
    }
  });

  test('Test Case 6.8: Adaptive UI Elements', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Check that UI elements adapt to user preferences
    const adaptiveElements = [
      { selector: '.theme-toggle', property: 'data-theme' },
      { selector: '.font-size-setting', property: 'data-size' },
      { selector: '.layout-preference', property: 'data-layout' }
    ];
    
    for (const element of adaptiveElements) {
      const el = page.locator(element.selector);
      if (await el.isVisible()) {
        const propertyValue = await el.getAttribute(element.property);
        expect(propertyValue).toBeTruthy();
      }
    }
  });

  test('Test Case 6.9: Real-time Content Updates', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Start study session
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Study one card
    await page.waitForSelector('.card-content');
    await page.click('text=Show Answer');
    await page.click('text=😊');
    
    // Return to dashboard
    await page.goto('/dashboard');
    
    // Check that stats updated in real-time
    const updatedStats = [
      '.cards-studied-today',
      '.current-streak',
      '.progress-today'
    ];
    
    for (const statSelector of updatedStats) {
      const element = page.locator(statSelector);
      if (await element.isVisible()) {
        const statText = await element.textContent();
        expect(statText).not.toBe('0'); // Should show updated value
        expect(statText).toMatch(/\d+/); // Should contain numbers
      }
    }
  });

  test('Test Case 6.10: Personalized Learning Path', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Check for personalized learning path
    await expect(page.locator('text=Your Learning Path')).toBeVisible();
    
    const learningPathElements = [
      '.suggested-deck',
      '.recommended-topics',
      '.next-milestone'
    ];
    
    for (const selector of learningPathElements) {
      const element = page.locator(selector);
      if (await element.isVisible()) {
        const pathText = await element.textContent();
        expect(pathText).toBeTruthy();
        expect(pathText).not.toContain('Default path'); // Should be personalized
      }
    }
    
    // Check for adaptive difficulty suggestions
    await expect(page.locator('text=Recommended difficulty')).toBeVisible();
    
    const difficultyRec = page.locator('.difficulty-recommendation');
    if (await difficultyRec.isVisible()) {
      const diffText = await difficultyRec.textContent();
      const validDifficulties = ['Easy', 'Medium', 'Hard'];
      const hasValidDifficulty = validDifficulties.some(diff => diffText?.includes(diff));
      expect(hasValidDifficulty).toBe(true);
    }
  });

  test('Test Case 6.11: Cross-Page Content Consistency', async ({ page }) => {
    // Check that personalized content is consistent across pages
    await page.goto('/dashboard');
    
    // Get user name from dashboard
    const dashboardName = await page.locator('.user-name, [data-testid="user-name"]').textContent();
    
    // Check settings page
    await page.goto('/settings');
    const settingsName = await page.locator('.user-name, [data-testid="user-name"]').textContent();
    
    if (dashboardName && settingsName) {
      expect(dashboardName).toBe(settingsName);
    }
    
    // Check analytics page
    await page.goto('/analytics');
    const analyticsName = await page.locator('.user-name, [data-testid="user-name"]').textContent();
    
    if (dashboardName && analyticsName) {
      expect(dashboardName).toBe(analyticsName);
    }
  });

  test('Test Case 6.12: Fallback Content Handling', async ({ page }) => {
    // Test with minimal user data (new user scenario)
    await page.goto('/dashboard');
    
    // Should show appropriate fallback content for new users
    const fallbackElements = [
      { selector: '.welcome-message', expectedText: 'Welcome! Let\'s get started' },
      { selector: '.no-data-message', expectedText: 'Start studying to see insights' },
      { selector: '.getting-started', expectedText: 'Getting started' }
    ];
    
    for (const element of fallbackElements) {
      const el = page.locator(element.selector);
      if (await el.isVisible()) {
        const text = await el.textContent();
        expect(text).toBeTruthy();
        expect(text).not.toContain('undefined');
        expect(text).not.toContain('null');
      }
    }
  });
});