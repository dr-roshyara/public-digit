import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap, map, catchError, throwError, of } from 'rxjs';
import { Preferences } from '@capacitor/preferences';
import { ApiService } from './api.service';
import { LoginRequest, LoginResponse, User, ApiResponse } from '../models/auth.models';

/**
 * Simplified Authentication Service for Mobile App
 *
 * Handles user authentication with dual-API approach:
 * - Platform Login: Login at platform level (NO tenant slug required)
 * - Tenant Selection: User selects tenant after login
 * - Secure token storage using Capacitor Preferences
 * - Uses ApiService for both platform and tenant-specific API calls
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly AUTH_TOKEN_KEY = 'auth_token';
  private readonly CURRENT_USER_KEY = 'current_user';

  private apiService = inject(ApiService);
  private router = inject(Router);

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

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
   * Login with tenant slug and credentials
   *
   * @param tenantSlug - Tenant slug (required)
   * @param credentials - Email and password
   */
  login(tenantSlug: string, credentials: LoginRequest): Observable<LoginResponse> {
    console.log(`🏢 Setting tenant context before login: ${tenantSlug}`);

    // Set tenant context in ApiService
    this.apiService.setTenantSlug(tenantSlug);

    return this.apiService.login(credentials).pipe(
      map(apiResponse => {
        // Unwrap ApiResponse<LoginResponse> to get LoginResponse
        if (apiResponse.success && apiResponse.data) {
          return apiResponse.data;
        } else {
          throw new Error(apiResponse.message || 'Login failed');
        }
      }),
      tap(loginData => this.handleSuccessfulLogin(loginData)),
      catchError(error => this.handleLoginError(error))
    );
  }

  /**
   * Handle successful login - store token and navigate
   */
  private async handleSuccessfulLogin(loginData: LoginResponse): Promise<void> {
    await this.setSession(loginData);
    this.currentUserSubject.next(loginData.user);

    console.log('✅ Login successful');
    this.router.navigate(['/dashboard']);
  }

  /**
   * Handle login errors
   */
  private handleLoginError(error: any): Observable<never> {
    console.error('❌ Login failed:', error);
    return throwError(() => error);
  }

  /**
   * Logout - clear auth token
   */
  logout(): Observable<void> {
    return this.apiService.logout().pipe(
      map(() => {}), // Convert ApiResponse<void> to void
      tap(() => this.clearAuth()),
      tap(() => {
        this.currentUserSubject.next(null);
        console.log('✅ Logged out');
        this.router.navigate(['/login']);
      }),
      catchError((error) => {
        // Even if API call fails, clear local session
        console.warn('⚠️ Logout API failed, clearing local session anyway');
        this.clearAuth();
        this.currentUserSubject.next(null);
        this.router.navigate(['/login']);
        return throwError(() => error);
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

      // Also clear localStorage
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(this.AUTH_TOKEN_KEY);
        localStorage.removeItem(this.CURRENT_USER_KEY);
      }

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
}