import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, tap, map } from 'rxjs';
import { ApiService, LoginRequest, LoginResponse, User } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiService = inject(ApiService);
  
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.apiService.login(credentials).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.setSession(response.data);
          this.currentUserSubject.next(response.data.user);
        }
      }),
      map(response => response.data!)
    );
  }

  logout(): Observable<void> {
    return this.apiService.logout().pipe(
      tap(() => {
        this.clearSession();
        this.currentUserSubject.next(null);
      }),
      map(() => undefined)
    );
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('auth_token');
  }

  getCurrentUser(): Observable<User> {
    if (this.isAuthenticated()) {
      return this.apiService.getCurrentUser().pipe(
        tap(response => {
          if (response.success && response.data) {
            this.currentUserSubject.next(response.data.user);
          }
        }),
        map(response => response.data!.user)
      );
    }
    return this.currentUser$;
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  private setSession(authResult: LoginResponse): void {
    localStorage.setItem('auth_token', authResult.token);
    localStorage.setItem('current_user', JSON.stringify(authResult.user));
  }

  private clearSession(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('current_user');
  }
}