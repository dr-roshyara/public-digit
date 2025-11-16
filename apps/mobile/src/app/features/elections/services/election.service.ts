import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import {
  Election,
  ElectionListItem,
  Candidate,
  VoteRequest,
  VoteResponse,
  ElectionResults,
  ActiveElectionsResponse,
  ElectionDetailsResponse,
  ElectionResultsResponse,
  CandidateListResponse,
  ElectionFilter,
  ElectionStatistics
} from '../models/election.models';
import { TenantContextService } from '../../../core/services/tenant-context.service';

/**
 * Election Service
 *
 * Bounded Context: Election & Voting Operations
 * Database: Tenant Database
 * API Prefix: /api/v1/elections
 *
 * Handles all election and voting-related operations within the tenant context.
 * All API calls are tenant-scoped using the TenantContextService.
 *
 * Security: One vote per user per election (enforced by unique voter slug)
 */
@Injectable({
  providedIn: 'root'
})
export class ElectionService {
  private http = inject(HttpClient);
  private tenantContext = inject(TenantContextService);

  // Reactive state
  private activeElectionsSubject = new BehaviorSubject<ElectionListItem[]>([]);
  private selectedElectionSubject = new BehaviorSubject<Election | null>(null);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);

  // Public observables
  public activeElections$ = this.activeElectionsSubject.asObservable();
  public selectedElection$ = this.selectedElectionSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();
  public error$ = this.errorSubject.asObservable();

  /**
   * Get base URL for election API calls
   * Uses tenant-scoped URL from TenantContextService
   */
  private get baseUrl(): string {
    return `${this.tenantContext.getTenantApiUrl()}/elections`;
  }

  /**
   * Get all elections (with optional filtering)
   *
   * @param filter - Optional filter criteria
   * @returns Observable<ElectionListItem[]>
   */
  getElections(filter?: ElectionFilter): Observable<ElectionListItem[]> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    let params = new HttpParams();
    if (filter) {
      if (filter.status && filter.status.length > 0) {
        params = params.set('status', filter.status.join(','));
      }
      if (filter.date_from) {
        params = params.set('date_from', filter.date_from);
      }
      if (filter.date_to) {
        params = params.set('date_to', filter.date_to);
      }
      if (filter.search_query) {
        params = params.set('search', filter.search_query);
      }
      if (filter.only_eligible) {
        params = params.set('only_eligible', 'true');
      }
      if (filter.only_voted) {
        params = params.set('only_voted', 'true');
      }
      if (filter.only_not_voted) {
        params = params.set('only_not_voted', 'true');
      }
    }

    return this.http.get<ActiveElectionsResponse>(this.baseUrl, { params }).pipe(
      map(response => response.data.elections),
      tap(elections => {
        this.loadingSubject.next(false);
        console.log(`[ElectionService] Loaded ${elections.length} elections`);
      }),
      catchError(error => this.handleError('getElections', error))
    );
  }

  /**
   * Get active elections only
   *
   * @returns Observable<ElectionListItem[]>
   */
  getActiveElections(): Observable<ElectionListItem[]> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http.get<ActiveElectionsResponse>(`${this.baseUrl}/active`).pipe(
      map(response => response.data.elections),
      tap(elections => {
        this.activeElectionsSubject.next(elections);
        this.loadingSubject.next(false);
        console.log(`[ElectionService] Loaded ${elections.length} active elections`);
      }),
      catchError(error => this.handleError('getActiveElections', error))
    );
  }

  /**
   * Get election details by ID
   *
   * @param electionId - Election ID
   * @returns Observable<Election>
   */
  getElectionDetails(electionId: number): Observable<Election> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http.get<ElectionDetailsResponse>(`${this.baseUrl}/${electionId}`).pipe(
      map(response => response.data),
      tap(election => {
        this.selectedElectionSubject.next(election);
        this.loadingSubject.next(false);
        console.log(`[ElectionService] Loaded election: ${election.title}`);
      }),
      catchError(error => this.handleError('getElectionDetails', error))
    );
  }

  /**
   * Get candidates for an election
   *
   * @param electionId - Election ID
   * @returns Observable<Candidate[]>
   */
  getCandidates(electionId: number): Observable<Candidate[]> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http.get<CandidateListResponse>(`${this.baseUrl}/${electionId}/candidates`).pipe(
      map(response => response.data.candidates),
      tap(candidates => {
        this.loadingSubject.next(false);
        console.log(`[ElectionService] Loaded ${candidates.length} candidates for election ${electionId}`);
      }),
      catchError(error => this.handleError('getCandidates', error))
    );
  }

  /**
   * Cast vote in an election
   *
   * CRITICAL: Enforces one vote per user via unique voter_slug
   *
   * @param voteRequest - Vote data including voter slug
   * @returns Observable<VoteResponse>
   */
  castVote(voteRequest: VoteRequest): Observable<VoteResponse> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    console.log(`[ElectionService] Casting vote for election ${voteRequest.election_id}`);

    return this.http.post<VoteResponse>(
      `${this.baseUrl}/${voteRequest.election_id}/vote`,
      voteRequest
    ).pipe(
      tap(response => {
        this.loadingSubject.next(false);
        if (response.success) {
          console.log(`[ElectionService] Vote cast successfully. Receipt: ${response.receipt_code}`);
          // Refresh election details to update vote status
          this.getElectionDetails(voteRequest.election_id).subscribe();
        }
      }),
      catchError(error => this.handleError('castVote', error))
    );
  }

  /**
   * Get election results
   *
   * @param electionId - Election ID
   * @returns Observable<ElectionResults>
   */
  getResults(electionId: number): Observable<ElectionResults> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http.get<ElectionResultsResponse>(`${this.baseUrl}/${electionId}/results`).pipe(
      map(response => response.data),
      tap(results => {
        this.loadingSubject.next(false);
        console.log(`[ElectionService] Loaded results for election ${electionId}`);
      }),
      catchError(error => this.handleError('getResults', error))
    );
  }

  /**
   * Get election statistics for the current member
   *
   * @returns Observable<ElectionStatistics>
   */
  getStatistics(): Observable<ElectionStatistics> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http.get<{ success: boolean; data: ElectionStatistics }>(
      `${this.baseUrl}/statistics`
    ).pipe(
      map(response => response.data),
      tap(() => {
        this.loadingSubject.next(false);
      }),
      catchError(error => this.handleError('getStatistics', error))
    );
  }

  /**
   * Refresh active elections from server
   *
   * @returns Observable<ElectionListItem[]>
   */
  refreshActiveElections(): Observable<ElectionListItem[]> {
    return this.getActiveElections();
  }

  /**
   * Clear selected election
   */
  clearSelectedElection(): void {
    this.selectedElectionSubject.next(null);
  }

  /**
   * Clear all cached data
   * Useful when switching tenants or logging out
   */
  clearCache(): void {
    this.activeElectionsSubject.next([]);
    this.selectedElectionSubject.next(null);
    this.errorSubject.next(null);
    this.loadingSubject.next(false);
  }

  /**
   * Get currently selected election (synchronous)
   *
   * @returns Election | null
   */
  getSelectedElection(): Election | null {
    return this.selectedElectionSubject.value;
  }

  /**
   * Check if user can vote in election
   *
   * @param election - Election to check
   * @returns boolean
   */
  canVote(election: Election): boolean {
    if (!election.user_vote_status) {
      return false;
    }

    return election.user_vote_status.can_vote && !election.user_vote_status.has_voted;
  }

  /**
   * Check if election results are available
   *
   * @param election - Election to check
   * @returns boolean
   */
  areResultsAvailable(election: Election): boolean {
    return election.results_published && election.status === 'completed';
  }

  /**
   * Format vote receipt for display
   *
   * @param receiptCode - Receipt code from vote response
   * @returns string - Formatted receipt
   */
  formatReceipt(receiptCode: string): string {
    // Format receipt code for better readability
    // Example: ABC123DEF456 -> ABC1-23DE-F456
    if (!receiptCode || receiptCode.length < 8) {
      return receiptCode;
    }

    return `${receiptCode.slice(0, 4)}-${receiptCode.slice(4, 8)}-${receiptCode.slice(8)}`;
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

      // Special handling for voting errors
      if (operation === 'castVote') {
        if (error.status === 403) {
          errorMessage = 'You are not eligible to vote in this election';
        } else if (error.status === 409) {
          errorMessage = 'You have already voted in this election';
        } else if (error.status === 422) {
          errorMessage = 'Invalid vote data. Please check your selections';
        }
      }
    }

    this.errorSubject.next(errorMessage);
    console.error(`[ElectionService] ${operation} failed:`, errorMessage, error);

    return throwError(() => new Error(errorMessage));
  }
}
