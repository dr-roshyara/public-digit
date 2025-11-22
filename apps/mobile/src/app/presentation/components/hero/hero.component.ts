import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Hero Component
 * Main landing section with mobile app preview
 * Responsive design with gradient background
 */
@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="hero-section">
      <div class="container">
        <div class="hero-content">
          <h1 class="hero-title">Building Trust in Democratic Institutions</h1>
          <p class="hero-subtitle">
            A secure platform for political parties and NGOs to engage members,
            ensure transparency, and strengthen democratic processes worldwide.
          </p>
          <div class="hero-actions">
            <button class="btn btn-secondary hero-cta">Start Your Digital Transformation</button>
            <button class="btn btn-outline">Learn More</button>
          </div>
        </div>

        <!-- Mobile app preview -->
        <div class="mobile-preview">
          <div class="phone-mockup">
            <div class="phone-screen">
              <div class="app-screen">
                <div class="app-header">Public Digit</div>
                <div class="app-content">
                  <div class="stats-grid">
                    <div class="stat-card">
                      <div class="stat-number">312</div>
                      <div class="stat-label">Parties</div>
                    </div>
                    <div class="stat-card">
                      <div class="stat-number">2.1K</div>
                      <div class="stat-label">NGOs</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styleUrls: ['./hero.component.scss']
})
export class HeroComponent { }