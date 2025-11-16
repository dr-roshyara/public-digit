import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Domain Types
 *
 * Represents the different domain categories in the application
 */
export type DomainType = 'public' | 'landlord' | 'tenant' | 'mobile' | 'platform' | 'unknown';

/**
 * Domain Information
 *
 * Complete information about the current domain
 */
export interface DomainInfo {
  type: DomainType;
  hostname: string;
  tenantSlug?: string;
  isPublicDomain: boolean;
  isLandlordDomain: boolean;
  isTenantDomain: boolean;
  isMobileDomain: boolean;
  isPlatformDomain: boolean;
}

/**
 * Domain Service
 *
 * Detects and manages domain-specific logic for multi-domain application.
 * Determines domain type, extracts tenant slugs, and provides domain utilities.
 *
 * Domain Types:
 * - public: www.publicdigit.com (Marketing + tenant discovery)
 * - landlord: admin.publicdigit.com (Admin portal)
 * - tenant: *.publicdigit.com (Tenant member portal)
 * - mobile: app.publicdigit.com (Mobile PWA)
 * - platform: api.publicdigit.com (API-only)
 */
@Injectable({
  providedIn: 'root'
})
export class DomainService {
  /**
   * Domain patterns for detection
   *
   * IMPORTANT: Must be defined BEFORE domainInfoSubject
   * because getCurrentDomainInfo() → detectDomainType() → accesses this.domainPatterns
   */
  private readonly domainPatterns = {
    public: ['www.publicdigit.com', 'publicdigit.com', 'www.localhost', 'localhost'],
    landlord: ['admin.publicdigit.com', 'admin.localhost'],
    mobile: ['app.publicdigit.com', 'app.localhost'],
    platform: ['api.publicdigit.com', 'api.localhost'],
    // Tenant is detected by wildcard pattern (*.publicdigit.com, *.localhost)
  };

  /**
   * Reserved subdomains that cannot be tenant slugs
   *
   * IMPORTANT: Must be defined BEFORE domainInfoSubject
   */
  private readonly reservedSubdomains = [
    'admin', 'api', 'www', 'app', 'mail', 'smtp', 'ftp',
    'localhost', 'staging', 'dev', 'test', 'demo'
  ];

  // Reactive state for current domain information
  // IMPORTANT: Must be defined AFTER domainPatterns and reservedSubdomains
  // because initialization calls getCurrentDomainInfo() which needs those properties
  private domainInfoSubject = new BehaviorSubject<DomainInfo>(this.getCurrentDomainInfo());
  public domainInfo$ = this.domainInfoSubject.asObservable();

  constructor() {
    console.log('[DomainService] Initialized with domain info:', this.domainInfoSubject.value);
  }

  /**
   * Detect the current domain type
   *
   * @returns DomainType
   */
  detectDomainType(): DomainType {
    const hostname = window.location.hostname;

    // Check public domains
    if (this.domainPatterns.public.includes(hostname)) {
      return 'public';
    }

    // Check landlord domains
    if (this.domainPatterns.landlord.includes(hostname)) {
      return 'landlord';
    }

    // Check mobile domains
    if (this.domainPatterns.mobile.includes(hostname)) {
      return 'mobile';
    }

    // Check platform domains
    if (this.domainPatterns.platform.includes(hostname)) {
      return 'platform';
    }

    // Check if it's a tenant subdomain
    if (this.isTenantSubdomain(hostname)) {
      return 'tenant';
    }

    return 'unknown';
  }

  /**
   * Check if hostname is a tenant subdomain
   *
   * @param hostname - Hostname to check
   * @returns boolean
   */
  private isTenantSubdomain(hostname: string): boolean {
    // Production: *.publicdigit.com
    if (hostname.endsWith('.publicdigit.com') && !hostname.startsWith('www.')) {
      const subdomain = hostname.replace('.publicdigit.com', '');
      return this.isValidTenantSlug(subdomain);
    }

    // Development: *.localhost
    if (hostname.endsWith('.localhost')) {
      const subdomain = hostname.replace('.localhost', '');
      return this.isValidTenantSlug(subdomain);
    }

    return false;
  }

  /**
   * Check if subdomain is a valid tenant slug
   *
   * @param subdomain - Subdomain to validate
   * @returns boolean
   */
  private isValidTenantSlug(subdomain: string): boolean {
    // Check if reserved
    if (this.reservedSubdomains.includes(subdomain)) {
      return false;
    }

    // Check format (alphanumeric + hyphens, 2-63 chars)
    const slugRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i;
    return slugRegex.test(subdomain);
  }

  /**
   * Extract tenant slug from current hostname
   *
   * @returns Tenant slug or null if not on tenant domain
   */
  extractTenantSlug(): string | null {
    const hostname = window.location.hostname;

    // Production: tenant.publicdigit.com → "tenant"
    if (hostname.endsWith('.publicdigit.com')) {
      const slug = hostname.replace('.publicdigit.com', '');
      return this.isValidTenantSlug(slug) ? slug : null;
    }

    // Development: tenant.localhost → "tenant"
    if (hostname.endsWith('.localhost')) {
      const slug = hostname.replace('.localhost', '');
      return this.isValidTenantSlug(slug) ? slug : null;
    }

    return null;
  }

  /**
   * Get current domain information
   *
   * @returns DomainInfo
   */
  getCurrentDomainInfo(): DomainInfo {
    const hostname = window.location.hostname;
    const type = this.detectDomainType();
    const tenantSlug = type === 'tenant' ? this.extractTenantSlug() : undefined;

    return {
      type,
      hostname,
      tenantSlug,
      isPublicDomain: type === 'public',
      isLandlordDomain: type === 'landlord',
      isTenantDomain: type === 'tenant',
      isMobileDomain: type === 'mobile',
      isPlatformDomain: type === 'platform',
    };
  }

  /**
   * Navigate to a different domain
   *
   * @param targetDomain - Target domain or tenant slug
   * @param path - Optional path to navigate to
   */
  navigateToDomain(targetDomain: string, path: string = '/'): void {
    let url: string;

    // Check if it's a full URL
    if (targetDomain.startsWith('http://') || targetDomain.startsWith('https://')) {
      url = targetDomain + path;
    } else {
      // Assume it's a tenant slug, build tenant URL
      const protocol = window.location.protocol;
      const baseDomain = this.getBaseDomain();
      url = `${protocol}//${targetDomain}.${baseDomain}${path}`;
    }

    console.log(`[DomainService] Navigating to ${url}`);
    window.location.href = url;
  }

  /**
   * Get base domain (publicdigit.com or localhost)
   *
   * @returns Base domain string
   */
  private getBaseDomain(): string {
    const hostname = window.location.hostname;

    if (hostname.includes('localhost') || hostname === '127.0.0.1') {
      return 'localhost';
    }

    return 'publicdigit.com';
  }

  /**
   * Build URL for a specific domain type
   *
   * @param domainType - Type of domain
   * @param path - Optional path
   * @returns Full URL string
   */
  buildDomainUrl(domainType: DomainType, path: string = '/'): string {
    const protocol = window.location.protocol;
    const baseDomain = this.getBaseDomain();
    let subdomain: string;

    switch (domainType) {
      case 'public':
        subdomain = baseDomain === 'localhost' ? 'www' : 'www';
        break;
      case 'landlord':
        subdomain = 'admin';
        break;
      case 'mobile':
        subdomain = 'app';
        break;
      case 'platform':
        subdomain = 'api';
        break;
      default:
        throw new Error(`Cannot build URL for domain type: ${domainType}`);
    }

    return `${protocol}//${subdomain}.${baseDomain}${path}`;
  }

  /**
   * Build URL for a tenant domain
   *
   * @param tenantSlug - Tenant slug
   * @param path - Optional path
   * @returns Full URL string
   */
  buildTenantUrl(tenantSlug: string, path: string = '/'): string {
    const protocol = window.location.protocol;
    const baseDomain = this.getBaseDomain();
    return `${protocol}//${tenantSlug}.${baseDomain}${path}`;
  }

  /**
   * Check if current domain is development environment
   *
   * @returns boolean
   */
  isDevelopment(): boolean {
    const hostname = window.location.hostname;
    return hostname.includes('localhost') || hostname === '127.0.0.1';
  }

  /**
   * Check if current domain is production environment
   *
   * @returns boolean
   */
  isProduction(): boolean {
    return !this.isDevelopment();
  }

  /**
   * Get environment-appropriate API base URL
   *
   * @returns API base URL string
   */
  getApiBaseUrl(): string {
    if (this.isDevelopment()) {
      return 'http://localhost:8000';
    }

    // In production, API calls go to current domain
    return window.location.origin;
  }
}
