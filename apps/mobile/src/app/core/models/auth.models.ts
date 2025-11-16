/**
 * Authentication and API Response Models
 * Centralized type definitions for type safety
 */

export interface User {
  id: number;
  tenant_id: number | null;
  name: string;
  email: string;
  email_verified_at: string | null;
  type: string;
  tenant_permissions: any | null;
  created_at: string;
  updated_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * LoginResponse - The actual login data (unwrapped from ApiResponse)
 * The API returns: ApiResponse<LoginResponse>
 */
export interface LoginResponse {
  token: string;
  user: User;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
}

export interface Tenant {
  id: number;
  slug: string;
  name: string;
  domain?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TenantListResponse {
  success: boolean;
  data: Tenant[];
}

export interface AuthCheckResponse {
  authenticated: boolean;
  user?: User;
}
