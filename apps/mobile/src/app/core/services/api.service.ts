import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

// Define types locally since shared-types might not be available
export interface LoginRequest {
  email: string;
  password: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

// Placeholder types
type ProfileData = any;
type ElectionData = any;

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:8000';

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    
    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    });

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return headers;
  }

  // --- Authentication endpoints ---
  login(credentials: LoginRequest): Observable<ApiResponse<LoginResponse>> {
    const url = `${this.baseUrl}/api/mobile/v1/auth/login`; // ✅ Correct endpoint
    return this.http.post<ApiResponse<LoginResponse>>(url, credentials, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  logout(): Observable<ApiResponse<void>> {
    const url = `${this.baseUrl}/api/mobile/v1/auth/logout`; // ✅ Correct endpoint
    return this.http.post<ApiResponse<void>>(url, {}, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getCurrentUser(): Observable<ApiResponse<LoginResponse>> {
    const url = `${this.baseUrl}/api/mobile/v1/auth/me`; // ✅ Correct endpoint
    return this.http.get<ApiResponse<LoginResponse>>(url, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  // --- Remove non-existent profile endpoints ---
  // getProfile() and updateProfile() removed - they don't exist in Laravel

  // --- Elections endpoints ---
  getElections(): Observable<ApiResponse<ElectionData[]>> {
    // ✅ CORRECTED: Use actual Laravel route
    const url = `${this.baseUrl}/api/elections`;
    return this.http.get<ApiResponse<ElectionData[]>>(url, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  // ❌ REMOVED: getActiveElections() - route doesn't exist in Laravel

  getElection(id: string): Observable<ApiResponse<ElectionData>> {
    // ✅ CORRECTED: Use actual Laravel route
    const url = `${this.baseUrl}/api/elections/${id}`;
    return this.http.get<ApiResponse<ElectionData>>(url, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  // --- Platform endpoints ---
  getPlatformStats(): Observable<ApiResponse<any>> {
    // ✅ CORRECTED: Use actual Laravel route
    const url = `${this.baseUrl}/api/platform/stats`;
    return this.http.get<ApiResponse<any>>(url, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  // --- Health check ---
  healthCheck(): Observable<ApiResponse<any>> {
    // ✅ CORRECTED: Use actual Laravel route
    const url = `${this.baseUrl}/api/health`;
    return this.http.get<ApiResponse<any>>(url, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  databaseHealthCheck(): Observable<ApiResponse<any>> {
    // ✅ CORRECTED: Use actual Laravel route
    const url = `${this.baseUrl}/api/database/health`;
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