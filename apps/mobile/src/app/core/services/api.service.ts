import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { 
  LoginRequest, 
  LoginResponse, 
  ApiResponse,
  ErrorResponse 
} from '@public-digit/shared-types';

// Placeholder types for better readability; define these in your shared-types package
type ProfileData = any;
type ElectionData = any;

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  // Use inject() for dependency injection (modern Angular practice)
  private http = inject(HttpClient);
  
  // Use a private, readonly property
  private readonly baseUrl = 'http://localhost:8000'; // Your Laravel backend URL

  /**
   * Creates HttpHeaders, including Content-Type, Accept, and Authorization if a token is present.
   */
  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    
    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    });

    // Conditionally set the Authorization header
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return headers;
  }

  // --- Authentication endpoints ---
  login(credentials: LoginRequest): Observable<ApiResponse<LoginResponse>> {
    const url = `${this.baseUrl}/mobile/v1/auth/login`;
    return this.http.post<ApiResponse<LoginResponse>>(url, credentials, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  logout(): Observable<ApiResponse<void>> {
    const url = `${this.baseUrl}/mobile/v1/auth/logout`;
    // Passing {} as the body for the POST request
    return this.http.post<ApiResponse<void>>(url, {}, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getCurrentUser(): Observable<ApiResponse<LoginResponse>> {
    const url = `${this.baseUrl}/mobile/v1/auth/me`;
    return this.http.get<ApiResponse<LoginResponse>>(url, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  // --- Profile endpoints ---
  getProfile(): Observable<ApiResponse<ProfileData>> {
    const url = `${this.baseUrl}/mobile/v1/profile`;
    return this.http.get<ApiResponse<ProfileData>>(url, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  updateProfile(profileData: ProfileData): Observable<ApiResponse<ProfileData>> {
    const url = `${this.baseUrl}/mobile/v1/profile`;
    return this.http.put<ApiResponse<ProfileData>>(url, profileData, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  // --- Elections endpoints ---
  getElections(): Observable<ApiResponse<ElectionData[]>> {
    const url = `${this.baseUrl}/mobile/v1/elections`;
    return this.http.get<ApiResponse<ElectionData[]>>(url, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getActiveElections(): Observable<ApiResponse<ElectionData[]>> {
    const url = `${this.baseUrl}/mobile/v1/elections/active`;
    return this.http.get<ApiResponse<ElectionData[]>>(url, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getElection(id: string): Observable<ApiResponse<ElectionData>> {
    const url = `${this.baseUrl}/mobile/v1/elections/${id}`;
    return this.http.get<ApiResponse<ElectionData>>(url, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  // --- Health check ---
  healthCheck(): Observable<ApiResponse<any>> {
    const url = `${this.baseUrl}/mobile/v1/health`;
    return this.http.get<ApiResponse<any>>(url, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  /**
   * Centralized error handling function for API requests.
   * Uses HttpErrorResponse typing for better precision.
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error('API Error:', error);
    
    // Check if the error has a defined API message structure (e.g., Laravel validation error)
    if (error.error && typeof error.error === 'object' && error.error.message) {
      // Use the specific message from the API response body
      return throwError(() => new Error(error.error.message));
    } else if (error.message) {
      // Fallback for general HTTP errors (e.g., 404, network failure)
      return throwError(() => new Error(`HTTP Error (${error.status}): ${error.message}`));
    }
    
    // Default fallback for unknown errors
    return throwError(() => new Error('An unknown network error occurred.'));
  }
}