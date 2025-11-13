export * from './lib/shared-types';
// shared-types/index.ts
export interface LoginRequest {
  email: string;
  password: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface ErrorResponse {
  message: string;
  errors?: Record<string, string[]>;
}