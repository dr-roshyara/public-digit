// Mobile API Types
export interface LoginRequest {
  email: string;
  password: string;
  device_name?: string;
}

export interface LoginResponse {
  token: string;
  user: MobileUser;
  tenant?: TenantContext;
}

export interface MobileUser {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  role: string;
  permissions: string[];
}

export interface TenantContext {
  id: string;
  slug: string;
  name: string;
  database_name: string;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  meta?: {
    current_page?: number;
    per_page?: number;
    total?: number;
    last_page?: number;
  };
}

export interface ErrorResponse {
  message: string;
  errors?: Record<string, string[]>;
  code?: string;
}

// Election Types
export interface Election {
  id: string;
  title: string;
  description: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  start_date: string;
  end_date: string;
  tenant_id: string;
}

export interface Candidate {
  id: string;
  name: string;
  description: string;
  election_id: string;
}

// Add any other shared types you need here