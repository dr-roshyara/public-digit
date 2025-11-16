/**
 * Membership Context - Domain Models
 *
 * Bounded Context: Member Profile Management
 * Database: Tenant Database
 * API Prefix: /api/v1/membership
 *
 * These models represent the member profile domain within the tenant context.
 */

/**
 * Member Profile
 *
 * Represents a tenant member's complete profile information
 */
export interface MemberProfile {
  id: number;
  user_id: number;
  tenant_id: number;

  // Personal Information
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';

  // Address Information
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;

  // Member-specific Data
  member_number?: string;
  membership_type?: string;
  membership_status: 'active' | 'inactive' | 'pending' | 'suspended';
  joined_date: string;

  // Verification Status
  is_verified: boolean;
  verification_date?: string;
  verified_by?: number;

  // Profile Metadata
  profile_photo_url?: string;
  bio?: string;

  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * Update Profile Request
 *
 * Data structure for updating member profile
 */
export interface UpdateProfileRequest {
  // Personal Information (optional updates)
  first_name?: string;
  last_name?: string;
  phone?: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';

  // Address Information (optional updates)
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;

  // Profile Metadata (optional updates)
  bio?: string;
}

/**
 * Profile Verification Request
 *
 * Data structure for verifying a member profile
 */
export interface ProfileVerificationRequest {
  verification_type: 'email' | 'phone' | 'document' | 'manual';
  verification_code?: string;
  verification_token?: string;
  document_urls?: string[];
  notes?: string;
}

/**
 * Profile Verification Response
 *
 * Response after profile verification
 */
export interface ProfileVerificationResponse {
  success: boolean;
  message: string;
  verification_status: 'verified' | 'pending' | 'rejected';
  verified_at?: string;
}

/**
 * Member Elections
 *
 * Elections available to or participated in by the member
 */
export interface MemberElections {
  eligible_elections: ElectionSummary[];
  participated_elections: ElectionSummary[];
  pending_elections: ElectionSummary[];
}

/**
 * Election Summary (for member context)
 *
 * Lightweight election information for member profile
 */
export interface ElectionSummary {
  id: number;
  title: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  start_date: string;
  end_date: string;
  has_voted: boolean;
  vote_date?: string;
}

/**
 * Member Statistics
 *
 * Statistical information about member's engagement
 */
export interface MemberStatistics {
  total_elections_participated: number;
  total_votes_cast: number;
  total_payments_made: number;
  total_forum_posts: number;
  member_since_days: number;
  engagement_score: number;
}

/**
 * Profile Photo Upload Request
 *
 * Data structure for uploading profile photo
 */
export interface ProfilePhotoUploadRequest {
  photo: File | Blob;
  crop_data?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Profile Photo Upload Response
 *
 * Response after profile photo upload
 */
export interface ProfilePhotoUploadResponse {
  success: boolean;
  message: string;
  photo_url: string;
  thumbnail_url?: string;
}

/**
 * Member Preferences
 *
 * User preferences and settings
 */
export interface MemberPreferences {
  language: string;
  timezone: string;
  email_notifications: boolean;
  sms_notifications: boolean;
  push_notifications: boolean;
  newsletter_subscription: boolean;
  privacy_level: 'public' | 'members_only' | 'private';
}

/**
 * API Response wrapper for member profile operations
 */
export interface MemberProfileResponse {
  success: boolean;
  message?: string;
  data: MemberProfile;
}

/**
 * API Response wrapper for member elections
 */
export interface MemberElectionsResponse {
  success: boolean;
  message?: string;
  data: MemberElections;
}

/**
 * API Response wrapper for member statistics
 */
export interface MemberStatisticsResponse {
  success: boolean;
  message?: string;
  data: MemberStatistics;
}
