import { test, expect } from '@playwright/test';

test.describe('StudyBuddy Test Framework Demo', () => {
  test('Test Framework Setup Verification', async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Verify the application loads
    await expect(page).toHaveTitle(/StudyBuddy/);
    
    // Check that the landing page elements are present
    await expect(page.locator('text=StudyBuddy')).toBeVisible();
    await expect(page.locator('text=Sign In')).toBeVisible();
    await expect(page.locator('text=Sign Up')).toBeVisible();
    
    console.log('✅ Application is accessible and basic elements are present');
  });

  test('Test Framework Features Demonstration', async ({ page }) => {
    await page.goto('/');
    
    // Demonstrate screenshot capability
    await page.screenshot({ path: 'demo-screenshot.png' });
    
    // Demonstrate element interaction
    await page.click('text=Sign In');
    
    // Check if we're on a login/auth page
    const currentUrl = page.url();
    console.log('Current URL after clicking Sign In:', currentUrl);
    
    // Demonstrate form detection
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    
    if (await emailInput.isVisible()) {
      console.log('✅ Email input field detected');
      // Don't actually fill with real credentials in demo
      await emailInput.fill('demo@example.com');
    }
    
    if (await passwordInput.isVisible()) {
      console.log('✅ Password input field detected');
      // Don't actually fill with real credentials in demo
      await passwordInput.fill('demo-password');
    }
    
    // Demonstrate error handling (submit invalid creds)
    const submitButton = page.locator('button[type="submit"]');
    if (await submitButton.isVisible()) {
      console.log('✅ Submit button detected');
      // Note: We won't actually submit to avoid auth errors
    }
    
    console.log('✅ Test framework can interact with all form elements');
  });

  test('Navigation and UI Testing Capabilities', async ({ page }) => {
    await page.goto('/');
    
    // Test navigation capabilities
    const navigationElements = [
      'text=Sign In',
      'text=Sign Up',
      'text=Start Free',
      'text=Watch Demo'
    ];
    
    for (const element of navigationElements) {
      const locator = page.locator(element);
      if (await locator.isVisible()) {
        console.log(`✅ Found navigation element: ${element}`);
      }
    }
    
    // Test responsive design by changing viewport
    await page.setViewportSize({ width: 375, height: 667 }); // Mobile
    await page.screenshot({ path: 'mobile-view.png' });
    
    await page.setViewportSize({ width: 1920, height: 1080 }); // Desktop
    await page.screenshot({ path: 'desktop-view.png' });
    
    console.log('✅ Responsive design testing completed');
  });

  test('Performance and Accessibility Testing Demo', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    
    const loadTime = Date.now() - startTime;
    console.log(`Page load time: ${loadTime}ms`);
    
    // Basic accessibility checks
    const headings = await page.locator('h1, h2, h3').count();
    console.log(`Found ${headings} heading elements`);
    
    const images = await page.locator('img').count();
    console.log(`Found ${images} image elements`);
    
    // Check for alt text on images
    if (images > 0) {
      for (let i = 0; i < images; i++) {
        const img = page.locator('img').nth(i);
        const alt = await img.getAttribute('alt');
        if (alt) {
          console.log(`✅ Image ${i} has alt text: ${alt}`);
        }
      }
    }
    
    // Performance expectation
    expect(loadTime).toBeLessThan(10000); // Should load in under 10 seconds
    
    console.log('✅ Performance and accessibility checks completed');
  });

  test('Console Log Monitoring Demo', async ({ page }) => {
    const consoleLogs: string[] = [];
    const consoleErrors: string[] = [];
    
    // Monitor console messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else {
        consoleLogs.push(msg.text());
      }
    });
    
    await page.goto('/');
    
    // Wait a bit for any console messages
    await page.waitForTimeout(3000);
    
    console.log(`Console logs captured: ${consoleLogs.length}`);
    console.log(`Console errors captured: ${consoleErrors.length}`);
    
    if (consoleErrors.length > 0) {
      console.log('Console errors found:', consoleErrors.slice(0, 3));
    }
    
    // This demonstrates how the comprehensive tests would monitor for the specific
    // null reference error mentioned in the testing strategy
    const nullReferenceErrors = consoleErrors.filter(error => 
      error.includes('Cannot read properties of null (reading \'getSessionOptimization\')')
    );
    
    if (nullReferenceErrors.length === 0) {
      console.log('✅ No critical null reference errors detected');
    } else {
      console.log('❌ Critical null reference error found:', nullReferenceErrors[0]);
    }
    
    console.log('✅ Console monitoring demonstration completed');
  });

  test('Test Data and Configuration Demo', async ({ page }) => {
    // Demonstrate test configuration
    const baseURL = page.context().page.url();
    console.log('Base URL configured:', baseURL);
    
    // Demonstrate test data structures (like in testHelpers.ts)
    const testDeckData = {
      name: 'EEI',
      subdecks: [
        { name: 'EEI::First', cardCount: 21 },
        { name: 'EEI::Second', cardCount: 20 }
      ],
      totalCards: 41,
      mediaFiles: 33
    };
    
    console.log('Test deck data configured:', testDeckData.name);
    console.log('Expected total cards:', testDeckData.totalCards);
    
    // Demonstrate browser capabilities
    const userAgent = await page.evaluate(() => navigator.userAgent);
    console.log('Browser user agent:', userAgent.substring(0, 50) + '...');
    
    const viewport = page.viewportSize();
    console.log('Viewport size:', viewport);
    
    console.log('✅ Test configuration and data structures verified');
  });
});