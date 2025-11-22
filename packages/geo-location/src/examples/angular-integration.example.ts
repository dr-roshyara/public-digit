/**
 * Angular Integration Example
 *
 * This example shows how to integrate the geo-location package in an Angular application
 */

import { Injectable, OnInit, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';

// Import from shared geo-location package
import {
  UnifiedGeoLocationFacade,
  GeoFacadeFactoryService,
  GeoTranslationBridgeService,
  CountryDetectionService
} from '../index';

@Injectable({ providedIn: 'root' })
export class GeoLocationIntegrationService implements OnInit, OnDestroy {
  private geoFacade!: UnifiedGeoLocationFacade;
  private translationBridge!: GeoTranslationBridgeService;
  private subscriptions: Subscription[] = [];

  private readonly _currentLanguage = new BehaviorSubject<string>('en');

  constructor() {
    this.initializeGeoLocation();
  }

  ngOnInit(): void {
    this.initializeAutomaticLanguageDetection();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // ======== PUBLIC API ========

  /** Current language observable */
  get currentLanguage$(): Observable<string> {
    return this._currentLanguage.asObservable();
  }

  /**
   * Initialize automatic language detection
   */
  initializeAutomaticLanguageDetection(): void {
    const detectionSub = this.translationBridge.initializeAutomaticLanguageDetection()
      .subscribe(locale => {
        console.log(`Auto-detected language: ${locale}`);
        this._currentLanguage.next(locale);
      });

    this.subscriptions.push(detectionSub);
  }

  /**
   * Manually set language preference
   */
  setLanguagePreference(languageCode: string): void {
    const setSub = this.translationBridge.setLanguagePreference(languageCode)
      .subscribe(success => {
        if (success) {
          console.log(`Language preference set to: ${languageCode}`);
          this._currentLanguage.next(languageCode);
        }
      });

    this.subscriptions.push(setSub);
  }

  /**
   * Get current country code
   */
  getCurrentCountry(): Observable<string | null> {
    return this.geoFacade.countryCode$.pipe(
      map(countryCode => countryCode?.toString() || null)
    );
  }

  /**
   * Check if auto-detection is active
   */
  isAutoDetectionActive(): Observable<boolean> {
    return this.translationBridge.shouldAutoDetectOverride();
  }

  // ======== PRIVATE METHODS ========

  private initializeGeoLocation(): void {
    // Create services using factory
    const countryDetectionService = GeoFacadeFactoryService.createCountryDetectionService();

    // Note: In a real Angular app, you would inject the existing geo facade
    // For this example, we'll create a mock or use the factory
    const existingGeoFacade = {} as any; // This would be properly injected

    this.geoFacade = GeoFacadeFactoryService.createForAngular(
      existingGeoFacade,
      countryDetectionService
    );

    this.translationBridge = new GeoTranslationBridgeService(this.geoFacade);

    // Subscribe to locale changes
    const localeSub = this.geoFacade.currentLocale$
      .subscribe(locale => {
        console.log(`Locale changed to: ${locale}`);
      });

    this.subscriptions.push(localeSub);
  }
}

// Example usage in an Angular component
@Component({
  selector: 'app-language-selector',
  template: `
    <div class="language-selector">
      <span>Current Language: {{ currentLanguage$ | async }}</span>

      <button (click)="setLanguage('en')">English</button>
      <button (click)="setLanguage('de')">German</button>
      <button (click)="setLanguage('np')">Nepali</button>

      <button (click)="enableAutoDetection()" *ngIf="!(isAutoDetectionActive$ | async)">
        Enable Auto-Detection
      </button>
    </div>
  `
})
export class LanguageSelectorComponent {
  currentLanguage$ = this.geoService.currentLanguage$;
  isAutoDetectionActive$ = this.geoService.isAutoDetectionActive();

  constructor(private geoService: GeoLocationIntegrationService) {}

  setLanguage(languageCode: string): void {
    this.geoService.setLanguagePreference(languageCode);
  }

  enableAutoDetection(): void {
    this.geoService.initializeAutomaticLanguageDetection();
  }
}