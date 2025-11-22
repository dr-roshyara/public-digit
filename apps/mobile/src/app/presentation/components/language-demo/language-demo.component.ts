// Demonstration Component for Route-First Translation System
// apps/mobile/src/app/presentation/components/language-demo/language-demo.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { EnhancedTranslationService } from '@core/services/enhanced-translation.service';
import { TranslatePipe } from '@core/pipes/translate.pipe';
import { TranslateSyncPipe } from '@core/pipes/translate-sync.pipe';

@Component({
  selector: 'app-language-demo',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe],
  template: `
    <div class="language-demo">
      <h1>{{ 'components.header.title' | translate }}</h1>

      <div class="language-selector">
        <h3>{{ 'common.selectLanguage' | translate }}</h3>
        <div class="language-buttons">
          <button
            *ngFor="let lang of availableLanguages"
            [class.active]="lang.code === currentLanguage"
            (click)="changeLanguage(lang.code)"
            class="language-button"
          >
            <span class="flag">{{ lang.flag }}</span>
            <span class="name">{{ lang.name }}</span>
          </button>
        </div>
      </div>

      <div class="translation-examples">
        <h3>{{ 'common.translationExamples' | translate }}</h3>

        <div class="example-section">
          <h4>{{ 'common.coreTranslations' | translate }}</h4>
          <ul>
            <li>{{ 'common.loading' | translate }}</li>
            <li>{{ 'common.error' | translate }}</li>
            <li>{{ 'common.success' | translate }}</li>
          </ul>
        </div>

        <div class="example-section">
          <h4>{{ 'common.authTranslations' | translate }}</h4>
          <ul>
            <li>{{ 'pages.auth.login.title' | translate }}</li>
            <li>{{ 'pages.auth.login.email' | translate }}</li>
            <li>{{ 'pages.auth.login.password' | translate }}</li>
          </ul>
        </div>

        <div class="example-section">
          <h4>{{ 'common.dashboardTranslations' | translate }}</h4>
          <ul>
            <li>{{ 'pages.dashboard.welcome' | translate }}</li>
            <li>{{ 'pages.dashboard.stats' | translate }}</li>
            <li>{{ 'pages.dashboard.recentActivity' | translate }}</li>
          </ul>
        </div>

        <div class="example-section">
          <h4>{{ 'common.parameterizedTranslations' | translate }}</h4>
          <p>{{ 'common.welcomeMessage' | translate: { name: 'John', organization: 'NRNA' } }}</p>
          <p>{{ 'common.electionCount' | translate: { count: 5 } }}</p>
        </div>
      </div>

      <div class="route-info">
        <h3>{{ 'common.routeInfo' | translate }}</h3>
        <p>{{ 'common.currentRoute' | translate }}: {{ currentRoute }}</p>
        <p>{{ 'common.translationPath' | translate }}: {{ translationPath }}</p>
        <button (click)="loadRouteTranslations()" class="load-button">
          {{ 'buttons.loadRouteTranslations' | translate }}
        </button>
      </div>

      <div class="cache-info">
        <h3>{{ 'common.cacheInfo' | translate }}</h3>
        <p>{{ 'common.currentLanguage' | translate }}: {{ currentLanguage }}</p>
        <button (click)="clearCache()" class="clear-button">
          {{ 'buttons.clearCache' | translate }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .language-demo {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      font-family: Arial, sans-serif;
    }

    .language-selector {
      margin: 20px 0;
      padding: 20px;
      border: 1px solid #ddd;
      border-radius: 8px;
    }

    .language-buttons {
      display: flex;
      gap: 10px;
      margin-top: 10px;
    }

    .language-button {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      border: 2px solid #e0e0e0;
      border-radius: 6px;
      background: white;
      cursor: pointer;
      transition: all 0.2s;
    }

    .language-button:hover {
      border-color: #007bff;
    }

    .language-button.active {
      border-color: #007bff;
      background: #007bff;
      color: white;
    }

    .flag {
      font-size: 1.2em;
    }

    .translation-examples {
      margin: 20px 0;
      padding: 20px;
      border: 1px solid #ddd;
      border-radius: 8px;
    }

    .example-section {
      margin: 15px 0;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 6px;
    }

    .example-section h4 {
      margin: 0 0 10px 0;
      color: #495057;
    }

    .example-section ul {
      margin: 0;
      padding-left: 20px;
    }

    .route-info, .cache-info {
      margin: 20px 0;
      padding: 20px;
      border: 1px solid #ddd;
      border-radius: 8px;
    }

    .load-button, .clear-button {
      padding: 8px 16px;
      margin-top: 10px;
      border: 1px solid #dc3545;
      border-radius: 4px;
      background: #dc3545;
      color: white;
      cursor: pointer;
    }

    .load-button {
      border-color: #007bff;
      background: #007bff;
    }
  `]
})
export class LanguageDemoComponent implements OnInit {
  private translationService = inject(EnhancedTranslationService);

  availableLanguages: readonly any[] = [];
  currentLanguage = 'en';
  currentRoute = window.location.pathname;
  translationPath = '';

  ngOnInit() {
    this.availableLanguages = this.translationService.getAvailableLanguages();
    this.currentLanguage = this.translationService.getCurrentLanguage();

    // Subscribe to language changes
    this.translationService.currentLanguage.subscribe(language => {
      this.currentLanguage = language;
    });

    // Calculate translation path for current route
    this.calculateTranslationPath();
  }

  async changeLanguage(language: string) {
    await this.translationService.setLanguage(language);
  }

  async loadRouteTranslations() {
    await this.translationService.loadRouteTranslations(this.currentRoute);
  }

  clearCache() {
    this.translationService.clearCache();
    console.log('Translation cache cleared');
  }

  private calculateTranslationPath() {
    // This would use the route normalization logic
    // For demonstration, we'll show a simplified version
    const route = this.currentRoute.replace(/^\/|\/$/g, '') || 'home';
    this.translationPath = `pages/${route}/${this.currentLanguage}.json`;
  }
}