import { test, expect } from '@playwright/test';

/**
 * E2E Test: Authentication Flow
 *
 * Tests the complete user authentication journey:
 * 1. Navigate to login page
 * 2. Enter credentials
 * 3. Submit login form
 * 4. Verify redirect to dashboard
 * 5. Check authenticated state
 *
 * **TDD Approach:**
 * - Test scenarios written FIRST
 * - Implementation follows test requirements
 */

test.describe('Authentication Flow', () => {
  const BASE_URL = 'http://localhost:4200';
  const TEST_USER = {
    email: 'test@example.com',
    password: 'password123'
  };

  test.beforeEach(async ({ page }) => {
    // Clear any existing session
    await page.context().clearCookies();
    await page.goto(BASE_URL);
  });

  test('should display login page for unauthenticated users', async ({ page }) => {
    // Navigate to protected route
    await page.goto(`${BASE_URL}/dashboard`);

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('h1')).toContainText('Login');
  });

  test('should login user with valid credentials', async ({ page }) => {
    // Navigate to login page
    await page.goto(`${BASE_URL}/login`);

    // Fill login form
    await page.fill('[data-testid="email-input"]', TEST_USER.email);
    await page.fill('[data-testid="password-input"]', TEST_USER.password);

    // Submit form
    await page.click('[data-testid="login-button"]');

    // Wait for authentication to complete
    await page.waitForURL(/\/dashboard|\/tenant-selection/);

    // Verify user is authenticated
    const url = page.url();
    expect(url).toMatch(/dashboard|tenant-selection/);
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Navigate to login page
    await page.goto(`${BASE_URL}/login`);

    // Fill with invalid credentials
    await page.fill('[data-testid="email-input"]', 'wrong@example.com');
    await page.fill('[data-testid="password-input"]', 'wrongpassword');

    // Submit form
    await page.click('[data-testid="login-button"]');

    // Wait for error message
    await page.waitForSelector('[data-testid="error-message"]');

    // Verify error displayed
    const errorMessage = await page.locator('[data-testid="error-message"]').textContent();
    expect(errorMessage).toContain('Invalid credentials');
  });

  test('should redirect authenticated user away from login page', async ({ page }) => {
    // Login first
    await page.goto(`${BASE_URL}/login`);
    await page.fill('[data-testid="email-input"]', TEST_USER.email);
    await page.fill('[data-testid="password-input"]', TEST_USER.password);
    await page.click('[data-testid="login-button"]');
    await page.waitForURL(/\/dashboard|\/tenant-selection/);

    // Try to go back to login page
    await page.goto(`${BASE_URL}/login`);

    // Should redirect to dashboard (AnonymousGuard)
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should logout user successfully', async ({ page }) => {
    // Login first
    await page.goto(`${BASE_URL}/login`);
    await page.fill('[data-testid="email-input"]', TEST_USER.email);
    await page.fill('[data-testid="password-input"]', TEST_USER.password);
    await page.click('[data-testid="login-button"]');
    await page.waitForURL(/\/dashboard/);

    // Click logout button
    await page.click('[data-testid="logout-button"]');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);

    // Verify can't access protected route
    await page.goto(`${BASE_URL}/dashboard`);
    await expect(page).toHaveURL(/\/login/);
  });

  test('should validate form fields before submission', async ({ page }) => {
    // Navigate to login page
    await page.goto(`${BASE_URL}/login`);

    // Try to submit empty form
    await page.click('[data-testid="login-button"]');

    // Verify validation errors shown
    await expect(page.locator('[data-testid="email-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-error"]')).toBeVisible();
  });

  test('should persist authentication across page refreshes', async ({ page }) => {
    // Login
    await page.goto(`${BASE_URL}/login`);
    await page.fill('[data-testid="email-input"]', TEST_USER.email);
    await page.fill('[data-testid="password-input"]', TEST_USER.password);
    await page.click('[data-testid="login-button"]');
    await page.waitForURL(/\/dashboard/);

    // Refresh page
    await page.reload();

    // Should still be authenticated
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('should show loading state during authentication', async ({ page }) => {
    // Navigate to login page
    await page.goto(`${BASE_URL}/login`);

    // Fill form
    await page.fill('[data-testid="email-input"]', TEST_USER.email);
    await page.fill('[data-testid="password-input"]', TEST_USER.password);

    // Submit and check for loading state
    await page.click('[data-testid="login-button"]');

    // Loading indicator should be visible
    await expect(page.locator('[data-testid="login-loading"]')).toBeVisible();
  });
});

test.describe('Password Reset Flow', () => {
  const BASE_URL = 'http://localhost:4200';

  test('should navigate to forgot password page', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    // Click forgot password link
    await page.click('[data-testid="forgot-password-link"]');

    // Should navigate to forgot password page
    await expect(page).toHaveURL(/\/forgot-password/);
  });

  test('should send password reset email', async ({ page }) => {
    await page.goto(`${BASE_URL}/forgot-password`);

    // Enter email
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.click('[data-testid="reset-button"]');

    // Should show success message
    await expect(page.locator('[data-testid="success-message"]')).toContainText('reset email sent');
  });
});
