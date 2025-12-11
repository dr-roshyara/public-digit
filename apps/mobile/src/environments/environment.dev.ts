/**
 * Platform Mobile API URL (NO tenant slug)
 * Used for: login, logout, getting tenant list, platform health
 */
function getPlatformApiUrl(): string {
  // Check if running on mobile (Capacitor)
  const isMobile = !!(window as any).Capacitor;

  if (!isMobile) {
    // Browser development - platform mobile API
    console.log('🌐 Platform API: Browser (localhost)');
    return 'http://localhost:8000/mapi/v1';
  }

  // Running on mobile device
  const platform = (window as any).Capacitor?.getPlatform?.() || 'web';

  if (platform === 'android') {
    // Android Emulator uses 10.0.2.2 to access host machine
    console.log('📱 Platform API: Android Emulator (10.0.2.2)');
    return 'http://10.0.2.2:8000/mapi/v1';
  }

  // Fallback to localhost
  console.log('⚠️ Platform API: Unknown platform, using localhost');
  return 'http://localhost:8000/mapi/v1';
}

/**
 * Tenant Mobile API URL (WITH tenant slug)
 * Used for: elections, voting, profile, dashboard, all tenant operations
 */
function getTenantApiUrl(slug: string): string {
  if (!slug || slug.trim() === '') {
    throw new Error('Tenant slug is required');
  }

  // Check if running on mobile (Capacitor)
  const isMobile = !!(window as any).Capacitor;

  if (!isMobile) {
    // Browser development - path-based tenancy
    console.log(`🌐 Tenant API: Browser (localhost) - Tenant: ${slug}`);
    return `http://localhost:8000/${slug}/mapi/v1`;
  }

  // Running on mobile device
  const platform = (window as any).Capacitor?.getPlatform?.() || 'web';

  if (platform === 'android') {
    // Android Emulator uses 10.0.2.2 to access host machine
    console.log(`📱 Tenant API: Android Emulator (10.0.2.2) - Tenant: ${slug}`);
    return `http://10.0.2.2:8000/${slug}/mapi/v1`;
  }

  // Fallback to localhost
  console.log(`⚠️ Tenant API: Unknown platform, using localhost - Tenant: ${slug}`);
  return `http://localhost:8000/${slug}/mapi/v1`;
}

export const environment: {
  production: boolean;
  appId: string;
  appName: string;
  version: string;
  getPlatformApiUrl: () => string;
  getTenantApiUrl: (slug: string) => string;
} = {
  production: false,
  appId: 'com.publicdigit.app.dev',
  appName: 'PublicDigit Dev',
  version: '1.0.0-dev',

  // Platform API - NO tenant slug (login, tenant list, platform health)
  getPlatformApiUrl: getPlatformApiUrl,

  // Tenant API - WITH tenant slug (elections, voting, profile, dashboard)
  getTenantApiUrl: getTenantApiUrl
};