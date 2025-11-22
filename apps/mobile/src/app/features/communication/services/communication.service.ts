import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import {
  ForumThread,
  ForumPost,
  ForumCategory,
  ThreadListItem,
  CreateThreadRequest,
  CreatePostRequest,
  UpdatePostRequest,
  ThreadResponse,
  PostResponse,
  ThreadListResponse,
  ThreadDetailsResponse,
  PostListResponse,
  CategoryListResponse,
  ThreadFilter,
  PostFilter,
  ForumStatistics,
  ForumStatisticsResponse,
  LikeActionResponse,
  FollowActionResponse,
  PaginationInfo
} from '../models/forum.models';
import { TenantContextService } from '../../../core/services/tenant-context.service';

/**
 * Communication Service
 *
 * Bounded Context: Forum & Discussion Management
 * Database: Tenant Database
 * API Prefix: /api/v1/forum
 *
 * Handles all communication and forum-related operations within the tenant context.
 * All API calls are tenant-scoped using the TenantContextService.
 */
@Injectable({
  providedIn: 'root'
})
export class CommunicationService {
  private http = inject(HttpClient);
  private tenantContext = inject(TenantContextService);

  // Reactive state
  private threadsSubject = new BehaviorSubject<ThreadListItem[]>([]);
  private selectedThreadSubject = new BehaviorSubject<ForumThread | null>(null);
  private categoriesSubject = new BehaviorSubject<ForumCategory[]>([]);
  private forumStatisticsSubject = new BehaviorSubject<ForumStatistics | null>(null);
  private paginationSubject = new BehaviorSubject<PaginationInfo | null>(null);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);

  // Public observables
  public threads$ = this.threadsSubject.asObservable();
  public selectedThread$ = this.selectedThreadSubject.asObservable();
  public categories$ = this.categoriesSubject.asObservable();
  public forumStatistics$ = this.forumStatisticsSubject.asObservable();
  public pagination$ = this.paginationSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();
  public error$ = this.errorSubject.asObservable();

  /**
   * Get base URL for forum API calls
   * Uses tenant-scoped URL from TenantContextService
   */
  private get baseUrl(): string {
    return `${this.tenantContext.getTenantApiUrl()}/forum`;
  }

  /**
   * Get forum threads with optional filtering and pagination
   *
   * @param filter - Optional filter criteria
   * @param page - Page number (default: 1)
   * @param perPage - Items per page (default: 20)
   * @returns Observable<ThreadListItem[]>
   */
  getThreads(filter?: ThreadFilter, page = 1, perPage = 20): Observable<ThreadListItem[]> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    let params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString());

    if (filter) {
      if (filter.status && filter.status.length > 0) {
        params = params.set('status', filter.status.join(','));
      }
      if (filter.category_id) {
        params = params.set('category_id', filter.category_id.toString());
      }
      if (filter.tags && filter.tags.length > 0) {
        params = params.set('tags', filter.tags.join(','));
      }
      if (filter.author_id) {
        params = params.set('author_id', filter.author_id.toString());
      }
      if (filter.search_query) {
        params = params.set('search', filter.search_query);
      }
      if (filter.pinned_only) {
        params = params.set('pinned_only', 'true');
      }
      if (filter.unread_only) {
        params = params.set('unread_only', 'true');
      }
      if (filter.following_only) {
        params = params.set('following_only', 'true');
      }
      if (filter.date_from) {
        params = params.set('date_from', filter.date_from);
      }
      if (filter.date_to) {
        params = params.set('date_to', filter.date_to);
      }
    }

    return this.http.get<ThreadListResponse>(`${this.baseUrl}/threads`, { params }).pipe(
      map(response => {
        // Update pagination info
        this.paginationSubject.next({
          current_page: response.data.page,
          per_page: response.data.per_page,
          total_items: response.data.total_count,
          total_pages: Math.ceil(response.data.total_count / response.data.per_page),
          has_next_page: response.data.page * response.data.per_page < response.data.total_count,
          has_previous_page: response.data.page > 1
        });
        return response.data.threads;
      }),
      tap(threads => {
        this.threadsSubject.next(threads);
        this.loadingSubject.next(false);
        console.log(`[CommunicationService] Loaded ${threads.length} threads`);
      }),
      catchError(error => this.handleError('getThreads', error))
    );
  }

  /**
   * Get thread details by ID
   *
   * @param threadId - Thread ID
   * @returns Observable<ForumThread>
   */
  getThreadDetails(threadId: number): Observable<ForumThread> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http.get<ThreadDetailsResponse>(`${this.baseUrl}/threads/${threadId}`).pipe(
      map(response => response.data),
      tap(thread => {
        this.selectedThreadSubject.next(thread);
        this.loadingSubject.next(false);
        console.log(`[CommunicationService] Loaded thread: ${thread.title}`);
      }),
      catchError(error => this.handleError('getThreadDetails', error))
    );
  }

  /**
   * Get posts for a thread with pagination
   *
   * @param threadId - Thread ID
   * @param page - Page number (default: 1)
   * @param perPage - Items per page (default: 20)
   * @returns Observable<ForumPost[]>
   */
  getThreadPosts(threadId: number, page = 1, perPage = 20): Observable<ForumPost[]> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    const params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString());

    return this.http.get<PostListResponse>(
      `${this.baseUrl}/threads/${threadId}/posts`,
      { params }
    ).pipe(
      map(response => response.data.posts),
      tap(posts => {
        this.loadingSubject.next(false);
        console.log(`[CommunicationService] Loaded ${posts.length} posts for thread ${threadId}`);
      }),
      catchError(error => this.handleError('getThreadPosts', error))
    );
  }

  /**
   * Create a new thread
   *
   * @param threadData - Thread creation data
   * @returns Observable<ForumThread>
   */
  createThread(threadData: CreateThreadRequest): Observable<ForumThread> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    console.log(`[CommunicationService] Creating thread: ${threadData.title}`);

    return this.http.post<ThreadResponse>(`${this.baseUrl}/threads`, threadData).pipe(
      map(response => response.thread),
      tap(thread => {
        this.loadingSubject.next(false);
        console.log(`[CommunicationService] Thread created successfully: ${thread.id}`);
        // Refresh thread list
        this.getThreads().subscribe();
      }),
      catchError(error => this.handleError('createThread', error))
    );
  }

  /**
   * Create a new post in a thread
   *
   * @param postData - Post creation data
   * @returns Observable<ForumPost>
   */
  createPost(postData: CreatePostRequest): Observable<ForumPost> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    console.log(`[CommunicationService] Creating post in thread ${postData.thread_id}`);

    return this.http.post<PostResponse>(
      `${this.baseUrl}/threads/${postData.thread_id}/posts`,
      postData
    ).pipe(
      map(response => response.post),
      tap(post => {
        this.loadingSubject.next(false);
        console.log(`[CommunicationService] Post created successfully: ${post.id}`);
        // Refresh thread details to update reply count
        this.getThreadDetails(postData.thread_id).subscribe();
      }),
      catchError(error => this.handleError('createPost', error))
    );
  }

  /**
   * Update a post
   *
   * @param postId - Post ID
   * @param updateData - Update data
   * @returns Observable<ForumPost>
   */
  updatePost(postId: number, updateData: UpdatePostRequest): Observable<ForumPost> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http.put<PostResponse>(`${this.baseUrl}/posts/${postId}`, updateData).pipe(
      map(response => response.post),
      tap(post => {
        this.loadingSubject.next(false);
        console.log(`[CommunicationService] Post updated successfully: ${post.id}`);
      }),
      catchError(error => this.handleError('updatePost', error))
    );
  }

  /**
   * Delete a post
   *
   * @param postId - Post ID
   * @returns Observable<void>
   */
  deletePost(postId: number): Observable<void> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http.delete<void>(`${this.baseUrl}/posts/${postId}`).pipe(
      tap(() => {
        this.loadingSubject.next(false);
        console.log(`[CommunicationService] Post deleted successfully: ${postId}`);
      }),
      catchError(error => this.handleError('deletePost', error))
    );
  }

  /**
   * Like or unlike a post
   *
   * @param postId - Post ID
   * @returns Observable<LikeActionResponse>
   */
  toggleLikePost(postId: number): Observable<LikeActionResponse> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http.post<LikeActionResponse>(
      `${this.baseUrl}/posts/${postId}/like`,
      {}
    ).pipe(
      tap(response => {
        this.loadingSubject.next(false);
        console.log(`[CommunicationService] Post like toggled: ${postId}, is_liked: ${response.is_liked}`);
      }),
      catchError(error => this.handleError('toggleLikePost', error))
    );
  }

  /**
   * Follow or unfollow a thread
   *
   * @param threadId - Thread ID
   * @returns Observable<FollowActionResponse>
   */
  toggleFollowThread(threadId: number): Observable<FollowActionResponse> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http.post<FollowActionResponse>(
      `${this.baseUrl}/threads/${threadId}/follow`,
      {}
    ).pipe(
      tap(response => {
        this.loadingSubject.next(false);
        console.log(`[CommunicationService] Thread follow toggled: ${threadId}, is_following: ${response.is_following}`);
      }),
      catchError(error => this.handleError('toggleFollowThread', error))
    );
  }

  /**
   * Get forum categories
   *
   * @returns Observable<ForumCategory[]>
   */
  getCategories(): Observable<ForumCategory[]> {
    // Return cached categories if available
    if (this.categoriesSubject.value.length > 0) {
      return new Observable(observer => {
        observer.next(this.categoriesSubject.value);
        observer.complete();
      });
    }

    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http.get<CategoryListResponse>(`${this.baseUrl}/categories`).pipe(
      map(response => response.data.categories),
      tap(categories => {
        this.categoriesSubject.next(categories);
        this.loadingSubject.next(false);
        console.log(`[CommunicationService] Loaded ${categories.length} categories`);
      }),
      catchError(error => this.handleError('getCategories', error))
    );
  }

  /**
   * Get forum statistics
   *
   * @returns Observable<ForumStatistics>
   */
  getStatistics(): Observable<ForumStatistics> {
    // Return cached statistics if available
    if (this.forumStatisticsSubject.value) {
      return new Observable(observer => {
        observer.next(this.forumStatisticsSubject.value!);
        observer.complete();
      });
    }

    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http.get<ForumStatisticsResponse>(`${this.baseUrl}/statistics`).pipe(
      map(response => response.data),
      tap(statistics => {
        this.forumStatisticsSubject.next(statistics);
        this.loadingSubject.next(false);
        console.log(`[CommunicationService] Loaded forum statistics`);
      }),
      catchError(error => this.handleError('getStatistics', error))
    );
  }

  /**
   * Search forum threads and posts
   *
   * @param query - Search query
   * @param page - Page number
   * @param perPage - Items per page
   * @returns Observable<ThreadListItem[]>
   */
  search(query: string, page = 1, perPage = 20): Observable<ThreadListItem[]> {
    return this.getThreads({ search_query: query }, page, perPage);
  }

  /**
   * Refresh thread list from server
   *
   * @returns Observable<ThreadListItem[]>
   */
  refreshThreads(): Observable<ThreadListItem[]> {
    return this.getThreads();
  }

  /**
   * Clear selected thread
   */
  clearSelectedThread(): void {
    this.selectedThreadSubject.next(null);
  }

  /**
   * Clear all cached data
   * Useful when switching tenants or logging out
   */
  clearCache(): void {
    this.threadsSubject.next([]);
    this.selectedThreadSubject.next(null);
    this.categoriesSubject.next([]);
    this.forumStatisticsSubject.next(null);
    this.paginationSubject.next(null);
    this.errorSubject.next(null);
    this.loadingSubject.next(false);
  }

  /**
   * Get currently selected thread (synchronous)
   *
   * @returns ForumThread | null
   */
  getSelectedThread(): ForumThread | null {
    return this.selectedThreadSubject.value;
  }

  /**
   * Check if thread has unread posts
   *
   * @param thread - Thread to check
   * @returns boolean
   */
  hasUnreadPosts(thread: ThreadListItem): boolean {
    return thread.has_unread_posts || false;
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

      // Special handling for forum-specific errors
      if (operation === 'createThread' || operation === 'createPost') {
        if (error.status === 403) {
          errorMessage = 'You do not have permission to post in the forum';
        } else if (error.status === 422) {
          errorMessage = 'Invalid post data. Please check your content';
        }
      } else if (operation === 'deletePost') {
        if (error.status === 403) {
          errorMessage = 'You can only delete your own posts';
        }
      }
    }

    this.errorSubject.next(errorMessage);
    console.error(`[CommunicationService] ${operation} failed:`, errorMessage, error);

    return throwError(() => new Error(errorMessage));
  }
}
