import { test, expect } from '@playwright/test';

test.describe('Diagnostic Tests', () => {
  test('Check what elements are on the landing page', async ({ page }) => {
    await page.goto('/');
    
    // Take screenshot to see what's actually there
    await page.screenshot({ path: 'landing-page.png' });
    
    // Get page title
    const title = await page.title();
    console.log('Page title:', title);
    
    // Get all text content
    const bodyText = await page.locator('body').textContent();
    console.log('Page content:', bodyText);
    
    // Look for common auth elements with various selectors
    const loginSelectors = [
      'text=Login',
      'text=Sign In', 
      'text=Sign in',
      'text=Log In',
      'text=log in',
      'button:has-text("Login")',
      'button:has-text("Sign")',
      'a:has-text("Login")',
      'a:has-text("Sign")',
      '[data-testid="login"]',
      '.login-button',
      '#login'
    ];
    
    for (const selector of loginSelectors) {
      const element = page.locator(selector);
      const isVisible = await element.isVisible();
      if (isVisible) {
        console.log(`Found login element with selector: ${selector}`);
        const text = await element.textContent();
        console.log(`Element text: ${text}`);
      }
    }
    
    // Check if we're already logged in or on a different page
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    
    // Look for navigation elements
    const navElements = await page.locator('nav, header, .navigation').count();
    console.log('Navigation elements found:', navElements);
    
    // Look for any buttons
    const buttons = await page.locator('button').count();
    console.log('Button count:', buttons);
    
    if (buttons > 0) {
      for (let i = 0; i < Math.min(buttons, 5); i++) {
        const buttonText = await page.locator('button').nth(i).textContent();
        console.log(`Button ${i}: ${buttonText}`);
      }
    }
    
    // Look for any links
    const links = await page.locator('a').count();
    console.log('Link count:', links);
    
    if (links > 0) {
      for (let i = 0; i < Math.min(links, 5); i++) {
        const linkText = await page.locator('a').nth(i).textContent();
        console.log(`Link ${i}: ${linkText}`);
      }
    }
  });
});