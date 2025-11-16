import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import {
  MemberProfile,
  UpdateProfileRequest,
  ProfileVerificationRequest,
  ProfileVerificationResponse,
  MemberElections,
  MemberStatistics,
  ProfilePhotoUploadRequest,
  ProfilePhotoUploadResponse,
  MemberPreferences,
  MemberProfileResponse,
  MemberElectionsResponse,
  MemberStatisticsResponse
} from '../models/member.models';
import { TenantContextService } from '../../../core/services/tenant-context.service';

/**
 * Membership Service
 *
 * Bounded Context: Member Profile Management
 * Database: Tenant Database
 * API Prefix: /api/v1/membership
 *
 * Handles all member profile-related operations within the tenant context.
 * All API calls are tenant-scoped using the TenantContextService.
 */
@Injectable({
  providedIn: 'root'
})
export class MembershipService {
  private http = inject(HttpClient);
  private tenantContext = inject(TenantContextService);

  // Reactive state for current member profile
  private currentProfileSubject = new BehaviorSubject<MemberProfile | null>(null);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);

  // Public observables
  public currentProfile$ = this.currentProfileSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();
  public error$ = this.errorSubject.asObservable();

  /**
   * Get base URL for membership API calls
   * Uses tenant-scoped URL from TenantContextService
   */
  private get baseUrl(): string {
    return `${this.tenantContext.getTenantApiUrl()}/membership`;
  }

  /**
   * Get current user's member profile
   *
   * @returns Observable<MemberProfile>
   */
  getProfile(): Observable<MemberProfile> {
    // Return cached profile if available
    if (this.currentProfileSubject.value) {
      return new Observable(observer => {
        observer.next(this.currentProfileSubject.value!);
        observer.complete();
      });
    }

    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http.get<MemberProfileResponse>(`${this.baseUrl}/profile`).pipe(
      map(response => response.data),
      tap(profile => {
        this.currentProfileSubject.next(profile);
        this.loadingSubject.next(false);
      }),
      catchError(error => this.handleError('getProfile', error))
    );
  }

  /**
   * Update current user's member profile
   *
   * @param updateData - Profile fields to update
   * @returns Observable<MemberProfile>
   */
  updateProfile(updateData: UpdateProfileRequest): Observable<MemberProfile> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http.put<MemberProfileResponse>(
      `${this.baseUrl}/profile`,
      updateData
    ).pipe(
      map(response => response.data),
      tap(profile => {
        this.currentProfileSubject.next(profile);
        this.loadingSubject.next(false);
        console.log('[MembershipService] Profile updated successfully');
      }),
      catchError(error => this.handleError('updateProfile', error))
    );
  }

  /**
   * Verify member profile
   *
   * @param verificationData - Verification request data
   * @returns Observable<ProfileVerificationResponse>
   */
  verifyProfile(verificationData: ProfileVerificationRequest): Observable<ProfileVerificationResponse> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http.post<ProfileVerificationResponse>(
      `${this.baseUrl}/profile/verify`,
      verificationData
    ).pipe(
      tap(response => {
        this.loadingSubject.next(false);
        if (response.success && response.verification_status === 'verified') {
          // Refresh profile to get updated verification status
          this.refreshProfile().subscribe();
        }
        console.log('[MembershipService] Profile verification:', response.verification_status);
      }),
      catchError(error => this.handleError('verifyProfile', error))
    );
  }

  /**
   * Get member's elections (eligible and participated)
   *
   * @returns Observable<MemberElections>
   */
  getMemberElections(): Observable<MemberElections> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http.get<MemberElectionsResponse>(`${this.baseUrl}/elections`).pipe(
      map(response => response.data),
      tap(() => {
        this.loadingSubject.next(false);
      }),
      catchError(error => this.handleError('getMemberElections', error))
    );
  }

  /**
   * Get member statistics and engagement metrics
   *
   * @returns Observable<MemberStatistics>
   */
  getMemberStatistics(): Observable<MemberStatistics> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http.get<MemberStatisticsResponse>(`${this.baseUrl}/statistics`).pipe(
      map(response => response.data),
      tap(() => {
        this.loadingSubject.next(false);
      }),
      catchError(error => this.handleError('getMemberStatistics', error))
    );
  }

  /**
   * Upload profile photo
   *
   * @param photoData - Photo upload request data
   * @returns Observable<ProfilePhotoUploadResponse>
   */
  uploadProfilePhoto(photoData: ProfilePhotoUploadRequest): Observable<ProfilePhotoUploadResponse> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    // Create FormData for file upload
    const formData = new FormData();
    formData.append('photo', photoData.photo);

    if (photoData.crop_data) {
      formData.append('crop_data', JSON.stringify(photoData.crop_data));
    }

    return this.http.post<ProfilePhotoUploadResponse>(
      `${this.baseUrl}/profile/photo`,
      formData
    ).pipe(
      tap(response => {
        this.loadingSubject.next(false);
        if (response.success) {
          // Refresh profile to get updated photo URL
          this.refreshProfile().subscribe();
        }
        console.log('[MembershipService] Profile photo uploaded successfully');
      }),
      catchError(error => this.handleError('uploadProfilePhoto', error))
    );
  }

  /**
   * Get member preferences
   *
   * @returns Observable<MemberPreferences>
   */
  getPreferences(): Observable<MemberPreferences> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http.get<{ success: boolean; data: MemberPreferences }>(
      `${this.baseUrl}/preferences`
    ).pipe(
      map(response => response.data),
      tap(() => {
        this.loadingSubject.next(false);
      }),
      catchError(error => this.handleError('getPreferences', error))
    );
  }

  /**
   * Update member preferences
   *
   * @param preferences - Updated preferences
   * @returns Observable<MemberPreferences>
   */
  updatePreferences(preferences: Partial<MemberPreferences>): Observable<MemberPreferences> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http.put<{ success: boolean; data: MemberPreferences }>(
      `${this.baseUrl}/preferences`,
      preferences
    ).pipe(
      map(response => response.data),
      tap(() => {
        this.loadingSubject.next(false);
        console.log('[MembershipService] Preferences updated successfully');
      }),
      catchError(error => this.handleError('updatePreferences', error))
    );
  }

  /**
   * Refresh profile from server (force reload)
   *
   * @returns Observable<MemberProfile>
   */
  refreshProfile(): Observable<MemberProfile> {
    // Clear cached profile
    this.currentProfileSubject.next(null);
    return this.getProfile();
  }

  /**
   * Clear cached profile data
   * Useful when switching tenants or logging out
   */
  clearProfile(): void {
    this.currentProfileSubject.next(null);
    this.errorSubject.next(null);
    this.loadingSubject.next(false);
  }

  /**
   * Get current cached profile (synchronous)
   *
   * @returns MemberProfile | null
   */
  getCurrentProfile(): MemberProfile | null {
    return this.currentProfileSubject.value;
  }

  /**
   * Handle HTTP errors consistently
   *
   * @param operation - Name of the operation that failed
   * @param error - HTTP error response
   * @returns Observable that throws error
   */
  private handleError(operation: string, error: HttpErrorResponse): Observable<never> {
    this.loadingSubject.next(false);

    let errorMessage = 'An unexpected error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side or network error
      errorMessage = `Network error: ${error.error.message}`;
    } else {
      // Backend returned an unsuccessful response code
      errorMessage = error.error?.message || `Server error: ${error.status}`;
    }

    this.errorSubject.next(errorMessage);
    console.error(`[MembershipService] ${operation} failed:`, errorMessage, error);

    return throwError(() => new Error(errorMessage));
  }
}
