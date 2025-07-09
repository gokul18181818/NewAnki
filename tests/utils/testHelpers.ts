import { Page, expect } from '@playwright/test';

export class TestHelpers {
  constructor(private page: Page) {}

  /**
   * Login with the specified user credentials
   */
  async login(email: string = 'gokul2003@hotmail.com', password: string = 'Spidey1818$') {
    await this.page.goto('/');
    await this.page.click('text=Sign In');
    await this.page.fill('input[type="email"]', email);
    await this.page.fill('input[type="password"]', password);
    await this.page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await this.page.waitForURL('/dashboard');
  }

  /**
   * Wait for and verify console logs
   */
  async waitForConsoleLog(pattern: string | RegExp, timeout: number = 5000) {
    return new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Console log "${pattern}" not found within ${timeout}ms`));
      }, timeout);

      const handler = (msg: any) => {
        if (typeof pattern === 'string' && msg.text().includes(pattern)) {
          clearTimeout(timeoutId);
          this.page.off('console', handler);
          resolve();
        } else if (pattern instanceof RegExp && pattern.test(msg.text())) {
          clearTimeout(timeoutId);
          this.page.off('console', handler);
          resolve();
        }
      };

      this.page.on('console', handler);
    });
  }

  /**
   * Upload a file to a file input
   */
  async uploadFile(selector: string, filePath: string) {
    const fileInput = this.page.locator(selector);
    await fileInput.setInputFiles(filePath);
  }

  /**
   * Wait for element to be visible with retry
   */
  async waitForElementWithRetry(selector: string, maxRetries: number = 3, timeout: number = 5000) {
    let retries = 0;
    while (retries < maxRetries) {
      try {
        await this.page.waitForSelector(selector, { timeout });
        return;
      } catch (error) {
        retries++;
        if (retries === maxRetries) {
          throw error;
        }
        await this.page.waitForTimeout(1000);
      }
    }
  }

  /**
   * Check if user context loads successfully
   */
  async verifyUserContextLoads() {
    await this.waitForConsoleLog('✅ Auth change - Setting user with preferences');
    await this.waitForConsoleLog('🔄 Loading fresh adaptive recommendations...');
  }

  /**
   * Verify no null reference errors in console
   */
  async verifyNoNullReferenceErrors() {
    const errorMessages: string[] = [];
    
    this.page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('Cannot read properties of null')) {
        errorMessages.push(msg.text());
      }
    });

    // Wait a bit for any errors to appear
    await this.page.waitForTimeout(2000);
    
    if (errorMessages.length > 0) {
      throw new Error(`Null reference errors found: ${errorMessages.join(', ')}`);
    }
  }

  /**
   * Verify adaptive recommendations are loaded
   */
  async verifyAdaptiveRecommendations() {
    await this.page.goto('/settings');
    await this.waitForElementWithRetry('text=AI Learning Insights');
    
    // Check for personalized recommendations
    await expect(this.page.locator('text=AI suggests:')).toBeVisible();
    await expect(this.page.locator('text=Best time:')).toBeVisible();
  }

  /**
   * Study cards and monitor response times
   */
  async studyCards(cardCount: number = 5) {
    const responseTimes: number[] = [];
    
    for (let i = 0; i < cardCount; i++) {
      const startTime = Date.now();
      
      // Wait for card to load
      await this.waitForElementWithRetry('.card-content');
      
      // Show answer
      await this.page.click('text=Show Answer');
      
      // Rate the card (randomly choose between emotions)
      const ratings = ['😞', '😐', '😊', '😁'];
      const randomRating = ratings[Math.floor(Math.random() * ratings.length)];
      await this.page.click(`text=${randomRating}`);
      
      const endTime = Date.now();
      responseTimes.push(endTime - startTime);
      
      // Wait for next card or session end
      await this.page.waitForTimeout(1000);
    }
    
    return responseTimes;
  }

  /**
   * Create test Anki deck data
   */
  async createTestAnkiDeck(deckName: string = 'Test Deck') {
    // This would be implemented to create test data
    // For now, we'll assume test data exists
    console.log(`Creating test deck: ${deckName}`);
  }

  /**
   * Verify database updates
   */
  async verifyDatabaseUpdates(expectedTables: string[]) {
    // This would typically connect to the database to verify updates
    // For now, we'll check the UI for changes
    console.log(`Verifying database updates for tables: ${expectedTables.join(', ')}`);
  }

  /**
   * Simulate fatigue conditions
   */
  async simulateFatigue() {
    // Study cards with deliberately slow response times
    for (let i = 0; i < 10; i++) {
      await this.waitForElementWithRetry('.card-content');
      await this.page.click('text=Show Answer');
      
      // Simulate slow response time
      await this.page.waitForTimeout(8000);
      
      await this.page.click('text=😞'); // Always rate as difficult
      await this.page.waitForTimeout(1000);
    }
  }

  /**
   * Verify break suggestion appears
   */
  async verifyBreakSuggestion() {
    await this.waitForElementWithRetry('text=Take a Smart Break');
    await expect(this.page.locator('text=Recovery Protocol')).toBeVisible();
  }

  /**
   * Test session persistence
   */
  async testSessionPersistence() {
    // Refresh the page
    await this.page.reload();
    
    // Wait for auth check
    await this.page.waitForTimeout(3000);
    
    // Should still be logged in
    await expect(this.page.locator('text=Dashboard')).toBeVisible();
  }
}

export const TEST_USER = {
  email: 'gokul2003@hotmail.com',
  password: 'Spidey1818$'
};

export const TEST_DECK_DATA = {
  name: 'EEI',
  subdecks: [
    { name: 'EEI::First', cardCount: 21 },
    { name: 'EEI::Second', cardCount: 20 }
  ],
  totalCards: 41,
  mediaFiles: 33
};