import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Router } from '@angular/router';

import { ApiService } from './api.service';
import { LoginRequest, LoginResponse, MobileUser } from '@public-digit/shared-types';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<MobileUser | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private tokenKey = 'auth_token';
  private userKey = 'current_user';

  constructor(
    private apiService: ApiService,
    private router: Router
  ) {
    this.loadStoredAuth();
  }

  login(credentials: LoginRequest): Observable<any> {
    return this.apiService.login(credentials).pipe(
      tap(response => {
        this.setAuth(response.data);
      })
    );
  }

  logout(): void {
    this.apiService.logout().subscribe({
      next: () => this.clearAuth(),
      error: () => this.clearAuth() // Clear auth even if API call fails
    });
  }

  getCurrentUser(): Observable<any> {
    return this.apiService.getCurrentUser().pipe(
      tap(response => {
        this.currentUserSubject.next(response.data.user);
        localStorage.setItem(this.userKey, JSON.stringify(response.data.user));
      })
    );
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  private setAuth(authData: LoginResponse): void {
    localStorage.setItem(this.tokenKey, authData.token);
    localStorage.setItem(this.userKey, JSON.stringify(authData.user));
    this.currentUserSubject.next(authData.user);
  }

  private clearAuth(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this.currentUserSubject.next(null);
    this.router.navigate(['/']);
  }

  private loadStoredAuth(): void {
    const token = localStorage.getItem(this.tokenKey);
    const userStr = localStorage.getItem(this.userKey);

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        this.currentUserSubject.next(user);
      } catch (error) {
        this.clearAuth();
      }
    }
  }
}
