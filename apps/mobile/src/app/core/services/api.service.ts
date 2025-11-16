import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { LoginRequest, LoginResponse, User, ApiResponse, Tenant } from '../models/auth.models';

// Placeholder types for non-auth endpoints
type ProfileData = any;
type ElectionData = any;

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  private getHeaders(): HttpHeaders {
    // Note: Basic headers (Content-Type, Accept, X-Requested-With) are now
    // handled by the apiHeadersInterceptor. Authorization header is handled
    // by the authInterceptor. This method is kept for potential future
    // custom headers but currently returns empty headers.
    return new HttpHeaders();
  }

  // --- Authentication endpoints ---
  login(credentials: LoginRequest): Observable<ApiResponse<LoginResponse>> {
    const url = `${this.baseUrl}/auth/login`;
    return this.http.post<ApiResponse<LoginResponse>>(url, credentials, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  logout(): Observable<ApiResponse<void>> {
    const url = `${this.baseUrl}/auth/logout`;
    return this.http.post<ApiResponse<void>>(url, {}, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getCurrentUser(): Observable<ApiResponse<LoginResponse>> {
    const url = `${this.baseUrl}/auth/me`;
    return this.http.get<ApiResponse<LoginResponse>>(url, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getUserTenants(): Observable<ApiResponse<Tenant[]>> {
    const url = `${this.baseUrl}/auth/tenants`;
    return this.http.get<ApiResponse<Tenant[]>>(url, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  // --- Elections endpoints ---
  getElections(): Observable<ApiResponse<ElectionData[]>> {
    const url = `${this.baseUrl}/elections`;
    return this.http.get<ApiResponse<ElectionData[]>>(url, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getActiveElections(): Observable<ApiResponse<ElectionData[]>> {
    const url = `${this.baseUrl}/elections/active`;
    return this.http.get<ApiResponse<ElectionData[]>>(url, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getElection(id: string): Observable<ApiResponse<ElectionData>> {
    const url = `${this.baseUrl}/elections/${id}`;
    return this.http.get<ApiResponse<ElectionData>>(url, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getElectionCandidates(id: string): Observable<ApiResponse<any[]>> {
    const url = `${this.baseUrl}/elections/${id}/candidates`;
    return this.http.get<ApiResponse<any[]>>(url, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getElectionResults(id: string): Observable<ApiResponse<any>> {
    const url = `${this.baseUrl}/elections/${id}/results`;
    return this.http.get<ApiResponse<any>>(url, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  castVote(electionId: string, voteData: any): Observable<ApiResponse<any>> {
    const url = `${this.baseUrl}/elections/${electionId}/vote`;
    return this.http.post<ApiResponse<any>>(url, voteData, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  // --- Profile endpoints ---
  getProfile(): Observable<ApiResponse<ProfileData>> {
    const url = `${this.baseUrl}/profile`;
    return this.http.get<ApiResponse<ProfileData>>(url, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  updateProfile(profileData: ProfileData): Observable<ApiResponse<ProfileData>> {
    const url = `${this.baseUrl}/profile`;
    return this.http.put<ApiResponse<ProfileData>>(url, profileData, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getMyElections(): Observable<ApiResponse<ElectionData[]>> {
    const url = `${this.baseUrl}/profile/elections`;
    return this.http.get<ApiResponse<ElectionData[]>>(url, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  // --- Platform endpoints ---
  getPlatformStats(): Observable<ApiResponse<any>> {
    const url = `${this.baseUrl}/stats`;
    return this.http.get<ApiResponse<any>>(url, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  // --- Health check ---
  healthCheck(): Observable<ApiResponse<any>> {
    const url = `${this.baseUrl}/health`;
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