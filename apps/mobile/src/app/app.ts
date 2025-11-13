import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { Subscription } from 'rxjs';

/**
 * The root component of the application.
 * Note: When bootstrapping a standalone component, its selector does not 
 * need to match the host element's ID, but using 'app-root' is conventional.
 */
@Component({
  selector: 'app-root', 
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
})
export class App implements OnInit, OnDestroy {
  public authService = inject(AuthService);
  private router = inject(Router);
  private userSubscription?: Subscription;

  ngOnInit(): void {
    // Check authentication state on initialization
    if (this.authService.isAuthenticated()) {
      // Use .subscribe() without assignment if the subscription is not strictly needed for cleanup,
      // but keeping it for cleanup is safer.
      this.userSubscription = this.authService.getCurrentUser().subscribe({
        // Handle successful response if necessary, or just log errors
        error: (error) => {
          console.error('Failed to fetch user data and current user state:', error);
          // Consider navigating to login here if the auth token is invalid
        }
      });
    }
  }

  /**
   * Clears authentication state and navigates to the home/login page.
   */
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.userSubscription?.unsubscribe();
  }
}