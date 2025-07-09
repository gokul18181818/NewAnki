import { test, expect } from '@playwright/test';
import { TestHelpers, TEST_USER } from './utils/testHelpers';

test.describe('Authentication & User Session Management', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
  });

  test('Test Case 1.1: User Login Flow', async ({ page }) => {
    // Step 1: Navigate to http://localhost:5173
    await page.goto('/');
    
    // Step 2: Verify landing page loads correctly
    await expect(page.locator('h1')).toContainText('StudyBuddy');
    
    // Step 3: Click "Sign In" button
    await page.click('text=Sign In');
    
    // Step 4: Enter email
    await page.fill('input[type="email"]', TEST_USER.email);
    
    // Step 5: Enter password
    await page.fill('input[type="password"]', TEST_USER.password);
    
    // Step 6: Submit form
    await page.click('button[type="submit"]');
    
    // Step 7: Wait for redirect to dashboard
    await page.waitForURL('/dashboard');
    
    // Step 8: Verify user context loads with preferences
    await helpers.verifyUserContextLoads();
    
    // Step 9: Validate session persistence across page refreshes
    await helpers.testSessionPersistence();
    
    // Expected Outcomes:
    // ✅ UserContext.tsx logs show successful preference loading
    await helpers.waitForConsoleLog('✅ Auth change - Setting user with preferences');
    
    // ✅ Dashboard displays personalized greeting with user's name
    await expect(page.locator('text=Welcome back')).toBeVisible();
    
    // ✅ Adaptive recommendations appear in Settings
    await helpers.verifyAdaptiveRecommendations();
    
    // ✅ No authentication errors in console
    await helpers.verifyNoNullReferenceErrors();
  });

  test('Test Case 1.2: Session Persistence', async ({ page }) => {
    // Complete login flow
    await helpers.login();
    
    // Navigate to /settings
    await page.goto('/settings');
    await expect(page.locator('h1')).toContainText('Settings');
    
    // Refresh browser (F5)
    await page.reload();
    
    // Verify user remains logged in
    await page.waitForTimeout(3000); // Wait for auth check
    await expect(page.locator('h1')).toContainText('Settings');
    
    // Validate preferences persist
    await expect(page.locator('text=Study Preferences')).toBeVisible();
    
    // Check adaptive recommendations reload correctly
    await helpers.verifyAdaptiveRecommendations();
  });

  test('Test Case 1.3: Logout Flow', async ({ page }) => {
    // Login first
    await helpers.login();
    
    // Verify we're on dashboard
    await expect(page.locator('text=Dashboard')).toBeVisible();
    
    // Click logout button
    await page.click('text=Logout');
    
    // Should redirect to landing page
    await page.waitForURL('/');
    
    // Verify we're logged out
    await expect(page.locator('text=Sign In')).toBeVisible();
    
    // Try to access protected route
    await page.goto('/dashboard');
    
    // Should redirect to login
    await page.waitForURL('/login');
  });

  test('Test Case 1.4: Invalid Login Credentials', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Sign In');
    
    // Enter invalid credentials
    await page.fill('input[type="email"]', 'invalid@email.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Should show error message
    await expect(page.locator('text=Invalid credentials')).toBeVisible();
    
    // Should remain on login page
    await expect(page.locator('text=Sign In')).toBeVisible();
  });

  test('Test Case 1.5: Protected Route Access', async ({ page }) => {
    // Try to access protected routes without authentication
    const protectedRoutes = ['/dashboard', '/study', '/settings', '/analytics'];
    
    for (const route of protectedRoutes) {
      await page.goto(route);
      
      // Should redirect to login
      await page.waitForURL('/login');
      await expect(page.locator('text=Sign In')).toBeVisible();
    }
  });

  test('Test Case 1.6: User Context Initialization', async ({ page }) => {
    // Monitor console logs during login
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      consoleLogs.push(msg.text());
    });
    
    await helpers.login();
    
    // Verify expected initialization sequence
    const expectedLogs = [
      '🚀 Initializing user session...',
      '✅ Auth change - Setting user with preferences',
      '🔄 Loading fresh adaptive recommendations...',
      '🎯 Fresh recommendations loaded:'
    ];
    
    // Check that each expected log appears
    for (const expectedLog of expectedLogs) {
      const found = consoleLogs.some(log => log.includes(expectedLog));
      expect(found).toBe(true);
    }
    
    // Verify no null reference errors
    const nullErrors = consoleLogs.filter(log => 
      log.includes('Cannot read properties of null')
    );
    expect(nullErrors.length).toBe(0);
  });

  test('Test Case 1.7: Session Timeout Handling', async ({ page }) => {
    await helpers.login();
    
    // Wait for a significant time (simulate session timeout)
    // In real test, this would be configured session timeout
    await page.waitForTimeout(5000);
    
    // Try to perform an action that requires authentication
    await page.goto('/settings');
    
    // Should handle timeout gracefully
    await expect(page.locator('text=Settings')).toBeVisible();
  });

  test('Test Case 1.8: Multiple Tab Session Sync', async ({ context, page }) => {
    await helpers.login();
    
    // Open new tab
    const newPage = await context.newPage();
    await newPage.goto('/dashboard');
    
    // Should be automatically logged in
    await expect(newPage.locator('text=Dashboard')).toBeVisible();
    
    // Logout from original tab
    await page.click('text=Logout');
    
    // New tab should also be logged out when refreshed
    await newPage.reload();
    await newPage.waitForURL('/login');
    
    await newPage.close();
  });
});