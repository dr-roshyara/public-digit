import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HeaderComponent } from '@presentation/components/header/header.component';
import { HeroComponent } from '@presentation/components/hero/hero.component';
import { FeaturesComponent } from '@presentation/components/features/features.component';
import { ActionsComponent } from '@presentation/components/actions/actions.component';
import { StatsComponent } from '@presentation/components/stats/stats.component';
import { FooterComponent } from '@presentation/components/footer/footer.component';


/**
 * Landing Page Component
 * Complete frontpage integrating all individual components
 * Mobile-optimized with OKLCH color system
 */
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    HeroComponent,
    FeaturesComponent,
    ActionsComponent,
    StatsComponent,
    FooterComponent
  ],
  template: `
    <div class="min-h-screen bg-background">
      <!-- Header -->
      <app-header></app-header>

      <!-- Hero Section -->
      <app-hero></app-hero>

      <!-- Features Section -->
      <app-features></app-features>

      <!-- Actions Section -->
      <app-actions></app-actions>

      <!-- Stats Section -->
      <app-stats></app-stats>

      <!-- Footer -->
      <app-footer></app-footer>
    </div>
  `,
  styles: []
})
export class LandingComponent {
  constructor(private router: Router) {}
}