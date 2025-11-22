import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Feature {
  icon: string;
  title: string;
  description: string;
  color: string;
}

/**
 * Features Component
 * Grid layout showcasing platform features
 * Mobile-optimized with hover effects
 */
@Component({
  selector: 'app-features',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="features-section">
      <div class="container">
        <h2 class="section-title">Why Choose Public Digit?</h2>
        <p class="section-subtitle">
          Designed specifically for the unique needs of political organizations and NGOs
        </p>

        <div class="features-grid">
          <div class="feature-card" *ngFor="let feature of features"
               [style.border-color]="feature.color">
            <div class="feature-icon" [style.background]="feature.color">
              {{feature.icon}}
            </div>
            <h3 class="feature-title">{{feature.title}}</h3>
            <p class="feature-description">{{feature.description}}</p>
          </div>
        </div>
      </div>
    </section>
  `,
  styleUrls: ['./features.component.scss']
})
export class FeaturesComponent {
  features: Feature[] = [
    {
      icon: '🔒',
      title: 'Secure & Compliant',
      description: 'Enterprise-grade security meeting political compliance standards with end-to-end encryption.',
      color: 'var(--color-primary)'
    },
    {
      icon: '🌍',
      title: 'Global Reach',
      description: 'Support for multiple languages, currencies, and political systems across borders.',
      color: 'var(--color-secondary)'
    },
    {
      icon: '📊',
      title: 'Advanced Analytics',
      description: 'Deep insights into member engagement and campaign performance for data-driven decisions.',
      color: 'var(--color-accent)'
    },
    {
      icon: '🤝',
      title: 'Member Engagement',
      description: 'Tools to actively engage members, coordinate events, and build strong communities.',
      color: 'var(--color-info)'
    }
  ];
}