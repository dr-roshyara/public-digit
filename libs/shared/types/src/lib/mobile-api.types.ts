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
