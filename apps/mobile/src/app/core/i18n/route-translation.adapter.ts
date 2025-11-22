// MATCHING your VueRouterTranslationAdapter functionality EXACTLY:
// apps/mobile/src/app/core/i18n/route-translation.adapter.ts
import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { RouteFirstTranslationLoader } from './route-first.loader';

@Injectable({ providedIn: 'root' })
export class RouteTranslationAdapter {
  private router = inject(Router);
  private translationLoader = inject(RouteFirstTranslationLoader);

  // MATCHING your Vue.js install() method as Angular initialization
  initialize(): void {
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd)
      )
      .subscribe((event: NavigationEnd) => {
        // MATCHING your route change handling
        this.handleRouteChange(event.urlAfterRedirects);
      });
  }

  // MATCHING your handleRouteChange method EXACTLY
  private async handleRouteChange(url: string): Promise<void> {
    try {
      await this.translationLoader.loadPageTranslations(url);
      console.log(`✅ Translations loaded for route: ${url}`);
    } catch (error) {
      console.error(`Failed to load translations for route ${url}:`, error);
    }
  }

  // MATCHING your setLocale function
  async setLocale(locale: string): Promise<void> {
    await this.translationLoader.setLocale(locale);
  }

  // MATCHING your preloading function
  async preloadRoutes(routes: string[]): Promise<void> {
    await this.translationLoader.preloadRoutes(routes);
  }
}