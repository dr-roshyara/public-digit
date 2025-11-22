import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { ApiService } from '@core/services/api.service';
import { User } from '@core/models/auth.models';

@Component({
  selector: 'pd-home',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-container">
      <!-- Header Section -->
      <div class="dashboard-header">
        <div class="header-content">
          <h1>Welcome back!</h1>
          <p class="user-name" *ngIf="currentUser">{{ currentUser.name }}</p>
          <p class="user-email" *ngIf="currentUser">{{ currentUser.email }}</p>
        </div>
        <button class="logout-btn" (click)="logout()">
          <svg class="logout-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>

      <!-- Quick Stats -->
      <div class="stats-section">
        <h2 class="section-title">Quick Stats</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <svg class="stat-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <div class="stat-info">
              <p class="stat-value">{{ stats.activeElections }}</p>
              <p class="stat-label">Active Elections</p>
            </div>
          </div>

          <div class="stat-card">
            <svg class="stat-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div class="stat-info">
              <p class="stat-value">{{ stats.myVotes }}</p>
              <p class="stat-label">Votes Cast</p>
            </div>
          </div>

          <div class="stat-card">
            <svg class="stat-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div class="stat-info">
              <p class="stat-value">{{ stats.upcomingElections }}</p>
              <p class="stat-label">Upcoming</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Navigation Cards -->
      <div class="navigation-section">
        <h2 class="section-title">Quick Actions</h2>
        <div class="nav-grid">
          <div class="nav-card" (click)="navigateToElections()">
            <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <h3>Elections</h3>
            <p>View and participate in elections</p>
            <svg class="arrow-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>

          <div class="nav-card" (click)="navigateToProfile()">
            <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <h3>My Profile</h3>
            <p>View and edit your profile</p>
            <svg class="arrow-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>

          <div class="nav-card" (click)="navigateToResults()">
            <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3>Results</h3>
            <p>View election results</p>
            <svg class="arrow-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>

          <div class="nav-card" (click)="navigateToSettings()">
            <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h3>Settings</h3>
            <p>Manage your preferences</p>
            <svg class="arrow-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="dashboard-footer">
        <p>PublicDigit Election Platform</p>
        <p class="version">v1.0.0-dev</p>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 1.5rem;
      color: white;
    }

    .dashboard-header {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 1rem;
      padding: 2rem;
      margin-bottom: 2rem;
      border: 1px solid rgba(255, 255, 255, 0.2);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .header-content h1 {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }

    .user-name {
      font-size: 1.25rem;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.95);
      margin-bottom: 0.25rem;
    }

    .user-email {
      font-size: 0.95rem;
      color: rgba(255, 255, 255, 0.7);
    }

    .logout-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(255, 107, 107, 0.3);
      border: 1px solid rgba(255, 107, 107, 0.5);
      color: white;
      padding: 0.75rem 1.5rem;
      border-radius: 0.75rem;
      cursor: pointer;
      transition: all 0.3s ease;
      font-size: 1rem;
      font-weight: 500;
    }

    .logout-btn:hover {
      background: rgba(255, 107, 107, 0.4);
      transform: translateY(-2px);
    }

    .logout-icon {
      width: 20px;
      height: 20px;
    }

    .section-title {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 1rem;
      color: white;
    }

    .stats-section {
      margin-bottom: 2rem;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
    }

    .stat-card {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 1rem;
      padding: 1.5rem;
      border: 1px solid rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .stat-icon {
      width: 40px;
      height: 40px;
      color: rgba(255, 255, 255, 0.9);
      flex-shrink: 0;
    }

    .stat-info {
      flex: 1;
    }

    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 0.25rem;
    }

    .stat-label {
      font-size: 0.875rem;
      color: rgba(255, 255, 255, 0.8);
    }

    .navigation-section {
      margin-bottom: 2rem;
    }

    .nav-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1rem;
    }

    .nav-card {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 1rem;
      padding: 1.5rem;
      border: 1px solid rgba(255, 255, 255, 0.2);
      cursor: pointer;
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
    }

    .nav-card:hover {
      transform: translateY(-5px);
      background: rgba(255, 255, 255, 0.15);
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
    }

    .nav-icon {
      width: 48px;
      height: 48px;
      color: rgba(255, 255, 255, 0.9);
      margin-bottom: 1rem;
    }

    .nav-card h3 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    .nav-card p {
      font-size: 0.95rem;
      color: rgba(255, 255, 255, 0.8);
      margin-bottom: 0;
    }

    .arrow-icon {
      position: absolute;
      bottom: 1rem;
      right: 1rem;
      width: 24px;
      height: 24px;
      color: rgba(255, 255, 255, 0.6);
      transition: transform 0.3s ease;
    }

    .nav-card:hover .arrow-icon {
      transform: translateX(5px);
    }

    .dashboard-footer {
      text-align: center;
      margin-top: 3rem;
      padding: 1rem;
      color: rgba(255, 255, 255, 0.7);
    }

    .dashboard-footer p {
      margin: 0.25rem 0;
      font-size: 0.875rem;
    }

    .version {
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.5);
    }

    @media (max-width: 640px) {
      .dashboard-header {
        flex-direction: column;
        align-items: flex-start;
      }

      .logout-btn {
        width: 100%;
        justify-content: center;
      }

      .stats-grid {
        grid-template-columns: 1fr;
      }

      .nav-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class DashboardPage implements OnInit {
  private authService = inject(AuthService);
  private apiService = inject(ApiService);
  private router = inject(Router);

  currentUser: User | null = null;
  stats = {
    activeElections: 0,
    myVotes: 0,
    upcomingElections: 0
  };

  ngOnInit(): void {
    this.loadUserData();
    this.loadStats();
  }

  loadUserData(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });

    // Fetch current user if not loaded
    if (!this.currentUser) {
      this.authService.getCurrentUser().subscribe({
        next: (user) => {
          this.currentUser = user;
        },
        error: (error) => {
          console.error('Error loading user:', error);
        }
      });
    }
  }

  loadStats(): void {
    // Load active elections
    this.apiService.getActiveElections().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.stats.activeElections = response.data.length;
        }
      },
      error: (error) => console.error('Error loading active elections:', error)
    });

    // Load user's elections (votes cast)
    this.apiService.getMyElections().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.stats.myVotes = response.data.length;
        }
      },
      error: (error) => console.error('Error loading my elections:', error)
    });

    // Load all elections to calculate upcoming
    this.apiService.getElections().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          // For now, show total - active as upcoming (you can refine this logic)
          this.stats.upcomingElections = Math.max(0, response.data.length - this.stats.activeElections);
        }
      },
      error: (error) => console.error('Error loading elections:', error)
    });
  }

  navigateToElections(): void {
    console.log('Navigate to elections');
    // this.router.navigate(['/elections']);
  }

  navigateToProfile(): void {
    console.log('Navigate to profile');
    // this.router.navigate(['/profile']);
  }

  navigateToResults(): void {
    console.log('Navigate to results');
    // this.router.navigate(['/results']);
  }

  navigateToSettings(): void {
    console.log('Navigate to settings');
    // this.router.navigate(['/settings']);
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/']);
      },
      error: (error) => {
        console.error('Logout error:', error);
        // Still navigate to home even if logout API fails
        this.router.navigate(['/']);
      }
    });
  }
}