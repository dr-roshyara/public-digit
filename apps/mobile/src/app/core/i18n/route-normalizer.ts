// MATCHING your Vue.js normalizeRoute() function EXACTLY:
// apps/mobile/src/app/core/i18n/route-normalizer.ts

export interface NormalizedRoute {
  cleanPath: string;
  translationPath: string;
  namespace: string;
}

export interface RouteMapping {
  [routePath: string]: string;
}

export function normalizeRoute(routePath: string): NormalizedRoute {
  // Clean the path - IDENTICAL to your Vue.js implementation
  const cleanPath = routePath.replace(/\?.*$/, '').replace(/#.*$/, '').replace(/\/+$/, '') || '/';

  // Route mappings for translation loading - MUST MATCH your Vue.js structure
  const routeMappings: Record<string, string> = {
    '/': 'home',
    '/dashboard': 'dashboard',
    '/election-request': 'election-request',
    '/election-request/success': 'election-request-success',

    // Admin routes → admin/dashboard directory - IDENTICAL
    '/admin/dashboard': 'admin/dashboard',
    '/admin': 'admin/dashboard',
    '/admin/election-requests': 'admin/election-requests',

    // Organization routes → organization/dashboard directory - IDENTICAL
    '/organization/dashboard': 'organization/dashboard',
    '/organization': 'organization/dashboard',

    // Committee routes → committee/dashboard directory - IDENTICAL
    '/committee/dashboard': 'committee/dashboard',
    '/committee/elections': 'committee/dashboard',
    '/committee': 'committee/dashboard',
    '/committee/member-dashboard': 'committee/member-dashboard',

    // Auth routes → auth subdirectories - IDENTICAL
    '/login': 'auth/login',
    '/register': 'auth/register',
    '/auth/login': 'auth/login',
    '/auth/register': 'auth/register',

    // Setup routes - IDENTICAL
    '/election/committee/setup': 'setup',
    '/setup': 'setup',

    // Track fallback - IDENTICAL
    '/track': 'home'
  };

  // Check exact match first - IDENTICAL logic
  if (routeMappings[cleanPath]) {
    const mappedPath = routeMappings[cleanPath];
    return {
      cleanPath,
      translationPath: mappedPath,  // ← FIX: Don't add "pages/" prefix here
      namespace: mappedPath.replace(/\//g, '.')
    };
  }

  // Remove dynamic segments and try again - IDENTICAL logic
  const normalized = cleanPath
    .replace(/\/\d+/g, '')                           // Remove numeric IDs
    .replace(/\/[a-zA-Z0-9]{64,}/g, '')             // Remove long tokens/hashes
    .replace(/\/[a-zA-Z0-9]{8,}-[a-zA-Z0-9]{4,}-[a-zA-Z0-9]{4,}-[a-zA-Z0-9]{4,}-[a-zA-Z0-9]{12,}/g, '') // Remove UUIDs

  if (routeMappings[normalized]) {
    const mappedPath = routeMappings[normalized];
    return {
      cleanPath,
      translationPath: mappedPath,  // ← FIX: Don't add "pages/" prefix here
      namespace: mappedPath.replace(/\//g, '.')
    };
  }

  // Advanced pattern matching for complex routes - IDENTICAL patterns
  const advancedMappings: Record<string, string> = {
    // Admin routes with dynamic IDs - IDENTICAL
    '^/admin/election-requests/[^/]+': 'admin/election-requests',
    '^/admin/election-requests': 'admin/election-requests',
    '^/admin/elections/[^/]+': 'admin/elections',
    '^/admin/elections': 'admin/elections',
    '^/admin/users/[^/]+': 'admin/users',
    '^/admin/users': 'admin/users',

    // Committee routes with election IDs - IDENTICAL
    '^/committee/elections/[^/]+/dashboard': 'committee/dashboard',
    '^/committee/elections/[^/]+/member-dashboard': 'committee/member-dashboard',
    '^/committee/elections/[^/]+/committee': 'committee/dashboard',
    '^/committee/elections/[^/]+/members': 'committee/dashboard',
    '^/committee/elections/[^/]+': 'committee/dashboard',
    '^/committee/invitation/[^/]+': 'committee/invitation',
    '^/committee/invitation': 'committee/invitation',

    // Organization routes - IDENTICAL
    '^/organization/request-status': 'organization/dashboard',
    '^/organization/feedback': 'organization/dashboard',
    '^/organization/elections/[^/]+': 'organization/dashboard',

    // Tracking routes with tokens - IDENTICAL
    '^/track/[^/]+': 'tracking',

    // Setup and auth routes with tokens - IDENTICAL
    '^/election/committee/setup/[^/]+': 'setup',
    '^/setup/[^/]+': 'setup',
    '^/committee/invitation/accept/[^/]+': 'committee/invitation',
    '^/committee/invitation/decline/[^/]+': 'committee/invitation',

    // Profile and settings routes - IDENTICAL
    '^/profile/[^/]+': 'profile',
    '^/settings/[^/]+': 'settings'
  };

  // Check advanced patterns - IDENTICAL logic
  for (const [pattern, mapping] of Object.entries(advancedMappings)) {
    const regex = new RegExp(pattern);
    if (regex.test(cleanPath)) {
      return {
        cleanPath,
        translationPath: mapping,  // ← FIX: Don't add "pages/" prefix here
        namespace: mapping.replace(/\//g, '.')
      };
    }
  }

  // Default fallback - IDENTICAL
  return {
    cleanPath,
    translationPath: 'home',  // ← FIX: Don't add "pages/" prefix here
    namespace: 'home'
  };
}