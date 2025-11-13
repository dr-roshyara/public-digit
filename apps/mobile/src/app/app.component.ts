import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'pd-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  template: `
    <div class="app-container">
      <header class="app-header">
        <h1>PublicDigit Mobile</h1>
        <div class="auth-status" *ngIf="authService.currentUser$ | async as user; else notLoggedIn">
          <span>Welcome, {{ user.name }}!</span>
          <button (click)="logout()" class="logout-btn">Logout</button>
        </div>
        <ng-template #notLoggedIn>
          <span>Please log in</span>
        </ng-template>
      </header>
      <main class="app-main">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .app-container {
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .app-header {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      color: white;
      padding: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    }
    .app-header h1 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
    }
    .auth-status {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .logout-btn {
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
    }
    .logout-btn:hover {
      background: rgba(255, 255, 255, 0.3);
    }
    .app-main {
      padding: 0;
    }
  `]
})
export class AppComponent implements OnInit {
  constructor(
    public authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    // Check authentication status on app start
    if (this.authService.isAuthenticated()) {
      this.authService.getCurrentUser().subscribe();
    }
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}