import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { LoginRequest, LoginResponse, User, ApiResponse } from '../models/auth.models';

// Placeholder types for non-auth endpoints
type ProfileData = any;
type ElectionData = any;

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private tenantSlug: string | null = null;

  // Track tenant slug changes
  private tenantSlugSubject = new BehaviorSubject<string | null>(null);
  tenantSlug$ = this.tenantSlugSubject.asObservable();

  constructor() {
    // Restore last used tenant from localStorage
    if (typeof window !== 'undefined') {
      const savedSlug = localStorage.getItem('current_tenant_slug');
      if (savedSlug) {
        this.tenantSlug = savedSlug;
        this.tenantSlugSubject.next(savedSlug);
      }
    }
  }

  /**
   * Set the current tenant slug
   */
  setTenantSlug(slug: string): void {
    this.tenantSlug = slug;
    this.tenantSlugSubject.next(slug);

    // Store in localStorage for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('current_tenant_slug', slug);
    }
  }

  /**
   * Get the current tenant slug
   */
  getTenantSlug(): string | null {
    return this.tenantSlug;
  }

  /**
   * Clear tenant context (logout)
   */
  clearTenant(): void {
    this.tenantSlug = null;
    this.tenantSlugSubject.next(null);

    if (typeof window !== 'undefined') {
      localStorage.removeItem('current_tenant_slug');
    }
  }

  /**
   * Build URL for Platform API calls (NO tenant slug required)
   * Used for: login, logout, getting tenant list, platform health
   */
  private buildPlatformUrl(endpoint: string): string {
    const baseUrl = environment.getPlatformApiUrl();
    const url = `${baseUrl}/${endpoint}`.replace(/\/+/g, '/').replace(':/', '://');
    console.log('🌐 Platform API URL:', url);
    return url;
  }

  /**
   * Build URL for Tenant API calls (WITH tenant slug required)
   * Used for: elections, voting, profile, dashboard, all tenant operations
   */
  private buildTenantUrl(endpoint: string): string {
    if (!this.tenantSlug) {
      throw new Error('Tenant context not set. Call setTenantSlug() first.');
    }

    const baseUrl = environment.getTenantApiUrl(this.tenantSlug);
    const url = `${baseUrl}/${endpoint}`.replace(/\/+/g, '/').replace(':/', '://');
    console.log(`🏢 Tenant API URL (${this.tenantSlug}):`, url);
    return url;
  }

  /**
   * @deprecated Use buildTenantUrl() instead
   */
  private buildUrl(endpoint: string): string {
    return this.buildTenantUrl(endpoint);
  }

  private getHeaders(): HttpHeaders {
    // Note: Basic headers (Content-Type, Accept, X-Requested-With) are now
    // handled by the apiHeadersInterceptor. Authorization header is handled
    // by the authInterceptor. This method is kept for potential future
    // custom headers but currently returns empty headers.
    return new HttpHeaders();
  }

  // =============================================================================
  // PLATFORM API ENDPOINTS (NO tenant slug required)
  // =============================================================================

  /**
   * Platform Login - Login at platform level (NO tenant slug required)
   * Returns: { token, user, tenants[] }
   */
  platformLogin(credentials: LoginRequest): Observable<ApiResponse<LoginResponse>> {
    const url = this.buildPlatformUrl('auth/login');
    return this.http.post<ApiResponse<LoginResponse>>(url, credentials, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  /**
   * Platform Logout - Logout from platform
   */
  platformLogout(): Observable<ApiResponse<void>> {
    const url = this.buildPlatformUrl('auth/logout');
    return this.http.post<ApiResponse<void>>(url, {}, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  /**
   * Get Current User - Platform level user info
   */
  getPlatformUser(): Observable<ApiResponse<LoginResponse>> {
    const url = this.buildPlatformUrl('auth/me');
    return this.http.get<ApiResponse<LoginResponse>>(url, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  /**
   * Get User's Available Tenants - Returns list of tenants user can access
   */
  getUserTenants(): Observable<ApiResponse<any[]>> {
    const url = this.buildPlatformUrl('auth/tenants');
    return this.http.get<ApiResponse<any[]>>(url, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  /**
   * Platform Health Check
   */
  platformHealth(): Observable<ApiResponse<any>> {
    const url = this.buildPlatformUrl('health');
    return this.http.get<ApiResponse<any>>(url, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  // =============================================================================
  // TENANT API ENDPOINTS (WITH tenant slug required)
  // =============================================================================

  /**
   * @deprecated Use platformLogin() instead for initial login
   * Tenant Login - Login to specific tenant (requires tenant slug to be set first)
   */
  login(credentials: LoginRequest): Observable<ApiResponse<LoginResponse>> {
    const url = this.buildTenantUrl('auth/login');
    return this.http.post<ApiResponse<LoginResponse>>(url, credentials, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  /**
   * @deprecated Use platformLogout() instead
   * Tenant Logout - Logout from tenant context
   */
  logout(): Observable<ApiResponse<void>> {
    const url = this.buildTenantUrl('auth/logout');
    return this.http.post<ApiResponse<void>>(url, {}, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  /**
   * Get Current User in Tenant Context
   */
  getCurrentUser(): Observable<ApiResponse<LoginResponse>> {
    const url = this.buildTenantUrl('auth/me');
    return this.http.get<ApiResponse<LoginResponse>>(url, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  // --- Elections endpoints ---
  getElections(): Observable<ApiResponse<ElectionData[]>> {
    const url = this.buildUrl('elections');
    return this.http.get<ApiResponse<ElectionData[]>>(url, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getActiveElections(): Observable<ApiResponse<ElectionData[]>> {
    const url = this.buildUrl('elections/active');
    return this.http.get<ApiResponse<ElectionData[]>>(url, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getElection(id: string): Observable<ApiResponse<ElectionData>> {
    const url = this.buildUrl(`elections/${id}`);
    return this.http.get<ApiResponse<ElectionData>>(url, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getElectionCandidates(id: string): Observable<ApiResponse<any[]>> {
    const url = this.buildUrl(`elections/${id}/candidates`);
    return this.http.get<ApiResponse<any[]>>(url, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getElectionResults(id: string): Observable<ApiResponse<any>> {
    const url = this.buildUrl(`elections/${id}/results`);
    return this.http.get<ApiResponse<any>>(url, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  castVote(electionId: string, voteData: any): Observable<ApiResponse<any>> {
    const url = this.buildUrl(`elections/${electionId}/vote`);
    return this.http.post<ApiResponse<any>>(url, voteData, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  // --- Profile endpoints ---
  getProfile(): Observable<ApiResponse<ProfileData>> {
    const url = this.buildUrl('profile');
    return this.http.get<ApiResponse<ProfileData>>(url, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  updateProfile(profileData: ProfileData): Observable<ApiResponse<ProfileData>> {
    const url = this.buildUrl('profile');
    return this.http.put<ApiResponse<ProfileData>>(url, profileData, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getMyElections(): Observable<ApiResponse<ElectionData[]>> {
    const url = this.buildUrl('profile/elections');
    return this.http.get<ApiResponse<ElectionData[]>>(url, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  // --- Platform endpoints ---
  // Note: Removed getPlatformStats() - mobile app doesn't need platform stats
  // Mobile app only needs tenant-specific operations

  // --- Health check ---
  healthCheck(): Observable<ApiResponse<any>> {
    const url = this.buildUrl('health');
    return this.http.get<ApiResponse<any>>(url, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error('API Error:', error);
    
    if (error.error && typeof error.error === 'object' && error.error.message) {
      return throwError(() => new Error(error.error.message));
    } else if (error.message) {
      return throwError(() => new Error(`HTTP Error (${error.status}): ${error.message}`));
    }
    
    return throwError(() => new Error('An unknown network error occurred.'));
  }
}