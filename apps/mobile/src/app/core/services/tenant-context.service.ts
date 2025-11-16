import { Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Preferences } from '@capacitor/preferences';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { tap } from 'rxjs/operators';
import { DomainService } from './domain.service';

/**
 * Tenant Interface
 *
 * Represents a tenant organization
 */
export interface Tenant {
  id: number;
  slug: string;
  name: string;
  status: string;
  logo_url?: string;
  description?: string;
}

/**
 * Tenant Context Service (Enhanced with API Integration)
 *
 * Manages tenant context across web and mobile platforms:
 * - WEB: Extracts tenant slug from subdomain (e.g., uml.localhost → 'uml')
 * - MOBILE: Stores and retrieves tenant slug from secure storage
 * - BOTH: Loads full tenant data from backend API
 *
 * Provides HTTP headers for tenant-aware API requests
 *
 * Enhanced features (Phase 3C):
 * - Load full tenant data from API
 * - Cache tenant information
 * - Support initialization from domain
 * - Reactive tenant state management
 */
@Injectable({
  providedIn: 'root'
})
export class TenantContextService {
  private http = inject(HttpClient);
  private domainService = inject(DomainService);

  private readonly TENANT_STORAGE_KEY = 'tenant_slug';
  private readonly TENANT_DATA_KEY = 'current_tenant';

  // Signal for reactive tenant slug (backward compatibility)
  private currentTenantSlug = signal<string | null>(null);

  // BehaviorSubject for full tenant object (new - for API integration)
  private tenantSubject = new BehaviorSubject<Tenant | null>(null);

  /**
   * Observable stream of current tenant (full object)
   */
  public tenant$ = this.tenantSubject.asObservable();

  // Platform detection
  private isMobileApp = false;

  constructor() {
    this.detectPlatform();
    this.initializeFromStorage();
  }

  /**
   * Detect if running in mobile app (Capacitor) or web browser
   */
  private detectPlatform(): void {
    this.isMobileApp = this.isRunningInMobileApp();
    console.log(`🔍 Platform detected: ${this.isMobileApp ? 'Mobile (Capacitor)' : 'Web Browser'}`);
  }

  /**
   * WEB: Extract tenant slug from subdomain
   * Examples:
   * - uml.localhost:4200 → returns 'uml'
   * - nrna.publicdigit.com → returns 'nrna'
   * - localhost:4200 → returns null (no subdomain)
   */
  detectFromSubdomain(): string | null {
    if (this.isMobileApp) {
      return null;
    }

    const hostname = window.location.hostname;
    const parts = hostname.split('.');

    // Check if we have a subdomain
    // localhost, 127.0.0.1, or IP addresses don't have subdomains in our context
    if (hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        parts.length < 2) {
      return null;
    }

    // For patterns like: subdomain.localhost, subdomain.domain.com
    // If localhost is in parts, check if there's a part before it
    if (parts.includes('localhost')) {
      return parts.length > 1 ? parts[0] : null;
    }

    // For production domains (e.g., nrna.publicdigit.com)
    // Return first part if we have at least 3 parts (subdomain.domain.tld)
    if (parts.length >= 3) {
      return parts[0];
    }

    return null;
  }

  /**
   * MOBILE: Set tenant slug (from user input or selection)
   */
  async setTenantSlug(slug: string): Promise<void> {
    this.currentTenantSlug.set(slug);
    await this.storeInSecureStorage(slug);
    console.log(`✅ Tenant context set: ${slug}`);
  }

  /**
   * Get HTTP headers for current tenant context
   * Returns headers with X-Tenant-Slug if tenant is available
   */
  getTenantHeaders(): HttpHeaders {
    const slug = this.getCurrentSlug();

    if (!slug) {
      console.warn('⚠️ No tenant context available');
      return new HttpHeaders();
    }

    console.log(`🏢 Adding tenant header: X-Tenant-Slug = ${slug}`);
    return new HttpHeaders({
      'X-Tenant-Slug': slug
    });
  }

  /**
   * Check if tenant context is available
   */
  hasTenantContext(): boolean {
    return !!this.getCurrentSlug();
  }

  /**
   * Get current tenant slug
   * - Mobile: Returns stored slug from signal
   * - Web: Detects from subdomain
   */
  getCurrentSlug(): string | null {
    if (this.isMobileApp) {
      return this.currentTenantSlug();
    } else {
      return this.detectFromSubdomain();
    }
  }

  /**
   * Get tenant slug as observable (reactive)
   */
  get tenantSlug$() {
    return this.currentTenantSlug.asReadonly();
  }

  /**
   * Clear tenant context (for logout or tenant switching)
   */
  async clearTenant(): Promise<void> {
    this.currentTenantSlug.set(null);
    await this.clearSecureStorage();
    console.log('🧹 Tenant context cleared');
  }

  /**
   * Get platform type for UI conditionals
   */
  isMobile(): boolean {
    return this.isMobileApp;
  }

  // ==========================================
  // PRIVATE: Secure Storage Implementation
  // ==========================================

  /**
   * Initialize tenant context from storage on app startup
   * Only for mobile apps
   */
  private async initializeFromStorage(): Promise<void> {
    if (this.isMobileApp) {
      const savedSlug = await this.getStoredSlug();
      if (savedSlug) {
        this.currentTenantSlug.set(savedSlug);
        console.log(`📱 Restored tenant context from storage: ${savedSlug}`);
      }
    }
  }

  /**
   * Store tenant slug in secure storage
   * Uses Capacitor Preferences for cross-platform storage
   */
  private async storeInSecureStorage(slug: string): Promise<void> {
    try {
      await Preferences.set({
        key: this.TENANT_STORAGE_KEY,
        value: slug
      });
      console.log(`💾 Tenant slug stored securely: ${slug}`);
    } catch (error) {
      console.error('❌ Failed to store tenant slug:', error);
    }
  }

  /**
   * Retrieve stored tenant slug
   */
  private async getStoredSlug(): Promise<string | null> {
    try {
      const { value } = await Preferences.get({ key: this.TENANT_STORAGE_KEY });
      return value;
    } catch (error) {
      console.error('❌ Failed to retrieve tenant slug:', error);
      return null;
    }
  }

  /**
   * Clear stored tenant slug
   */
  private async clearSecureStorage(): Promise<void> {
    try {
      await Preferences.remove({ key: this.TENANT_STORAGE_KEY });
      console.log('🗑️ Tenant storage cleared');
    } catch (error) {
      console.error('❌ Failed to clear tenant storage:', error);
    }
  }

  /**
   * Detect if running in Capacitor mobile app
   */
  private isRunningInMobileApp(): boolean {
    return !!(window as any).Capacitor;
  }

  // ==========================================
  // PHASE 3C: API INTEGRATION (NEW)
  // ==========================================

  /**
   * Initialize tenant context from API
   *
   * Loads tenant from:
   * 1. Current domain (if on tenant subdomain)
   * 2. Cache (if available and valid)
   * 3. Backend API (if not cached)
   *
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(): Promise<void> {
    console.log('[TenantContextService] Initializing tenant context with API');

    const domainInfo = this.domainService.getCurrentDomainInfo();

    // Only initialize on tenant domains
    if (!domainInfo.isTenantDomain || !domainInfo.tenantSlug) {
      console.log('[TenantContextService] Not on tenant domain, skipping API initialization');
      return;
    }

    // Try to restore from cache first
    const cached = await this.restoreFromCache();

    if (cached && cached.slug === domainInfo.tenantSlug) {
      console.log('[TenantContextService] Restored tenant from cache:', cached.slug);
      this.tenantSubject.next(cached);
      this.currentTenantSlug.set(cached.slug); // Keep slug signal in sync
      return;
    }

    // Load from API
    try {
      await this.loadTenant(domainInfo.tenantSlug);
      console.log('[TenantContextService] Tenant loaded from API:', domainInfo.tenantSlug);
    } catch (error) {
      console.error('[TenantContextService] Failed to load tenant:', error);
      throw error;
    }
  }

  /**
   * Load tenant by slug from API
   *
   * Fetches full tenant information from backend API and updates state
   *
   * @param slug - Tenant slug to load
   * @returns Promise that resolves with tenant data
   */
  async loadTenant(slug: string): Promise<Tenant> {
    console.log('[TenantContextService] Loading tenant from API:', slug);

    const apiUrl = this.domainService.getApiBaseUrl();
    const url = `${apiUrl}/api/v1/tenant/info`;

    try {
      const response = await firstValueFrom(
        this.http.get<{ success: boolean; data: Tenant; message?: string }>(url).pipe(
          tap(response => {
            if (!response.success) {
              throw new Error(response.message || 'Failed to load tenant');
            }
          })
        )
      );

      const tenant = response.data;

      // Update both state managers
      this.tenantSubject.next(tenant);
      this.currentTenantSlug.set(tenant.slug); // Keep slug signal in sync

      // Cache tenant data
      await this.cacheInStorage(tenant);

      console.log('[TenantContextService] Tenant loaded successfully:', tenant.slug);

      return tenant;
    } catch (error: any) {
      console.error('[TenantContextService] Error loading tenant:', error);

      // Clear invalid cache
      await this.clearCache();

      throw new Error(error.message || 'Failed to load tenant');
    }
  }

  /**
   * Get current tenant (full object)
   *
   * @returns Current tenant or null if not loaded
   */
  getCurrentTenant(): Tenant | null {
    return this.tenantSubject.value;
  }

  /**
   * Get tenant slug (convenience method)
   *
   * @returns Current tenant slug or null
   */
  getTenantSlug(): string | null {
    const tenant = this.getCurrentTenant();
    if (tenant) {
      return tenant.slug;
    }

    // Fallback to existing logic for backward compatibility
    return this.getCurrentSlug();
  }

  /**
   * Check if tenant is loaded
   *
   * @returns True if tenant data is loaded
   */
  hasTenant(): boolean {
    return this.tenantSubject.value !== null;
  }

  /**
   * Cache tenant in storage (works for both web and mobile)
   *
   * @param tenant - Tenant to cache
   */
  private async cacheInStorage(tenant: Tenant): Promise<void> {
    try {
      if (this.isMobileApp) {
        // Mobile: Use Capacitor Preferences
        await Preferences.set({
          key: this.TENANT_DATA_KEY,
          value: JSON.stringify(tenant)
        });
      } else {
        // Web: Use localStorage
        localStorage.setItem(this.TENANT_DATA_KEY, JSON.stringify(tenant));
        localStorage.setItem('current_tenant_slug', tenant.slug);
      }

      console.log('[TenantContextService] Tenant cached:', tenant.slug);
    } catch (error) {
      console.warn('[TenantContextService] Failed to cache tenant:', error);
    }
  }

  /**
   * Restore tenant from cache (works for both web and mobile)
   *
   * @returns Cached tenant or null
   */
  private async restoreFromCache(): Promise<Tenant | null> {
    try {
      let cached: string | null = null;

      if (this.isMobileApp) {
        // Mobile: Use Capacitor Preferences
        const { value } = await Preferences.get({ key: this.TENANT_DATA_KEY });
        cached = value;
      } else {
        // Web: Use localStorage
        cached = localStorage.getItem(this.TENANT_DATA_KEY);
      }

      if (!cached) {
        return null;
      }

      const tenant = JSON.parse(cached) as Tenant;

      console.log('[TenantContextService] Found cached tenant:', tenant.slug);

      return tenant;
    } catch (error) {
      console.warn('[TenantContextService] Failed to restore from cache:', error);
      await this.clearCache();
      return null;
    }
  }

  /**
   * Clear cache (works for both web and mobile)
   */
  private async clearCache(): Promise<void> {
    try {
      if (this.isMobileApp) {
        await Preferences.remove({ key: this.TENANT_DATA_KEY });
      } else {
        localStorage.removeItem(this.TENANT_DATA_KEY);
        localStorage.removeItem('current_tenant_slug');
      }

      console.log('[TenantContextService] Cache cleared');
    } catch (error) {
      console.warn('[TenantContextService] Failed to clear cache:', error);
    }
  }

  /**
   * Refresh current tenant from API
   *
   * Reloads tenant data from backend
   *
   * @returns Promise that resolves with refreshed tenant
   */
  async refresh(): Promise<Tenant | null> {
    const currentTenant = this.getCurrentTenant();

    if (!currentTenant) {
      console.log('[TenantContextService] No tenant to refresh');
      return null;
    }

    try {
      return await this.loadTenant(currentTenant.slug);
    } catch (error) {
      console.error('[TenantContextService] Failed to refresh tenant:', error);
      return null;
    }
  }

  /**
   * Get tenant API URL
   *
   * Returns the base URL for tenant-scoped API calls.
   * Delegates to DomainService for actual URL construction.
   *
   * @returns string - Base API URL for tenant context
   */
  getTenantApiUrl(): string {
    return this.domainService.getApiBaseUrl();
  }
}
