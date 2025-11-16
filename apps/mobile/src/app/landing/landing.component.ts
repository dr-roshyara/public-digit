import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="landing-container">
      <!-- Hero Section -->
      <div class="hero-section">
        <div class="logo-container">
          <svg class="logo-icon" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h1 class="main-title">PublicDigit</h1>
        <p class="subtitle">Secure Digital Election Platform</p>

        <div class="features-grid">
          <div class="feature-card">
            <svg class="feature-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h3>Secure Voting</h3>
            <p>End-to-end encrypted voting system</p>
          </div>

          <div class="feature-card">
            <svg class="feature-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <h3>Transparent</h3>
            <p>Real-time election monitoring</p>
          </div>

          <div class="feature-card">
            <svg class="feature-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3>Fast Results</h3>
            <p>Instant vote counting and reporting</p>
          </div>
        </div>

        <div class="cta-buttons">
          <button class="btn btn-primary" (click)="navigateToLogin()">
            <svg class="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            Sign In
          </button>

          <button class="btn btn-secondary" (click)="learnMore()">
            <svg class="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Learn More
          </button>
        </div>
      </div>

      <!-- Footer -->
      <div class="footer">
        <p>Powered by Multi-Tenant DDD Architecture</p>
        <p class="version">v1.0.0-dev</p>
      </div>
    </div>
  `,
  styles: [`
    .landing-container {
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 2rem 1rem;
    }

    .hero-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      color: white;
    }

    .logo-container {
      margin-bottom: 2rem;
    }

    .logo-icon {
      width: 80px;
      height: 80px;
      color: rgba(255, 255, 255, 0.9);
      filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1));
    }

    .main-title {
      font-size: 3rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      color: white;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .subtitle {
      font-size: 1.25rem;
      color: rgba(255, 255, 255, 0.9);
      margin-bottom: 3rem;
      font-weight: 300;
    }

    .features-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.5rem;
      max-width: 1200px;
      width: 100%;
      margin-bottom: 3rem;
      padding: 0 1rem;
    }

    @media (min-width: 768px) {
      .features-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    .feature-card {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 1rem;
      padding: 2rem;
      border: 1px solid rgba(255, 255, 255, 0.2);
      transition: transform 0.3s ease, background 0.3s ease;
    }

    .feature-card:hover {
      transform: translateY(-5px);
      background: rgba(255, 255, 255, 0.15);
    }

    .feature-icon {
      width: 48px;
      height: 48px;
      margin: 0 auto 1rem;
      color: rgba(255, 255, 255, 0.9);
    }

    .feature-card h3 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: white;
    }

    .feature-card p {
      font-size: 0.95rem;
      color: rgba(255, 255, 255, 0.8);
      line-height: 1.5;
    }

    .cta-buttons {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
      justify-content: center;
      margin-top: 2rem;
    }

    .btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.875rem 2rem;
      border-radius: 0.75rem;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s ease;
      border: none;
      min-width: 150px;
      justify-content: center;
    }

    .btn-icon {
      width: 20px;
      height: 20px;
    }

    .btn-primary {
      background: rgba(255, 255, 255, 0.95);
      color: #667eea;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .btn-primary:hover {
      background: white;
      transform: translateY(-2px);
      box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.1);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.3);
      backdrop-filter: blur(10px);
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.2);
      transform: translateY(-2px);
    }

    .footer {
      text-align: center;
      color: rgba(255, 255, 255, 0.7);
      padding: 1rem 0;
      margin-top: 3rem;
    }

    .footer p {
      margin: 0.25rem 0;
      font-size: 0.875rem;
    }

    .version {
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.5);
    }

    @media (max-width: 640px) {
      .main-title {
        font-size: 2rem;
      }

      .subtitle {
        font-size: 1rem;
      }

      .cta-buttons {
        flex-direction: column;
        width: 100%;
        max-width: 300px;
      }

      .btn {
        width: 100%;
      }
    }
  `]
})
export class LandingComponent {
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
    this.router.navigate(['/login']).then(
      success => console.log('Navigation success:', success),
      error => console.error('Navigation error:', error)
    );
  }
}
