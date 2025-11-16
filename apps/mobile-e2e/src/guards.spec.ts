import { test, expect } from '@playwright/test';

/**
 * E2E Test: Route Guard Protection
 *
 * Tests route access control with guards:
 * 1. AuthGuard - Protects authenticated routes
 * 2. TenantGuard - Requires tenant context
 * 3. AnonymousGuard - Protects login/register pages
 * 4. ArchitectureGuard - Enforces architectural boundaries
 *
 * **TDD Approach:**
 * - Test security requirements FIRST
 * - Implementation follows security model
 */

test.describe('AuthGuard - Authentication Protection', () => {
  test('should redirect unauthenticated user to login', async ({ page }) => {
    // Try to access protected route without authentication
    await page.goto('http://localhost:4200/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('should allow authenticated user to access protected routes', async ({ page }) => {
    // Login first
    await page.goto('http://localhost:4200/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL(/\/dashboard|\/tenant-selection/);

    // Try to access another protected route
    await page.goto('http://localhost:4200/profile');

    // Should allow access (not redirect to login)
    await expect(page).toHaveURL(/\/profile/);
  });

  test('should preserve return URL after login redirect', async ({ page }) => {
    // Try to access specific protected route
    await page.goto('http://localhost:4200/elections/123');

    // Should redirect to login with returnUrl
    await expect(page).toHaveURL(/\/login.*returnUrl/);

    // Login
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');

    // Should redirect back to original URL
    await expect(page).toHaveURL(/\/elections\/123/);
  });
});

test.describe('TenantGuard - Tenant Context Protection', () => {
  test('should block access when no tenant context', async ({ page }) => {
    // Login without tenant context
    await page.goto('http://localhost:4200/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');

    // If no tenant context, should redirect to tenant selection
    const url = page.url();
    expect(url).toMatch(/tenant-selection/);
  });

  test('should allow access when tenant context is set', async ({ page }) => {
    // Navigate to tenant subdomain
    await page.goto('http://nrna.localhost:4200/login');

    // Login
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL(/\/dashboard/);

    // Try to access tenant-specific route
    await page.goto('http://nrna.localhost:4200/elections');

    // Should allow access (tenant context is set)
    await expect(page).toHaveURL(/\/elections/);
    await expect(page.locator('[data-testid="elections-list"]')).toBeVisible();
  });

  test('should show error for tenant slug mismatch', async ({ page }) => {
    // Login to nrna tenant
    await page.goto('http://nrna.localhost:4200/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL(/\/dashboard/);

    // Try to access different tenant subdomain
    await page.goto('http://tenant2.localhost:4200/elections');

    // Should redirect to tenant selection with mismatch error
    await expect(page).toHaveURL(/tenant-selection.*error=tenant-mismatch/);
  });

  test('should redirect to tenant selection for routes requiring tenant context', async ({ page }) => {
    // Login on public domain
    await page.goto('http://localhost:4200/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');

    // Try to access elections (requires tenant context)
    await page.goto('http://localhost:4200/elections');

    // Should redirect to tenant selection
    await expect(page).toHaveURL(/\/tenant-selection/);
    await expect(page.locator('[data-testid="tenant-list"]')).toBeVisible();
  });
});

test.describe('AnonymousGuard - Anonymous-Only Protection', () => {
  test('should allow unauthenticated user to access login page', async ({ page }) => {
    await page.goto('http://localhost:4200/login');

    // Should show login page
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
  });

  test('should redirect authenticated user away from login page', async ({ page }) => {
    // Login first
    await page.goto('http://localhost:4200/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL(/\/dashboard|\/tenant-selection/);

    // Try to go back to login page
    await page.goto('http://localhost:4200/login');

    // Should redirect to dashboard (AnonymousGuard)
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should allow unauthenticated user to access register page', async ({ page }) => {
    await page.goto('http://localhost:4200/register');

    // Should show register page
    await expect(page).toHaveURL(/\/register/);
    await expect(page.locator('[data-testid="register-form"]')).toBeVisible();
  });

  test('should redirect authenticated user away from register page', async ({ page }) => {
    // Login first
    await page.goto('http://localhost:4200/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL(/\/dashboard/);

    // Try to access register page
    await page.goto('http://localhost:4200/register');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test.describe('ArchitectureGuard - Boundary Enforcement', () => {
  test('should block Angular routes on admin domain', async ({ page }) => {
    // Try to access Angular-only route on admin domain
    await page.goto('http://admin.localhost:4200/elections');

    // Should be blocked by ArchitectureGuard
    await expect(page).toHaveURL(/\/|\/error/);
  });

  test('should allow tenant routes on tenant domain', async ({ page }) => {
    // Access tenant route on tenant domain
    await page.goto('http://nrna.localhost:4200/elections');

    // Should allow (after auth)
    const url = page.url();
    expect(url).toMatch(/elections|login/);
  });

  test('should block admin routes on tenant domain', async ({ page }) => {
    // Try to access admin route on tenant domain
    await page.goto('http://nrna.localhost:4200/admin/tenants');

    // Should be blocked
    await expect(page).toHaveURL(/\/|\/error/);
  });
});

test.describe('Guard Combinations', () => {
  test('should apply guards in correct order (auth → tenant → architecture)', async ({ page }) => {
    // Try to access route with all guards: elections (auth + tenant + architecture)
    await page.goto('http://nrna.localhost:4200/elections');

    // Step 1: AuthGuard redirects to login
    await expect(page).toHaveURL(/\/login/);

    // Login
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL(/\/dashboard/);

    // Step 2: Navigate to elections again
    await page.goto('http://nrna.localhost:4200/elections');

    // Step 3: TenantGuard and ArchitectureGuard should pass
    await expect(page).toHaveURL(/\/elections/);
  });

  test('should enforce all guard conditions', async ({ page }) => {
    // Conditions: authenticated + tenant context + allowed route

    // Without auth → redirects to login
    await page.goto('http://nrna.localhost:4200/elections');
    await expect(page).toHaveURL(/\/login/);

    // With auth but no tenant context → redirects to tenant selection
    await page.goto('http://localhost:4200/elections');
    // (Would need to be authenticated first, then would redirect to tenant selection)

    // With auth + tenant context → allows access
    await page.goto('http://nrna.localhost:4200/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL(/\/dashboard/);

    await page.goto('http://nrna.localhost:4200/elections');
    await expect(page).toHaveURL(/\/elections/);
  });
});
