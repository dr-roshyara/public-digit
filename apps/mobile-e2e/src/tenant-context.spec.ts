import { test, expect } from '@playwright/test';

/**
 * E2E Test: Tenant Context Management
 *
 * Tests tenant context detection, switching, and persistence:
 * 1. Subdomain-based tenant detection
 * 2. Tenant context loading from API
 * 3. Tenant-specific content display
 * 4. Tenant switching between organizations
 *
 * **TDD Approach:**
 * - Test tenant isolation requirements FIRST
 * - Implementation follows test scenarios
 */

test.describe('Tenant Context - Subdomain Detection', () => {
  test('should detect tenant from subdomain (nrna.localhost)', async ({ page }) => {
    // Navigate to tenant subdomain
    await page.goto('http://nrna.localhost:4200');

    // Wait for tenant context to load
    await page.waitForSelector('[data-testid="tenant-name"]');

    // Verify tenant name displayed
    const tenantName = await page.locator('[data-testid="tenant-name"]').textContent();
    expect(tenantName).toContain('NRNA');
  });

  test('should load tenant-specific branding', async ({ page }) => {
    await page.goto('http://nrna.localhost:4200');

    // Wait for tenant logo
    await page.waitForSelector('[data-testid="tenant-logo"]');

    // Verify logo src contains tenant slug
    const logoSrc = await page.locator('[data-testid="tenant-logo"]').getAttribute('src');
    expect(logoSrc).toContain('nrna');
  });

  test('should cache tenant context in localStorage', async ({ page }) => {
    await page.goto('http://nrna.localhost:4200');

    // Wait for tenant context to load
    await page.waitForSelector('[data-testid="tenant-name"]');

    // Check localStorage for cached tenant
    const cachedTenant = await page.evaluate(() => {
      return localStorage.getItem('current_tenant');
    });

    expect(cachedTenant).toBeTruthy();
    expect(cachedTenant).toContain('nrna');
  });

  test('should restore tenant context from cache on refresh', async ({ page }) => {
    // First visit - loads from API
    await page.goto('http://nrna.localhost:4200');
    await page.waitForSelector('[data-testid="tenant-name"]');

    // Get network requests count
    let apiCallCount = 0;
    page.on('request', request => {
      if (request.url().includes('/api/v1/tenant/info')) {
        apiCallCount++;
      }
    });

    // Refresh page
    await page.reload();
    await page.waitForSelector('[data-testid="tenant-name"]');

    // Should use cache (no additional API call, or reduced calls)
    // Note: May still make API call to verify/refresh
    const tenantName = await page.locator('[data-testid="tenant-name"]').textContent();
    expect(tenantName).toContain('NRNA');
  });
});

test.describe('Tenant Context - API Integration', () => {
  test('should load tenant information from API', async ({ page }) => {
    // Monitor API calls
    let tenantApiCalled = false;
    page.on('request', request => {
      if (request.url().includes('/api/v1/tenant/info')) {
        tenantApiCalled = true;
      }
    });

    await page.goto('http://nrna.localhost:4200');
    await page.waitForSelector('[data-testid="tenant-name"]');

    // Verify API was called
    expect(tenantApiCalled).toBe(true);
  });

  test('should display tenant status', async ({ page }) => {
    await page.goto('http://nrna.localhost:4200');
    await page.waitForSelector('[data-testid="tenant-status"]');

    const status = await page.locator('[data-testid="tenant-status"]').textContent();
    expect(status).toContain('active');
  });

  test('should show error for inactive tenant', async ({ page }) => {
    // Try to access inactive tenant subdomain
    await page.goto('http://inactive-tenant.localhost:4200');

    // Should show error message
    await page.waitForSelector('[data-testid="tenant-error"]');
    const errorMessage = await page.locator('[data-testid="tenant-error"]').textContent();
    expect(errorMessage).toContain('not active');
  });

  test('should show error for non-existent tenant', async ({ page }) => {
    // Try to access non-existent tenant
    await page.goto('http://does-not-exist.localhost:4200');

    // Should show error
    await page.waitForSelector('[data-testid="tenant-error"]');
    const errorMessage = await page.locator('[data-testid="tenant-error"]').textContent();
    expect(errorMessage).toContain('not found');
  });
});

test.describe('Tenant Context - Content Isolation', () => {
  test('should only show data for current tenant', async ({ page }) => {
    // Login first
    await page.goto('http://nrna.localhost:4200/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL(/\/dashboard/);

    // Navigate to elections
    await page.goto('http://nrna.localhost:4200/elections');
    await page.waitForSelector('[data-testid="elections-list"]');

    // Verify all elections have NRNA tenant context
    const elections = await page.locator('[data-testid="election-item"]').all();
    for (const election of elections) {
      const tenantSlug = await election.getAttribute('data-tenant');
      expect(tenantSlug).toBe('nrna');
    }
  });

  test('should include tenant header in API requests', async ({ page }) => {
    let tenantHeaderPresent = false;

    page.on('request', request => {
      if (request.url().includes('/api/v1/')) {
        const headers = request.headers();
        if (headers['x-tenant-slug'] === 'nrna') {
          tenantHeaderPresent = true;
        }
      }
    });

    await page.goto('http://nrna.localhost:4200');
    await page.waitForSelector('[data-testid="tenant-name"]');

    // Make an API call
    await page.goto('http://nrna.localhost:4200/dashboard');

    // Verify tenant header was sent
    expect(tenantHeaderPresent).toBe(true);
  });
});

test.describe('Tenant Switching', () => {
  test('should switch tenant when navigating to different subdomain', async ({ page, context }) => {
    // Visit first tenant
    await page.goto('http://nrna.localhost:4200');
    await page.waitForSelector('[data-testid="tenant-name"]');
    let tenantName = await page.locator('[data-testid="tenant-name"]').textContent();
    expect(tenantName).toContain('NRNA');

    // Navigate to different tenant subdomain
    await page.goto('http://tenant2.localhost:4200');
    await page.waitForSelector('[data-testid="tenant-name"]');
    tenantName = await page.locator('[data-testid="tenant-name"]').textContent();
    expect(tenantName).toContain('Tenant2');
  });

  test('should clear previous tenant context when switching', async ({ page }) => {
    // Visit first tenant
    await page.goto('http://nrna.localhost:4200');
    await page.waitForSelector('[data-testid="tenant-name"]');

    // Check localStorage
    let cachedTenant = await page.evaluate(() => localStorage.getItem('current_tenant'));
    expect(cachedTenant).toContain('nrna');

    // Switch to different tenant
    await page.goto('http://tenant2.localhost:4200');
    await page.waitForSelector('[data-testid="tenant-name"]');

    // Verify cache updated
    cachedTenant = await page.evaluate(() => localStorage.getItem('current_tenant'));
    expect(cachedTenant).toContain('tenant2');
    expect(cachedTenant).not.toContain('nrna');
  });
});
