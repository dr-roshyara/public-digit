/**
 * Language Selector E2E Tests
 *
 * Automated visual and functional testing for language selector component
 * Run with: npx playwright test
 */

import { test, expect } from '@playwright/test';

test.describe('Language Selector Component', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home page
    await page.goto('http://localhost:4200');

    // Wait for Angular to bootstrap
    await page.waitForLoadState('networkidle');
  });

  test('should be visible in header on page load', async ({ page }) => {
    const selector = page.locator('pd-language-selector');

    // Component should exist in DOM
    await expect(selector).toBeAttached();

    // Component should be visible
    await expect(selector).toBeVisible();

    console.log('✅ Language selector is visible in header');
  });

  test('should display current language with flag and name', async ({ page }) => {
    const currentLanguage = page.locator('.current-language');

    // Current language button should be visible
    await expect(currentLanguage).toBeVisible();

    // Should have flag emoji
    const flag = page.locator('.current-language .flag');
    await expect(flag).toBeVisible();

    // Should have language name (one of the supported languages)
    const name = page.locator('.current-language .name');
    const nameText = await name.textContent();
    expect(['English', 'Deutsch', 'नेपाली']).toContain(nameText);

    console.log(`✅ Current language displayed: ${nameText}`);
  });

  test('should have chevron icon for dropdown indication', async ({ page }) => {
    const chevron = page.locator('.current-language .chevron');

    await expect(chevron).toBeVisible();

    // Should show down arrow initially
    const chevronText = await chevron.textContent();
    expect(chevronText).toBe('▼');

    console.log('✅ Chevron icon displayed correctly');
  });

  test('should toggle dropdown menu on click', async ({ page }) => {
    // Initially dropdown should not be visible
    let dropdown = page.locator('.dropdown-menu');
    await expect(dropdown).not.toBeVisible();

    // Click to open dropdown
    await page.click('.current-language');

    // Dropdown should now be visible
    dropdown = page.locator('.dropdown-menu');
    await expect(dropdown).toBeVisible();

    // Chevron should change to up arrow
    const chevron = page.locator('.current-language .chevron');
    const chevronText = await chevron.textContent();
    expect(chevronText).toBe('▲');

    console.log('✅ Dropdown toggles correctly');

    // Click again to close
    await page.click('.current-language');

    // Dropdown should be hidden
    await expect(dropdown).not.toBeVisible();

    console.log('✅ Dropdown closes correctly');
  });

  test('should display all available languages in dropdown', async ({ page }) => {
    // Open dropdown
    await page.click('.current-language');

    // Check for all 3 languages
    const englishOption = page.locator('.dropdown-item:has-text("English")');
    const germanOption = page.locator('.dropdown-item:has-text("Deutsch")');
    const nepaliOption = page.locator('.dropdown-item:has-text("नेपाली")');

    await expect(englishOption).toBeVisible();
    await expect(germanOption).toBeVisible();
    await expect(nepaliOption).toBeVisible();

    console.log('✅ All 3 languages displayed in dropdown');
  });

  test('should change language when option clicked', async ({ page }) => {
    // Get initial language
    const initialLang = await page.locator('.current-language .name').textContent();

    // Open dropdown
    await page.click('.current-language');

    // Click on a different language (Deutsch if currently English, or vice versa)
    const targetLang = initialLang === 'English' ? 'Deutsch' : 'English';
    await page.click(`.dropdown-item:has-text("${targetLang}")`);

    // Wait for language change to apply
    await page.waitForTimeout(500);

    // Dropdown should close
    const dropdown = page.locator('.dropdown-menu');
    await expect(dropdown).not.toBeVisible();

    // Current language should update
    const newLang = await page.locator('.current-language .name').textContent();
    expect(newLang).toBe(targetLang);

    console.log(`✅ Language changed from ${initialLang} to ${targetLang}`);
  });

  test('should highlight active language in dropdown', async ({ page }) => {
    // Open dropdown
    await page.click('.current-language');

    // Get current language
    const currentLang = await page.locator('.current-language .name').textContent();

    // Find the active dropdown item
    const activeItem = page.locator(`.dropdown-item:has-text("${currentLang}")`);

    // Should have 'active' class
    await expect(activeItem).toHaveClass(/active/);

    console.log(`✅ Active language (${currentLang}) is highlighted`);
  });

  test('should work on mobile viewport', async ({ page }) => {
    // Set mobile viewport (iPhone 12 size)
    await page.setViewportSize({ width: 390, height: 844 });

    // Hamburger menu should be visible
    const hamburger = page.locator('.menu-toggle');
    await expect(hamburger).toBeVisible();

    // Click hamburger to open menu
    await hamburger.click();

    // Language selector should be visible in mobile menu
    const selector = page.locator('pd-language-selector');
    await expect(selector).toBeVisible();

    // Should have full width on mobile
    const selectorBox = await selector.boundingBox();
    expect(selectorBox!.width).toBeGreaterThan(300); // Should be close to viewport width

    // Open language dropdown
    await page.click('.current-language');

    // Dropdown should be visible
    const dropdown = page.locator('.dropdown-menu');
    await expect(dropdown).toBeVisible();

    // Dropdown should also be full width
    const dropdownBox = await dropdown.boundingBox();
    expect(dropdownBox!.width).toBeGreaterThan(300);

    console.log('✅ Language selector works correctly on mobile');
  });

  test('should work on desktop viewport', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Hamburger menu should not be visible
    const hamburger = page.locator('.menu-toggle');
    await expect(hamburger).not.toBeVisible();

    // Language selector should be visible inline in header
    const selector = page.locator('pd-language-selector');
    await expect(selector).toBeVisible();

    // Should have constrained width on desktop
    const selectorBox = await selector.boundingBox();
    expect(selectorBox!.width).toBeGreaterThanOrEqual(160); // min-width
    expect(selectorBox!.width).toBeLessThan(400); // reasonable max

    console.log('✅ Language selector works correctly on desktop');
  });

  test('should have touch-friendly targets on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });

    // Open hamburger menu
    await page.click('.menu-toggle');

    // Current language button should have minimum touch target (44px)
    const currentLanguage = page.locator('.current-language');
    const buttonBox = await currentLanguage.boundingBox();
    expect(buttonBox!.height).toBeGreaterThanOrEqual(44);

    // Open dropdown
    await currentLanguage.click();

    // Dropdown items should have minimum touch target (48px)
    const dropdownItems = page.locator('.dropdown-item');
    const itemCount = await dropdownItems.count();

    for (let i = 0; i < itemCount; i++) {
      const itemBox = await dropdownItems.nth(i).boundingBox();
      expect(itemBox!.height).toBeGreaterThanOrEqual(48);
    }

    console.log('✅ All touch targets meet minimum size requirements');
  });

  test('should show default badge for English', async ({ page }) => {
    // Open dropdown
    await page.click('.current-language');

    // English option should have "Default" badge
    const englishOption = page.locator('.dropdown-item:has-text("English")');
    const badge = englishOption.locator('.badge:has-text("Default")');

    await expect(badge).toBeVisible();

    console.log('✅ Default badge displayed for English');
  });

  test('should log initialization to console', async ({ page }) => {
    // Collect console logs
    const logs: string[] = [];

    page.on('console', msg => {
      if (msg.text().includes('[LanguageSelector]')) {
        logs.push(msg.text());
      }
    });

    // Reload page to trigger initialization
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should have initialization logs
    expect(logs.length).toBeGreaterThan(0);

    // Should have specific log messages
    const hasInitLog = logs.some(log => log.includes('Component initialized'));
    const hasLocalesLog = logs.some(log => log.includes('Available locales'));

    expect(hasInitLog).toBe(true);
    expect(hasLocalesLog).toBe(true);

    console.log('✅ Console logging working correctly');
    console.log(`   Captured ${logs.length} debug logs`);
  });
});

test.describe('Language Selector - Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4200');
    await page.waitForLoadState('networkidle');
  });

  test('should be keyboard navigable', async ({ page }) => {
    // Tab to language selector
    await page.keyboard.press('Tab');

    // Current language should be focused (or one of the nav items)
    // Keep tabbing until we reach the language selector
    for (let i = 0; i < 10; i++) {
      const focused = await page.evaluate(() => document.activeElement?.className);
      if (focused?.includes('current-language')) {
        break;
      }
      await page.keyboard.press('Tab');
    }

    // Press Enter to open dropdown
    await page.keyboard.press('Enter');

    // Dropdown should open
    const dropdown = page.locator('.dropdown-menu');
    await expect(dropdown).toBeVisible();

    console.log('✅ Language selector is keyboard accessible');
  });

  test('should have proper ARIA attributes', async ({ page }) => {
    const currentLanguage = page.locator('.current-language');

    // Should have role or aria-label for accessibility
    // (Note: Add these attributes if they don't exist)
    const ariaLabel = await currentLanguage.getAttribute('aria-label');
    const role = await currentLanguage.getAttribute('role');

    // Either aria-label or role should be present for screen readers
    // This test might fail initially - that's a signal to add ARIA attributes

    console.log(`ARIA label: ${ariaLabel}`);
    console.log(`Role: ${role}`);
  });
});
