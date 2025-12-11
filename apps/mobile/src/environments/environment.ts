/**
 * Development Environment
 * Auto-detects platform and configures appropriate API URL
 */

/**
 * Platform Mobile API URL (NO tenant slug)
 * Used for: login, logout, getting tenant list, platform health
 */
function getPlatformApiUrl(): string {
  // Check if running on mobile (Capacitor)
  const isMobile = !!(window as any).Capacitor;

  if (!isMobile) {
    // Browser development - platform mobile API
    return 'http://localhost:8000/mapi/v1';
  }

  // Running on mobile device
  const platform = (window as any).Capacitor?.getPlatform?.() || 'web';

  if (platform === 'android') {
    // Android Emulator uses 10.0.2.2 to access host machine
    return 'http://10.0.2.2:8000/mapi/v1';
  }

  if (platform === 'ios') {
    // iOS simulator uses localhost
    return 'http://localhost:8000/mapi/v1';
  }

  // Fallback for web platform or unknown
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
    // Browser development - path-based tenancy with mobile API
    return `http://localhost:8000/${slug}/mapi/v1`;
  }

  // Running on mobile device
  const platform = (window as any).Capacitor?.getPlatform?.() || 'web';

  if (platform === 'android') {
    // Android Emulator uses 10.0.2.2 to access host machine
    return `http://10.0.2.2:8000/${slug}/mapi/v1`;
  }

  if (platform === 'ios') {
    // iOS simulator uses localhost
    return `http://localhost:8000/${slug}/mapi/v1`;
  }

  // Fallback for web platform or unknown
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