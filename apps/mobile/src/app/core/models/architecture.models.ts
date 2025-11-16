/**
 * Architecture Boundary Models
 *
 * These interfaces define the structure of architectural boundaries
 * consumed from the Laravel backend (single source of truth).
 *
 * Backend Location: packages/laravel-backend/architecture/
 */

export interface ArchitectureBoundaries {
  inertia_vue_boundaries: FrontendBoundary;
  angular_boundaries: FrontendBoundary;
  enforcement: EnforcementConfig;
}

export interface FrontendBoundary {
  technology: string;
  purpose: string;
  domains: string[];
  allowed_routes: string[];
  allowed_api_routes: string[];
  prohibited_routes: string[];
  prohibited_api_routes: string[];
}

export interface EnforcementConfig {
  enabled: boolean;
  log_violations: boolean;
  abort_on_violation: boolean;
  violation_response: {
    status_code: number;
    message: string;
  };
}

export interface ArchitecturalManifest {
  version: string;
  last_updated: string;
  domain_strategy: DomainStrategy;
  frontend_separation: FrontendSeparation;
  ddd_contexts: DDDContexts;
  route_boundaries: RouteBoundaries;
  security_boundaries: SecurityBoundaries;
}

export interface DomainStrategy {
  landlord_domains: string[];
  tenant_domains: string[];
  routing_rules: Record<string, RoutingRule>;
}

export interface RoutingRule {
  frontend: string;
  backend: string;
  database: string;
  middleware: string[];
}

export interface FrontendSeparation {
  inertia_vue: TechnologyConfig;
  angular: TechnologyConfig;
}

export interface TechnologyConfig {
  domains: string[];
  purpose: string;
  features: string[];
  prohibited_features: string[];
  route_patterns: string[];
  api_patterns: string[];
}

export interface DDDContexts {
  platform_contexts: Record<string, ContextDefinition>;
  tenant_contexts: Record<string, ContextDefinition>;
}

export interface ContextDefinition {
  description: string;
  database: string;
  api_prefix: string;
  frontend: string;
  bounded_context_path?: string;
}

export interface RouteBoundaries {
  landlord_routes: RouteConfig;
  tenant_routes: RouteConfig;
  platform_api_routes: RouteConfig;
  tenant_api_routes: RouteConfig;
}

export interface RouteConfig {
  prefix: string;
  middleware: string[];
  frontend: string;
  examples: string[];
}

export interface SecurityBoundaries {
  tenant_isolation: TenantIsolation;
  authentication: AuthenticationConfig;
  authorization: AuthorizationConfig;
}

export interface TenantIsolation {
  database_segregation: boolean;
  connection_switching: boolean;
  context_required: boolean;
  cross_tenant_access_prevention: boolean;
}

export interface AuthenticationConfig {
  mechanism: string;
  token_type: string;
  token_storage: string;
  token_expiry: string;
}

export interface AuthorizationConfig {
  platform_roles: string[];
  tenant_roles: string[];
  rbac_enabled: boolean;
}

/**
 * Route validation result
 */
export interface RouteValidationResult {
  allowed: boolean;
  reason?: string;
  violationType?: 'prohibited_route' | 'prohibited_api' | 'wrong_frontend';
}
