/**
 * Production Environment
 * Uses subdomain-based tenancy with mobile API: https://{slug}.publicdigit.com/mapi/v1
 */
function getTenantApiUrl(slug: string): string {
  if (!slug || slug.trim() === '') {
    throw new Error('Tenant slug is required');
  }
  return `https://${slug}.publicdigit.com/mapi/v1`;
}

export const environment: {
  production: boolean;
  appId: string;
  appName: string;
  version: string;
  getTenantApiUrl: (slug: string) => string;
} = {
  production: true,
  appId: 'com.publicdigit.app',
  appName: 'PublicDigit',
  version: '1.0.0',

  // SIMPLE function - no nested objects, no platform APIs
  getTenantApiUrl: getTenantApiUrl
};