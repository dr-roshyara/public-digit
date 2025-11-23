import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@presentation/pipes/translate.pipe';

/**
 * Hero Component
 * Main landing section with mobile app preview
 * Responsive design with gradient background
 */
@Component({
  selector: 'pd-hero',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <section class="hero-section">
      <div class="container">
        <div class="hero-content">
          <h1 class="hero-title">{{ 'home.hero.title' | translate }}</h1>
          <p class="hero-subtitle">
            {{ 'home.hero.subtitle' | translate }}
          </p>
          <div class="hero-actions">
            <button class="btn btn-secondary hero-cta">{{ 'home.hero.cta_primary' | translate }}</button>
            <button class="btn btn-outline">{{ 'home.hero.cta_secondary' | translate }}</button>
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