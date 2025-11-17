import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

/**
 * Landing Page Component
 * Showcases PublicDigit brand identity and key features
 * Uses Tailwind CSS with brand colors for consistent mobile-first design
 */
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-primary-500 to-secondary-500 flex flex-col justify-between p-4 sm:p-8 safe-area-padding">

      <!-- Hero Section -->
      <div class="flex-1 flex flex-col items-center justify-center text-center text-white">

        <!-- Logo -->
        <div class="mb-8 animate-scale-in">
          <svg class="w-20 h-20 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <!-- Title & Subtitle -->
        <h1 class="text-4xl sm:text-5xl font-bold mb-2 text-white drop-shadow-md animate-fade-in">
          PublicDigit
        </h1>
        <p class="text-lg sm:text-xl text-white/90 mb-12 font-light animate-fade-in">
          Secure Digital Democracy Platform
        </p>

        <!-- Features Grid -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl mb-12 px-4">

          <!-- Feature 1: Secure Voting -->
          <div class="card group hover:scale-105 transition-transform duration-300 animate-slide-up">
            <svg class="w-12 h-12 mx-auto mb-4 text-white/90 group-hover:text-white transition-colors"
                 fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h3 class="text-xl font-semibold text-white mb-2">Secure Voting</h3>
            <p class="text-sm text-white/80 leading-relaxed">End-to-end encrypted voting system with blockchain verification</p>
          </div>

          <!-- Feature 2: Transparent -->
          <div class="card group hover:scale-105 transition-transform duration-300 animate-slide-up" style="animation-delay: 0.1s">
            <svg class="w-12 h-12 mx-auto mb-4 text-white/90 group-hover:text-white transition-colors"
                 fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <h3 class="text-xl font-semibold text-white mb-2">Transparent</h3>
            <p class="text-sm text-white/80 leading-relaxed">Real-time election monitoring with full audit trails</p>
          </div>

          <!-- Feature 3: Fast Results -->
          <div class="card group hover:scale-105 transition-transform duration-300 animate-slide-up" style="animation-delay: 0.2s">
            <svg class="w-12 h-12 mx-auto mb-4 text-white/90 group-hover:text-white transition-colors"
                 fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 class="text-xl font-semibold text-white mb-2">Fast Results</h3>
            <p class="text-sm text-white/80 leading-relaxed">Instant vote counting and real-time reporting</p>
          </div>

        </div>

        <!-- CTA Buttons -->
        <div class="flex flex-col sm:flex-row gap-4 w-full max-w-md animate-fade-in">

          <!-- Primary CTA: Sign In -->
          <button
            class="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
            (click)="navigateToLogin()">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            Sign In to Vote
          </button>

          <!-- Secondary CTA: Learn More -->
          <button
            class="btn-outline flex items-center justify-center gap-2 w-full sm:w-auto"
            (click)="learnMore()">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Learn More
          </button>

        </div>

      </div>

      <!-- Footer -->
      <footer class="text-center text-white/70 pt-8 mt-12 border-t border-white/10">
        <p class="text-sm mb-1">Powered by Multi-Tenant DDD Architecture</p>
        <p class="text-xs text-white/50">v1.0.0-dev • {{ currentYear }}</p>
      </footer>

    </div>
  `,
  styles: []
})
export class LandingComponent {
  currentYear = new Date().getFullYear();

  constructor(private router: Router) {}

  navigateToLogin(): void {
    console.log('Navigating to login...');
    this.router.navigate(['/login']).then(
      success => console.log('Navigation success:', success),
      error => console.error('Navigation error:', error)
    );
  }

  learnMore(): void {
    console.log('Learn more clicked');
    // TODO: Navigate to about/info page when implemented
    this.router.navigate(['/login']).then(
      success => console.log('Navigation success:', success),
      error => console.error('Navigation error:', error)
    );
  }
}
