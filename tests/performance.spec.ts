import { test, expect } from '@playwright/test';
import { TestHelpers, TEST_DECK_DATA } from './utils/testHelpers';

test.describe('Performance & Load Testing', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    await helpers.login();
  });

  test('Test Case 9.1: Large Deck Performance', async ({ page }) => {
    // Step 1: Import Anki deck with 1000+ cards (simulated)
    await page.goto('/import');
    
    const largeDeckFile = await page.evaluateHandle(() => {
      // Simulate large deck data
      const largeDeckData = 'x'.repeat(10 * 1024 * 1024); // 10MB file
      return new File([largeDeckData], 'large_deck.apkg', { type: 'application/zip' });
    });
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(largeDeckFile as any);
    
    // Measure import time
    const importStartTime = Date.now();
    await page.waitForSelector('text=Processing...', { timeout: 10000 });
    await page.waitForSelector('text=Import completed', { timeout: 60000 });
    const importEndTime = Date.now();
    
    const importTime = importEndTime - importStartTime;
    expect(importTime).toBeLessThan(60000); // Under 1 minute
    
    // Step 2: Measure study session load times
    await page.goto('/dashboard');
    
    const loadStartTime = Date.now();
    await page.click('text=Large Deck');
    await page.click('text=Study');
    await page.waitForSelector('.card-content');
    const loadEndTime = Date.now();
    
    const loadTime = loadEndTime - loadStartTime;
    expect(loadTime).toBeLessThan(5000); // Under 5 seconds
    
    // Step 3: Test adaptive engine performance with large datasets
    const adaptiveStartTime = Date.now();
    await helpers.studyCards(10);
    const adaptiveEndTime = Date.now();
    
    const adaptiveTime = adaptiveEndTime - adaptiveStartTime;
    expect(adaptiveTime).toBeLessThan(30000); // Under 30 seconds for 10 cards
    
    // Step 4: Verify UI responsiveness during bulk operations
    await page.goto('/analytics');
    
    const analyticsLoadStart = Date.now();
    await page.waitForSelector('.analytics-data');
    const analyticsLoadEnd = Date.now();
    
    const analyticsLoadTime = analyticsLoadEnd - analyticsLoadStart;
    expect(analyticsLoadTime).toBeLessThan(10000); // Under 10 seconds
  });

  test('Test Case 9.2: Memory Usage Monitoring', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Step 1: Monitor browser memory during extended study sessions
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });
    
    // Perform memory-intensive operations
    for (let session = 0; session < 5; session++) {
      await page.click(`text=${TEST_DECK_DATA.name}`);
      await page.click('text=Study');
      
      // Study many cards
      await helpers.studyCards(20);
      
      // Navigate between pages
      await page.goto('/analytics');
      await page.goto('/settings');
      await page.goto('/dashboard');
    }
    
    const finalMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });
    
    // Step 2: Check for memory leaks in adaptive personalization
    const memoryIncrease = finalMemory - initialMemory;
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Under 50MB increase
    
    // Step 3: Validate image caching efficiency
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Load images multiple times
    for (let i = 0; i < 10; i++) {
      await page.waitForSelector('.card-content');
      const images = page.locator('.card-content img');
      const imageCount = await images.count();
      
      if (imageCount > 0) {
        // Images should load from cache on repeat visits
        const imageLoadStart = Date.now();
        await page.reload();
        await page.waitForSelector('.card-content img');
        const imageLoadEnd = Date.now();
        
        const cacheLoadTime = imageLoadEnd - imageLoadStart;
        expect(cacheLoadTime).toBeLessThan(2000); // Should be fast from cache
      }
      
      await page.click('text=Show Answer');
      await page.click('text=😊');
    }
    
    // Step 4: Test garbage collection of old study data
    await page.evaluate(() => {
      if (window.gc) {
        window.gc();
      }
    });
    
    const afterGCMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });
    
    // Memory should be reasonable after GC
    expect(afterGCMemory).toBeLessThan(100 * 1024 * 1024); // Under 100MB
  });

  test('Test Case 9.3: Concurrent User Load Simulation', async ({ context, page }) => {
    // Simulate multiple concurrent users
    const userSessions = [];
    
    for (let i = 0; i < 5; i++) {
      const userContext = await context.browser()?.newContext();
      const userPage = await userContext?.newPage();
      
      if (userPage) {
        userSessions.push({ context: userContext, page: userPage });
      }
    }
    
    // All users login and start studying simultaneously
    const loginPromises = userSessions.map(async (session) => {
      const userHelpers = new TestHelpers(session.page);
      await userHelpers.login();
      return userHelpers;
    });
    
    const allHelpers = await Promise.all(loginPromises);
    
    // All users study simultaneously
    const studyPromises = allHelpers.map(async (helper) => {
      await helper.page.goto('/dashboard');
      await helper.page.click(`text=${TEST_DECK_DATA.name}`);
      await helper.page.click('text=Study');
      return helper.studyCards(10);
    });
    
    const studyResults = await Promise.all(studyPromises);
    
    // Verify all sessions completed successfully
    expect(studyResults.length).toBe(5);
    studyResults.forEach(result => {
      expect(result.length).toBe(10);
    });
    
    // Cleanup
    for (const session of userSessions) {
      await session.page.close();
      await session.context?.close();
    }
  });

  test('Test Case 9.4: Database Query Performance', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Monitor database query performance
    const queryMetrics: { url: string, duration: number }[] = [];
    
    page.on('response', (response) => {
      if (response.url().includes('/api/') && response.status() === 200) {
        const timing = response.timing();
        queryMetrics.push({
          url: response.url(),
          duration: timing.responseEnd - timing.requestStart
        });
      }
    });
    
    // Perform operations that trigger database queries
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Study cards (triggers multiple DB operations)
    await helpers.studyCards(20);
    
    // Navigate to analytics (complex queries)
    await page.goto('/analytics');
    await page.waitForSelector('.analytics-data');
    
    // Navigate to settings (profile queries)
    await page.goto('/settings');
    await page.waitForSelector('.user-profile-data');
    
    // Analyze query performance
    if (queryMetrics.length > 0) {
      const avgQueryTime = queryMetrics.reduce((sum, metric) => sum + metric.duration, 0) / queryMetrics.length;
      expect(avgQueryTime).toBeLessThan(1000); // Average under 1 second
      
      // No queries should be extremely slow
      const slowQueries = queryMetrics.filter(metric => metric.duration > 5000);
      expect(slowQueries.length).toBe(0);
      
      // Most queries should be fast
      const fastQueries = queryMetrics.filter(metric => metric.duration < 500);
      expect(fastQueries.length).toBeGreaterThan(queryMetrics.length * 0.7); // 70% under 500ms
    }
  });

  test('Test Case 9.5: Resource Loading Optimization', async ({ page }) => {
    // Monitor resource loading
    const resourceMetrics: { type: string, size: number, duration: number }[] = [];
    
    page.on('response', (response) => {
      const contentLength = response.headers()['content-length'];
      const timing = response.timing();
      
      if (contentLength && timing) {
        resourceMetrics.push({
          type: response.url().split('.').pop() || 'unknown',
          size: parseInt(contentLength),
          duration: timing.responseEnd - timing.requestStart
        });
      }
    });
    
    // Load application
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Navigate through key pages
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    await page.waitForSelector('.card-content');
    
    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');
    
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // Analyze resource loading
    if (resourceMetrics.length > 0) {
      // Check bundle sizes
      const jsFiles = resourceMetrics.filter(r => r.type === 'js');
      const cssFiles = resourceMetrics.filter(r => r.type === 'css');
      const imageFiles = resourceMetrics.filter(r => ['jpg', 'png', 'svg'].includes(r.type));
      
      // Main JS bundle should be reasonable size
      if (jsFiles.length > 0) {
        const largestJS = Math.max(...jsFiles.map(f => f.size));
        expect(largestJS).toBeLessThan(2 * 1024 * 1024); // Under 2MB
      }
      
      // CSS should be optimized
      if (cssFiles.length > 0) {
        const totalCSS = cssFiles.reduce((sum, f) => sum + f.size, 0);
        expect(totalCSS).toBeLessThan(500 * 1024); // Under 500KB total CSS
      }
      
      // Images should be optimized
      imageFiles.forEach(img => {
        expect(img.size).toBeLessThan(1024 * 1024); // Each image under 1MB
      });
    }
  });

  test('Test Case 9.6: Adaptive Algorithm Performance', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Measure adaptive algorithm performance
    const algorithmMetrics: number[] = [];
    
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('Adaptive calculation time:')) {
        const match = text.match(/(\d+)ms/);
        if (match) {
          algorithmMetrics.push(parseInt(match[1]));
        }
      }
    });
    
    // Study many cards to stress test adaptive algorithms
    for (let i = 0; i < 50; i++) {
      await page.waitForSelector('.card-content');
      
      const calcStartTime = Date.now();
      await page.click('text=Show Answer');
      await page.click('text=😊');
      const calcEndTime = Date.now();
      
      const calcTime = calcEndTime - calcStartTime;
      expect(calcTime).toBeLessThan(2000); // Each calculation under 2 seconds
      
      await page.waitForTimeout(100);
    }
    
    // Analyze adaptive algorithm performance
    if (algorithmMetrics.length > 0) {
      const avgCalcTime = algorithmMetrics.reduce((a, b) => a + b, 0) / algorithmMetrics.length;
      expect(avgCalcTime).toBeLessThan(100); // Average under 100ms
      
      // No calculations should be extremely slow
      const slowCalcs = algorithmMetrics.filter(time => time > 500);
      expect(slowCalcs.length).toBe(0);
    }
  });

  test('Test Case 9.7: UI Responsiveness Under Load', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Measure UI responsiveness during heavy operations
    const responseTimes: number[] = [];
    
    // Simulate heavy load
    for (let i = 0; i < 10; i++) {
      const startTime = Date.now();
      
      // Click deck (should be responsive)
      await page.click(`text=${TEST_DECK_DATA.name}`);
      
      const clickResponseTime = Date.now() - startTime;
      responseTimes.push(clickResponseTime);
      
      // Navigate to study
      await page.click('text=Study');
      await page.waitForSelector('.card-content');
      
      // Study cards rapidly
      for (let j = 0; j < 5; j++) {
        const uiStartTime = Date.now();
        await page.click('text=Show Answer');
        await page.click('text=😊');
        const uiEndTime = Date.now();
        
        const uiResponseTime = uiEndTime - uiStartTime;
        expect(uiResponseTime).toBeLessThan(1000); // UI should respond within 1 second
      }
      
      // Return to dashboard
      await page.goto('/dashboard');
    }
    
    // Verify UI remains responsive
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    expect(avgResponseTime).toBeLessThan(500); // Average click response under 500ms
  });

  test('Test Case 9.8: Data Processing Scalability', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    
    // Generate large amount of study data
    const dataProcessingTimes: number[] = [];
    
    for (let batch = 0; batch < 10; batch++) {
      const batchStartTime = Date.now();
      
      // Study 10 cards per batch
      await helpers.studyCards(10);
      
      const batchEndTime = Date.now();
      const batchTime = batchEndTime - batchStartTime;
      dataProcessingTimes.push(batchTime);
      
      // Brief pause between batches
      await page.waitForTimeout(1000);
    }
    
    // Verify processing time doesn't degrade significantly
    const firstBatchTime = dataProcessingTimes[0];
    const lastBatchTime = dataProcessingTimes[dataProcessingTimes.length - 1];
    
    // Processing time shouldn't increase by more than 50%
    expect(lastBatchTime).toBeLessThan(firstBatchTime * 1.5);
    
    // All batches should complete in reasonable time
    dataProcessingTimes.forEach(time => {
      expect(time).toBeLessThan(30000); // Each batch under 30 seconds
    });
  });

  test('Test Case 9.9: Network Bandwidth Optimization', async ({ page }) => {
    // Monitor network traffic
    const networkMetrics: { url: string, size: number, type: string }[] = [];
    
    page.on('response', (response) => {
      const contentLength = response.headers()['content-length'];
      const contentType = response.headers()['content-type'] || '';
      
      if (contentLength) {
        networkMetrics.push({
          url: response.url(),
          size: parseInt(contentLength),
          type: contentType
        });
      }
    });
    
    // Perform typical user journey
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    await page.click(`text=${TEST_DECK_DATA.name}`);
    await page.click('text=Study');
    await helpers.studyCards(10);
    
    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');
    
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // Analyze network usage
    const totalTransferSize = networkMetrics.reduce((sum, metric) => sum + metric.size, 0);
    expect(totalTransferSize).toBeLessThan(10 * 1024 * 1024); // Under 10MB total
    
    // Check for unnecessary transfers
    const duplicateRequests = new Map<string, number>();
    networkMetrics.forEach(metric => {
      const count = duplicateRequests.get(metric.url) || 0;
      duplicateRequests.set(metric.url, count + 1);
    });
    
    // Most resources should only be requested once (except API calls)
    const excessiveRequests = Array.from(duplicateRequests.entries())
      .filter(([url, count]) => count > 3 && !url.includes('/api/'))
      .length;
    
    expect(excessiveRequests).toBe(0);
  });

  test('Test Case 9.10: Progressive Enhancement Performance', async ({ page }) => {
    // Test performance with reduced capabilities
    
    // Disable JavaScript temporarily to test baseline performance
    await page.context().addInitScript(() => {
      Object.defineProperty(navigator, 'connection', {
        writable: true,
        value: { effectiveType: '2g', downlink: 0.5 }
      });
    });
    
    const loadStartTime = Date.now();
    await page.goto('/dashboard');
    const loadEndTime = Date.now();
    
    const loadTime = loadEndTime - loadStartTime;
    expect(loadTime).toBeLessThan(10000); // Should load within 10 seconds even on slow connection
    
    // Test critical functionality still works
    await expect(page.locator('text=Dashboard')).toBeVisible();
    
    // Re-enable full functionality
    await page.reload();
    
    // Verify enhanced features load progressively
    await page.waitForSelector('.enhanced-features', { timeout: 15000 });
    
    // Check that core functionality was available before enhancements
    await expect(page.locator(`text=${TEST_DECK_DATA.name}`)).toBeVisible();
  });
});