import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap, map, from, switchMap, catchError, throwError, of } from 'rxjs';
import { Preferences } from '@capacitor/preferences';
import { ApiService } from './api.service';
import { TenantContextService } from './tenant-context.service';
import { LoginRequest, LoginResponse, User, ApiResponse, Tenant } from '../models/auth.models';

/**
 * Authentication Service
 *
 * Handles user authentication with multi-tenant support:
 * - Login with optional tenant slug (for mobile)
 * - Secure token storage using Capacitor Preferences
 * - Integration with TenantContextService
 * - Auto-navigation based on tenant context
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly AUTH_TOKEN_KEY = 'auth_token';
  private readonly CURRENT_USER_KEY = 'current_user';
  private readonly USER_TENANTS_KEY = 'user_tenants';

  private apiService = inject(ApiService);
  private tenantContext = inject(TenantContextService);
  private router = inject(Router);

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private userTenantsSubject = new BehaviorSubject<Tenant[]>([]);
  public userTenants$ = this.userTenantsSubject.asObservable();

  constructor() {
    this.initializeAuth();
  }

  /**
   * Initialize auth state from secure storage on app startup
   */
  private async initializeAuth(): Promise<void> {
    const token = await this.getStoredToken();
    if (token) {
      const user = await this.getStoredUser();
      if (user) {
        this.currentUserSubject.next(user);
        console.log('✅ Auth state restored from storage');
      }
    }
  }

  /**
   * Unified login method for both web and mobile
   *
   * @param credentials - Email and password
   * @param tenantSlug - Optional tenant slug (required for mobile first login)
   */
  login(credentials: LoginRequest, tenantSlug?: string): Observable<LoginResponse> {
    // Set tenant context if provided (mobile scenario)
    if (tenantSlug) {
      console.log(`🏢 Setting tenant context before login: ${tenantSlug}`);
      return from(this.tenantContext.setTenantSlug(tenantSlug)).pipe(
        switchMap(() => this.performLogin(credentials))
      );
    }

    return this.performLogin(credentials);
  }

  /**
   * Perform the actual login API call
   */
  private performLogin(credentials: LoginRequest): Observable<LoginResponse> {
    return this.apiService.login(credentials).pipe(
      switchMap(apiResponse => {
        // Unwrap ApiResponse<LoginResponse> to get LoginResponse
        if (apiResponse.success && apiResponse.data) {
          return from(this.handleSuccessfulLogin(apiResponse.data)).pipe(
            map(() => apiResponse.data!)
          );
        } else {
          return throwError(() => new Error(apiResponse.message || 'Login failed'));
        }
      }),
      catchError(error => this.handleLoginError(error))
    );
  }

  /**
   * Handle successful login - store token and navigate
   */
  private async handleSuccessfulLogin(loginData: LoginResponse): Promise<void> {
    // loginData is now { token, user } - no wrapper
    await this.setSession(loginData);
    this.currentUserSubject.next(loginData.user);

    console.log('✅ Login successful');

    // Navigate based on platform and tenant context
    if (this.tenantContext.hasTenantContext()) {
      this.router.navigate(['/dashboard']);
    } else {
      // This shouldn't happen, but fallback to tenant selection if needed
      this.router.navigate(['/login']);
    }
  }

  /**
   * Handle login errors - clear tenant context on auth failure
   */
  private handleLoginError(error: any): Observable<never> {
    console.error('❌ Login failed:', error);

    // Clear tenant context on auth failure (prevents stuck state)
    this.tenantContext.clearTenant();

    return throwError(() => error);
  }

  /**
   * Logout - clear auth token but preserve tenant context
   */
  logout(): Observable<void> {
    return this.apiService.logout().pipe(
      switchMap(() => from(this.clearAuth())),
      tap(() => {
        this.currentUserSubject.next(null);
        // NOTE: Tenant context is preserved for next login
        console.log('✅ Logged out (tenant context preserved)');
        this.router.navigate(['/']);
      }),
      catchError((error) => {
        // Even if API call fails, clear local session
        console.warn('⚠️ Logout API failed, clearing local session anyway');
        return from(this.clearAuth()).pipe(
          tap(() => {
            this.currentUserSubject.next(null);
            this.router.navigate(['/']);
          }),
          map(() => undefined)
        );
      })
    );
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.currentUserSubject.value;
  }

  /**
   * Check authentication asynchronously (for guards)
   */
  async isAuthenticatedAsync(): Promise<boolean> {
    const token = await this.getStoredToken();
    return !!token;
  }

  /**
   * Get current user (fetch from API if needed)
   */
  getCurrentUser(): Observable<User> {
    // If we already have user, return it
    if (this.currentUserSubject.value) {
      return of(this.currentUserSubject.value);
    }

    // Otherwise fetch from API
    return this.apiService.getCurrentUser().pipe(
      tap((response: ApiResponse<LoginResponse>) => {
        if (response.success && response.data) {
          this.currentUserSubject.next(response.data.user);
        }
      }),
      map((response: ApiResponse<LoginResponse>) => response.data!.user)
    );
  }

  /**
   * Get stored auth token
   */
  getToken(): string | null {
    // For synchronous access, try localStorage first (web)
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(this.AUTH_TOKEN_KEY);
    }
    return null;
  }

  /**
   * Load user's tenants from API
   *
   * @param refresh - Force refresh from API (bypass cache)
   * @returns Observable<Tenant[]> - List of active tenants user has access to
   */
  loadUserTenants(refresh = false): Observable<Tenant[]> {
    // Return cached tenants if available and not forcing refresh
    if (!refresh && this.userTenantsSubject.value.length > 0) {
      return of(this.userTenantsSubject.value);
    }

    return this.apiService.getUserTenants().pipe(
      map(response => {
        if (!response.success || !response.data) {
          throw new Error(response.message || 'Failed to load tenants');
        }

        // Filter to only active tenants
        const activeTenants = response.data.filter(tenant => tenant.status === 'active');

        return activeTenants;
      }),
      tap(async (tenants) => {
        // Update in-memory cache
        this.userTenantsSubject.next(tenants);

        // Store in secure storage for offline access
        await this.storeTenants(tenants);

        console.log(`✅ Loaded ${tenants.length} tenant(s)`);
      }),
      catchError(error => {
        console.error('❌ Failed to load user tenants:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get user's tenants (from cache)
   *
   * @returns Observable<Tenant[]> - Cached list of tenants
   */
  getUserTenants(): Observable<Tenant[]> {
    return of(this.userTenantsSubject.value);
  }

  // ==========================================
  // PRIVATE: Secure Storage Methods
  // ==========================================

  /**
   * Store authentication session securely
   */
  private async setSession(authResult: LoginResponse): Promise<void> {
    try {
      // Store token
      await Preferences.set({
        key: this.AUTH_TOKEN_KEY,
        value: authResult.token
      });

      // Store user data
      await Preferences.set({
        key: this.CURRENT_USER_KEY,
        value: JSON.stringify(authResult.user)
      });

      // Also set in localStorage for web compatibility
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(this.AUTH_TOKEN_KEY, authResult.token);
        localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(authResult.user));
      }

      console.log('💾 Auth session stored securely');
    } catch (error) {
      console.error('❌ Failed to store auth session:', error);
    }
  }

  /**
   * Clear authentication session
   */
  private async clearAuth(): Promise<void> {
    try {
      await Preferences.remove({ key: this.AUTH_TOKEN_KEY });
      await Preferences.remove({ key: this.CURRENT_USER_KEY });
      await Preferences.remove({ key: this.USER_TENANTS_KEY });

      // Also clear localStorage
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(this.AUTH_TOKEN_KEY);
        localStorage.removeItem(this.CURRENT_USER_KEY);
        localStorage.removeItem(this.USER_TENANTS_KEY);
      }

      // Clear in-memory tenants cache
      this.userTenantsSubject.next([]);

      console.log('🗑️ Auth session cleared');
    } catch (error) {
      console.error('❌ Failed to clear auth session:', error);
    }
  }

  /**
   * Get stored auth token
   */
  private async getStoredToken(): Promise<string | null> {
    try {
      const { value } = await Preferences.get({ key: this.AUTH_TOKEN_KEY });
      return value;
    } catch (error) {
      console.error('❌ Failed to retrieve auth token:', error);
      return null;
    }
  }

  /**
   * Get stored user data
   */
  private async getStoredUser(): Promise<User | null> {
    try {
      const { value } = await Preferences.get({ key: this.CURRENT_USER_KEY });
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('❌ Failed to retrieve user data:', error);
      return null;
    }
  }

  /**
   * Store user's tenants in secure storage
   */
  private async storeTenants(tenants: Tenant[]): Promise<void> {
    try {
      await Preferences.set({
        key: this.USER_TENANTS_KEY,
        value: JSON.stringify(tenants)
      });

      // Also set in localStorage for web compatibility
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(this.USER_TENANTS_KEY, JSON.stringify(tenants));
      }

      console.log('💾 Tenants stored securely');
    } catch (error) {
      console.error('❌ Failed to store tenants:', error);
    }
  }
}