/**
 * Communication Context - Domain Models
 *
 * Bounded Context: Forum & Discussion Management
 * Database: Tenant Database
 * API Prefix: /api/v1/forum
 *
 * These models represent the communication and forum domain within the tenant context.
 */

/**
 * Thread Status
 *
 * Represents the status of a forum thread
 */
export type ThreadStatus = 'open' | 'closed' | 'pinned' | 'archived' | 'locked';

/**
 * Post Status
 *
 * Represents the status of a forum post
 */
export type PostStatus = 'published' | 'draft' | 'moderated' | 'deleted';

/**
 * Forum Thread
 *
 * Represents a discussion thread in the forum
 */
export interface ForumThread {
  id: number;
  tenant_id: number;

  // Thread Information
  title: string;
  slug: string;
  description?: string;
  status: ThreadStatus;

  // Author Information
  author_id: number;
  author_name: string;
  author_photo_url?: string;

  // Category and Tags
  category_id?: number;
  category_name?: string;
  tags?: string[];

  // Engagement Metrics
  view_count: number;
  reply_count: number;
  like_count: number;
  participant_count: number;

  // Thread Metadata
  is_pinned: boolean;
  is_locked: boolean;
  is_announcement: boolean;

  // First and Last Activity
  first_post_id: number;
  last_post_id?: number;
  last_post_at?: string;
  last_post_author_name?: string;

  // Timestamps
  created_at: string;
  updated_at: string;

  // User Interaction
  is_following?: boolean;
  has_unread_posts?: boolean;
  user_last_read_at?: string;

  // Related Entities (loaded on demand)
  posts?: ForumPost[];
  first_post?: ForumPost;
}

/**
 * Forum Post
 *
 * Represents a post within a forum thread
 */
export interface ForumPost {
  id: number;
  thread_id: number;
  tenant_id: number;

  // Post Content
  content: string;
  content_html?: string;
  status: PostStatus;

  // Author Information
  author_id: number;
  author_name: string;
  author_photo_url?: string;
  author_member_number?: string;

  // Reply Information
  parent_post_id?: number;
  reply_to_author_name?: string;
  is_thread_starter: boolean;

  // Engagement
  like_count: number;
  reply_count: number;
  is_liked_by_user?: boolean;

  // Moderation
  is_edited: boolean;
  edited_at?: string;
  is_moderated: boolean;
  moderation_reason?: string;

  // Timestamps
  created_at: string;
  updated_at: string;

  // Related Entities
  replies?: ForumPost[];
}

/**
 * Forum Category
 *
 * Represents a category for organizing forum threads
 */
export interface ForumCategory {
  id: number;
  tenant_id: number;
  name: string;
  slug: string;
  description?: string;
  display_order: number;
  thread_count: number;
  post_count: number;
  icon?: string;
  color?: string;
  created_at: string;
}

/**
 * Thread List Item
 *
 * Lightweight thread information for list views
 */
export interface ThreadListItem {
  id: number;
  title: string;
  slug: string;
  status: ThreadStatus;
  author_name: string;
  author_photo_url?: string;
  category_name?: string;
  reply_count: number;
  view_count: number;
  is_pinned: boolean;
  is_locked: boolean;
  has_unread_posts?: boolean;
  last_post_at?: string;
  last_post_author_name?: string;
  created_at: string;
}

/**
 * Create Thread Request
 *
 * Data structure for creating a new thread
 */
export interface CreateThreadRequest {
  title: string;
  content: string;
  category_id?: number;
  tags?: string[];
  is_announcement?: boolean;
}

/**
 * Create Post Request
 *
 * Data structure for creating a new post
 */
export interface CreatePostRequest {
  thread_id: number;
  content: string;
  parent_post_id?: number;
}

/**
 * Update Post Request
 *
 * Data structure for updating a post
 */
export interface UpdatePostRequest {
  content: string;
}

/**
 * Thread Response
 *
 * Response after creating/updating a thread
 */
export interface ThreadResponse {
  success: boolean;
  message: string;
  thread: ForumThread;
}

/**
 * Post Response
 *
 * Response after creating/updating a post
 */
export interface PostResponse {
  success: boolean;
  message: string;
  post: ForumPost;
}

/**
 * Thread List Response
 *
 * Response for thread listing
 */
export interface ThreadListResponse {
  success: boolean;
  message?: string;
  data: {
    threads: ThreadListItem[];
    total_count: number;
    page: number;
    per_page: number;
  };
}

/**
 * Thread Details Response
 *
 * Response for thread details
 */
export interface ThreadDetailsResponse {
  success: boolean;
  message?: string;
  data: ForumThread;
}

/**
 * Post List Response
 *
 * Response for post listing
 */
export interface PostListResponse {
  success: boolean;
  message?: string;
  data: {
    posts: ForumPost[];
    total_count: number;
    page: number;
    per_page: number;
  };
}

/**
 * Category List Response
 *
 * Response for category listing
 */
export interface CategoryListResponse {
  success: boolean;
  message?: string;
  data: {
    categories: ForumCategory[];
    total_count: number;
  };
}

/**
 * Thread Filter
 *
 * Filter options for thread listings
 */
export interface ThreadFilter {
  status?: ThreadStatus[];
  category_id?: number;
  tags?: string[];
  author_id?: number;
  search_query?: string;
  pinned_only?: boolean;
  unread_only?: boolean;
  following_only?: boolean;
  date_from?: string;
  date_to?: string;
}

/**
 * Post Filter
 *
 * Filter options for post listings
 */
export interface PostFilter {
  thread_id?: number;
  author_id?: number;
  parent_post_id?: number;
  status?: PostStatus[];
  date_from?: string;
  date_to?: string;
}

/**
 * Forum Statistics
 *
 * Statistical information about forum activity
 */
export interface ForumStatistics {
  total_threads: number;
  total_posts: number;
  total_participants: number;
  total_views: number;
  threads_created_by_user: number;
  posts_created_by_user: number;
  threads_following: number;
  unread_threads: number;
  recent_active_threads: ThreadListItem[];
}

/**
 * Forum Statistics Response
 *
 * Response for forum statistics
 */
export interface ForumStatisticsResponse {
  success: boolean;
  message?: string;
  data: ForumStatistics;
}

/**
 * Like Action Response
 *
 * Response after liking/unliking a post
 */
export interface LikeActionResponse {
  success: boolean;
  message: string;
  is_liked: boolean;
  like_count: number;
}

/**
 * Follow Action Response
 *
 * Response after following/unfollowing a thread
 */
export interface FollowActionResponse {
  success: boolean;
  message: string;
  is_following: boolean;
}

/**
 * Notification Settings
 *
 * User notification preferences for forum
 */
export interface ForumNotificationSettings {
  notify_on_reply: boolean;
  notify_on_mention: boolean;
  notify_on_like: boolean;
  notify_on_new_thread: boolean;
  email_notifications: boolean;
  push_notifications: boolean;
}

/**
 * Pagination Info
 *
 * Information about paginated results
 */
export interface PaginationInfo {
  current_page: number;
  per_page: number;
  total_items: number;
  total_pages: number;
  has_next_page: boolean;
  has_previous_page: boolean;
}
