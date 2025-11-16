/**
 * Election Context - Domain Models
 *
 * Bounded Context: Election & Voting Operations
 * Database: Tenant Database
 * API Prefix: /api/v1/elections
 *
 * These models represent the election and voting domain within the tenant context.
 */

/**
 * Election Status
 *
 * Represents the lifecycle states of an election
 */
export type ElectionStatus = 'draft' | 'active' | 'completed' | 'cancelled';

/**
 * Vote Status
 *
 * Represents the status of a vote cast by a member
 */
export type VoteStatus = 'pending' | 'confirmed' | 'rejected';

/**
 * Election
 *
 * Represents a complete election entity
 */
export interface Election {
  id: number;
  tenant_id: number;

  // Election Information
  title: string;
  description: string;
  instructions?: string;
  election_type: 'single' | 'multiple' | 'ranked';

  // Status and Lifecycle
  status: ElectionStatus;
  start_date: string;
  end_date: string;

  // Voting Rules
  max_selections: number;
  allow_abstain: boolean;
  require_verification: boolean;
  anonymous_voting: boolean;

  // Counts and Statistics
  total_eligible_voters: number;
  total_votes_cast: number;
  total_candidates: number;
  participation_rate: number;

  // Results
  results_published: boolean;
  results_published_at?: string;

  // Metadata
  created_by: number;
  created_at: string;
  updated_at: string;

  // Related entities (optional, loaded on demand)
  candidates?: Candidate[];
  user_vote_status?: UserVoteStatus;
}

/**
 * Candidate
 *
 * Represents a candidate in an election
 */
export interface Candidate {
  id: number;
  election_id: number;
  tenant_id: number;

  // Candidate Information
  name: string;
  bio?: string;
  photo_url?: string;
  platform_statement?: string;

  // Position and Display
  display_order: number;
  is_active: boolean;

  // Vote Counts (only visible if results published)
  vote_count?: number;
  vote_percentage?: number;

  // Metadata
  created_at: string;
  updated_at: string;
}

/**
 * Vote Request
 *
 * Data structure for casting a vote
 */
export interface VoteRequest {
  election_id: number;
  candidate_ids: number[];  // Array to support multiple selections
  voter_slug: string;  // Unique identifier for voter (ensures one vote per person)
  verification_token?: string;  // Optional verification token
  notes?: string;  // Optional voter notes (if allowed)
}

/**
 * Vote Response
 *
 * Response after casting a vote
 */
export interface VoteResponse {
  success: boolean;
  message: string;
  vote_id: string;  // Encrypted/hashed vote ID
  vote_status: VoteStatus;
  timestamp: string;
  receipt_code?: string;  // Optional receipt for verification
}

/**
 * User Vote Status
 *
 * Represents the current user's voting status for an election
 */
export interface UserVoteStatus {
  has_voted: boolean;
  vote_date?: string;
  vote_id?: string;
  can_vote: boolean;
  ineligible_reason?: string;
  receipt_code?: string;
}

/**
 * Election Results
 *
 * Comprehensive results for an election
 */
export interface ElectionResults {
  election_id: number;
  election_title: string;
  status: ElectionStatus;
  results_published: boolean;

  // Overall Statistics
  total_eligible_voters: number;
  total_votes_cast: number;
  participation_rate: number;
  abstain_count: number;

  // Candidate Results (sorted by vote count descending)
  candidate_results: CandidateResult[];

  // Results Metadata
  results_calculated_at: string;
  results_published_at?: string;
}

/**
 * Candidate Result
 *
 * Individual candidate results within an election
 */
export interface CandidateResult {
  candidate_id: number;
  candidate_name: string;
  candidate_photo_url?: string;
  vote_count: number;
  vote_percentage: number;
  rank: number;
  is_winner: boolean;
}

/**
 * Election List Item
 *
 * Lightweight election information for list views
 */
export interface ElectionListItem {
  id: number;
  title: string;
  status: ElectionStatus;
  start_date: string;
  end_date: string;
  total_candidates: number;
  has_voted: boolean;
  can_vote: boolean;
  results_published: boolean;
}

/**
 * Active Elections Response
 *
 * Response for getting active elections
 */
export interface ActiveElectionsResponse {
  success: boolean;
  message?: string;
  data: {
    elections: ElectionListItem[];
    total_count: number;
  };
}

/**
 * Election Details Response
 *
 * Response for getting election details
 */
export interface ElectionDetailsResponse {
  success: boolean;
  message?: string;
  data: Election;
}

/**
 * Election Results Response
 *
 * Response for getting election results
 */
export interface ElectionResultsResponse {
  success: boolean;
  message?: string;
  data: ElectionResults;
}

/**
 * Candidate List Response
 *
 * Response for getting election candidates
 */
export interface CandidateListResponse {
  success: boolean;
  message?: string;
  data: {
    candidates: Candidate[];
    total_count: number;
  };
}

/**
 * Election Filter
 *
 * Filter options for election listings
 */
export interface ElectionFilter {
  status?: ElectionStatus[];
  date_from?: string;
  date_to?: string;
  search_query?: string;
  only_eligible?: boolean;
  only_voted?: boolean;
  only_not_voted?: boolean;
}

/**
 * Election Statistics
 *
 * Statistical information about elections
 */
export interface ElectionStatistics {
  total_elections: number;
  active_elections: number;
  completed_elections: number;
  total_participation_rate: number;
  elections_voted: number;
  elections_eligible: number;
}
