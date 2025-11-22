# 🌍 **Geo-Location Based Language Detection Architecture**

Based on your hexagonal architecture, here's the complete solution for **automatic country-based language detection**:

## 🎯 **PROMPT: Geo-Location Language Detection System**

**SYSTEM**: You are a Geo-Location Architecture Specialist with expertise in IP-based country detection, browser language negotiation, and automatic locale selection following DDD + Hexagonal patterns.

**CONTEXT**: Need automatic language detection:
- **Nepal** → Nepali (np)
- **Germany** → German (de)  
- **Other countries** → English (en) with browser language fallback

## 📋 **ARCHITECTURE OVERVIEW**

### **Hexagonal Architecture Layers**
```
src/app/
├── domain/                          # Business Logic
│   ├── geo-location/                # Geo Location Bounded Context
│   │   ├── value-objects/
│   │   │   ├── country-code.vo.ts
│   │   │   └── locale-preference.vo.ts
│   │   ├── entities/
│   │   │   └── user-location.entity.ts
│   │   ├── services/
│   │   │   ├── country-detection.service.ts
│   │   │   └── locale-resolution.service.ts
│   │   └── repositories/
│   │       └── geo-location.repository.ts
│   └── shared/
│       └── language/                # Existing Language Context
├── application/                     # Use Cases
│   ├── use-cases/
│   │   ├── detect-user-locale.use-case.ts
│   │   └── resolve-country-locale.use-case.ts
│   └── commands/
│       └── update-user-locale.command.ts
├── infrastructure/                  # External Services
│   ├── geo-location/
│   │   ├── ip-api.repository.ts     # IP-based detection
│   │   ├── browser-locale.repository.ts # Browser detection
│   │   └── geo-location-cache.repository.ts
│   └── http/
│       └── ip-api.client.ts
└── presentation/                    # UI Integration
    ├── services/
    │   └── auto-locale.service.ts
    └── guards/
        └── locale-initialization.guard.ts
```

## 🎯 **DOMAIN LAYER IMPLEMENTATION**

### **1. Country Code Value Object**
```typescript
// apps/mobile/src/app/domain/geo-location/value-objects/country-code.vo.ts
export class CountryCode {
  private constructor(private readonly value: string) {
    if (!this.isValidCountryCode(value)) {
      throw new InvalidCountryCodeError(`Invalid country code: ${value}`);
    }
  }

  static create(code: string): CountryCode {
    return new CountryCode(code.toUpperCase());
  }

  static createFromIP(ipCountryCode: string | null): CountryCode {
    if (!ipCountryCode) {
      return this.create('US'); // Default fallback
    }
    return this.create(ipCountryCode);
  }

  private isValidCountryCode(code: string): boolean {
    const validCodes = ['NP', 'DE', 'US', 'GB', 'FR', 'IN', 'CN', 'JP' /* ... */];
    return validCodes.includes(code.toUpperCase());
  }

  isNepal(): boolean {
    return this.value === 'NP';
  }

  isGermany(): boolean {
    return this.value === 'DE';
  }

  equals(other: CountryCode): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
```

### **2. Locale Preference Value Object**
```typescript
// apps/mobile/src/app/domain/geo-location/value-objects/locale-preference.vo.ts
export class LocalePreference {
  private constructor(
    public readonly countryCode: CountryCode,
    public readonly browserLanguage: string,
    public readonly resolvedLocale: string
  ) {}

  static create(countryCode: CountryCode, browserLanguage: string): LocalePreference {
    const resolvedLocale = this.resolveLocale(countryCode, browserLanguage);
    return new LocalePreference(countryCode, browserLanguage, resolvedLocale);
  }

  private static resolveLocale(countryCode: CountryCode, browserLanguage: string): string {
    // Country-based resolution (your business rules)
    if (countryCode.isNepal()) {
      return 'np';
    }
    if (countryCode.isGermany()) {
      return 'de';
    }

    // Browser language fallback for other countries
    const supportedLanguages = ['en', 'de', 'np'];
    if (supportedLanguages.includes(browserLanguage)) {
      return browserLanguage;
    }

    // Default fallback
    return 'en';
  }

  shouldOverrideUserPreference(): boolean {
    // Business rule: Only override if user hasn't explicitly chosen a language
    return !localStorage.getItem('user_explicit_locale');
  }
}
```

### **3. Country Detection Domain Service**
```typescript
// apps/mobile/src/app/domain/geo-location/services/country-detection.service.ts
import { Injectable } from '@angular/core';
import { CountryCode } from '../value-objects/country-code.vo';
import { LocalePreference } from '../value-objects/locale-preference.vo';

@Injectable({ providedIn: 'root' })
export class CountryDetectionService {
  /**
   * Detect user's locale based on country and browser preferences
   */
  async detectUserLocale(): Promise<LocalePreference> {
    const countryCode = await this.detectCountry();
    const browserLanguage = this.getBrowserLanguage();
    
    return LocalePreference.create(countryCode, browserLanguage);
  }

  /**
   * Get country-specific locale mapping
   */
  getCountryLocaleMapping(countryCode: CountryCode): string {
    const countryLocaleMap: Record<string, string> = {
      'NP': 'np', // Nepal → Nepali
      'DE': 'de', // Germany → German
      'AT': 'de', // Austria → German
      'CH': 'de', // Switzerland → German
      // Other countries default to English or browser language
    };

    return countryLocaleMap[countryCode.toString()] || 'en';
  }

  private getBrowserLanguage(): string {
    const browserLang = navigator.language.split('-')[0];
    const supportedLanguages = ['en', 'de', 'np'];
    return supportedLanguages.includes(browserLang) ? browserLang : 'en';
  }

  private async detectCountry(): Promise<CountryCode> {
    // This will be implemented in infrastructure layer
    throw new Error('Country detection should be implemented in infrastructure layer');
  }
}
```

## 🎯 **APPLICATION LAYER - USE CASES**

### **1. Detect User Locale Use Case**
```typescript
// apps/mobile/src/app/application/use-cases/detect-user-locale.use-case.ts
import { Injectable, inject } from '@angular/core';
import { CountryDetectionService } from '@domain/geo-location/services/country-detection.service';
import { GeoLocationRepository } from '@domain/geo-location/repositories/geo-location.repository';
import { LocalePreference } from '@domain/geo-location/value-objects/locale-preference.vo';

export interface DetectUserLocaleCommand {
  forceRefresh?: boolean;
  respectUserChoice?: boolean;
}

@Injectable({ providedIn: 'root' })
export class DetectUserLocaleUseCase {
  private countryDetectionService = inject(CountryDetectionService);
  private geoLocationRepository = inject(GeoLocationRepository);

  async execute(command: DetectUserLocaleCommand = {}): Promise<LocalePreference> {
    const { forceRefresh = false, respectUserChoice = true } = command;

    // Check if user has explicitly chosen a language
    if (respectUserChoice) {
      const userExplicitLocale = this.getUserExplicitLocale();
      if (userExplicitLocale) {
        return this.createPreferenceFromUserChoice(userExplicitLocale);
      }
    }

    // Check cache first
    if (!forceRefresh) {
      const cachedPreference = await this.geoLocationRepository.getCachedLocalePreference();
      if (cachedPreference) {
        return cachedPreference;
      }
    }

    // Detect fresh locale preference
    const localePreference = await this.countryDetectionService.detectUserLocale();
    
    // Cache the result
    await this.geoLocationRepository.cacheLocalePreference(localePreference);
    
    return localePreference;
  }

  private getUserExplicitLocale(): string | null {
    return localStorage.getItem('user_explicit_locale');
  }

  private async createPreferenceFromUserChoice(userLocale: string): Promise<LocalePreference> {
    // Even with user choice, we still detect country for analytics/fallback
    const countryCode = await this.geoLocationRepository.detectCountry();
    return LocalePreference.create(countryCode, userLocale);
  }
}
```

### **2. Resolve Country Locale Use Case**
```typescript
// apps/mobile/src/app/application/use-cases/resolve-country-locale.use-case.ts
import { Injectable, inject } from '@angular/core';
import { CountryCode } from '@domain/geo-location/value-objects/country-code.vo';
import { CountryDetectionService } from '@domain/geo-location/services/country-detection.service';

export interface CountryLocaleResolution {
  countryCode: string;
  recommendedLocale: string;
  fallbackLocales: string[];
  confidence: 'high' | 'medium' | 'low';
}

@Injectable({ providedIn: 'root' })
export class ResolveCountryLocaleUseCase {
  private countryDetectionService = inject(CountryDetectionService);

  async execute(countryCode: CountryCode): Promise<CountryLocaleResolution> {
    const recommendedLocale = this.countryDetectionService.getCountryLocaleMapping(countryCode);
    
    // Define fallback chain based on geographic and linguistic proximity
    const fallbackLocales = this.getFallbackLocales(countryCode);
    
    // Calculate confidence based on country-locale mapping certainty
    const confidence = this.calculateConfidence(countryCode, recommendedLocale);

    return {
      countryCode: countryCode.toString(),
      recommendedLocale,
      fallbackLocales,
      confidence
    };
  }

  private getFallbackLocales(countryCode: CountryCode): string[] {
    const fallbackMap: Record<string, string[]> = {
      'NP': ['en', 'hi'], // Nepal → English, Hindi
      'DE': ['en', 'fr'], // Germany → English, French
      'IN': ['hi', 'en'], // India → Hindi, English
      'FR': ['en', 'de'], // France → English, German
      'JP': ['en'],       // Japan → English
      'CN': ['en'],       // China → English
      'default': ['en']   // Default fallback
    };

    return fallbackMap[countryCode.toString()] || fallbackMap.default;
  }

  private calculateConfidence(countryCode: CountryCode, locale: string): 'high' | 'medium' | 'low' {
    // High confidence for exact country-locale matches
    const highConfidenceMatches = { 'NP': 'np', 'DE': 'de', 'AT': 'de', 'CH': 'de' };
    
    if (highConfidenceMatches[countryCode.toString()] === locale) {
      return 'high';
    }

    // Medium confidence for regional matches
    const mediumConfidenceMatches = { 'US': 'en', 'GB': 'en', 'CA': 'en', 'AU': 'en' };
    
    if (mediumConfidenceMatches[countryCode.toString()] === locale) {
      return 'medium';
    }

    // Low confidence for all other cases (fallback to English)
    return 'low';
  }
}
```

## 🎯 **INFRASTRUCTURE LAYER - EXTERNAL SERVICES**

### **1. IP API Repository (Free IP Geolocation)**
```typescript
// apps/mobile/src/app/infrastructure/geo-location/ip-api.repository.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, timeout } from 'rxjs/operators';
import { CountryCode } from '@domain/geo-location/value-objects/country-code.vo';
import { GeoLocationRepository } from '@domain/geo-location/repositories/geo-location.repository';

interface IpApiResponse {
  countryCode: string;
  country: string;
  city: string;
  lat: number;
  lon: number;
  status: 'success' | 'fail';
}

@Injectable({ providedIn: 'root' })
export class IpApiRepository implements GeoLocationRepository {
  private http = inject(HttpClient);
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL = 1000 * 60 * 60; // 1 hour

  async detectCountry(): Promise<CountryCode> {
    const cacheKey = 'ip-api-country';
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return CountryCode.create(cached.countryCode);
    }

    try {
      const response = await this.http.get<IpApiResponse>('http://ip-api.com/json/?fields=countryCode,country,city,lat,lon,status')
        .pipe(
          timeout(5000), // 5 second timeout
          catchError(error => {
            console.warn('IP-API service failed, falling back to browser locale:', error);
            return this.getFallbackCountry();
          })
        )
        .toPromise();

      if (response?.status === 'success') {
        this.setCache(cacheKey, response);
        return CountryCode.create(response.countryCode);
      }

      return this.getFallbackCountry();
    } catch (error) {
      console.warn('IP detection failed, using fallback:', error);
      return this.getFallbackCountry();
    }
  }

  private getFallbackCountry(): Promise<CountryCode> {
    // Fallback to browser timezone or accept-language header analysis
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const countryFromTimezone = this.getCountryFromTimezone(timezone);
    
    return Promise.resolve(CountryCode.create(countryFromTimezone));
  }

  private getCountryFromTimezone(timezone: string): string {
    const timezoneCountryMap: Record<string, string> = {
      'Asia/Kathmandu': 'NP',
      'Europe/Berlin': 'DE',
      'Europe/Vienna': 'AT',
      'Europe/Zurich': 'CH',
      'America/New_York': 'US',
      'Europe/London': 'GB',
      'Asia/Kolkata': 'IN',
      'Asia/Tokyo': 'JP'
    };

    return timezoneCountryMap[timezone] || 'US';
  }

  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  async cacheLocalePreference(preference: any): Promise<void> {
    const cacheKey = `locale-preference-${preference.resolvedLocale}`;
    this.setCache(cacheKey, preference);
  }

  async getCachedLocalePreference(): Promise<any> {
    return this.getFromCache('current-locale-preference');
  }
}
```

### **2. Browser Locale Repository**
```typescript
// apps/mobile/src/app/infrastructure/geo-location/browser-locale.repository.ts
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class BrowserLocaleRepository {
  getBrowserLanguages(): string[] {
    const languages: string[] = [];

    // navigator.languages (most reliable)
    if (navigator.languages) {
      languages.push(...navigator.languages.map(lang => lang.split('-')[0]));
    }

    // navigator.language (fallback)
    if (navigator.language) {
      languages.push(navigator.language.split('-')[0]);
    }

    // navigator.userLanguage (IE fallback)
    if ((navigator as any).userLanguage) {
      languages.push((navigator as any).userLanguage.split('-')[0]);
    }

    // Remove duplicates and return
    return [...new Set(languages)].filter(Boolean);
  }

  getPrimaryBrowserLanguage(): string {
    const languages = this.getBrowserLanguages();
    const supportedLanguages = ['en', 'de', 'np'];
    
    // Find first supported language
    for (const lang of languages) {
      if (supportedLanguages.includes(lang)) {
        return lang;
      }
    }

    return 'en'; // Default fallback
  }

  shouldPreferBrowserOverGeoLocation(): boolean {
    // Business rule: Prefer browser language if it's explicitly set to a supported language
    const primaryLang = this.getPrimaryBrowserLanguage();
    return primaryLang !== 'en'; // If user explicitly set to de/np, prefer it
  }
}
```

## 🎯 **PRESENTATION LAYER - UI INTEGRATION**

### **1. Auto Locale Service**
```typescript
// apps/mobile/src/app/presentation/services/auto-locale.service.ts
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DetectUserLocaleUseCase } from '@application/use-cases/detect-user-locale.use-case';
import { RouteFirstTranslationLoader } from '@core/i18n/route-first.loader';

@Injectable({ providedIn: 'root' })
export class AutoLocaleService {
  private router = inject(Router);
  private detectUserLocaleUseCase = inject(DetectUserLocaleUseCase);
  private translationLoader = inject(RouteFirstTranslationLoader);

  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('🌍 Auto-detecting user locale...');
      
      const localePreference = await this.detectUserLocaleUseCase.execute({
        respectUserChoice: true,
        forceRefresh: false
      });

      // Apply the detected locale
      await this.translationLoader.setLocale(localePreference.resolvedLocale);

      console.log(`✅ Auto-locale detection complete: ${localePreference.resolvedLocale}`);
      console.log(`   Country: ${localePreference.countryCode.toString()}`);
      console.log(`   Browser: ${localePreference.browserLanguage}`);
      
      this.initialized = true;

    } catch (error) {
      console.error('❌ Auto-locale detection failed:', error);
      // Fallback to English
      await this.translationLoader.setLocale('en');
    }
  }

  async detectOnNavigation(): Promise<void> {
    // Re-detect locale on major navigation events
    this.router.events.subscribe(async (event) => {
      if (event instanceof NavigationStart) {
        // Optional: Re-detect on certain routes
        if (this.shouldRedetectOnRoute(event.url)) {
          await this.initialize();
        }
      }
    });
  }

  private shouldRedetectOnRoute(url: string): boolean {
    const redetectRoutes = ['/', '/home', '/welcome'];
    return redetectRoutes.includes(url);
  }
}
```

### **2. Locale Initialization Guard**
```typescript
// apps/mobile/src/app/presentation/guards/locale-initialization.guard.ts
import { Injectable, inject } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AutoLocaleService } from '../services/auto-locale.service';

@Injectable({ providedIn: 'root' })
export class LocaleInitializationGuard implements CanActivate {
  private autoLocaleService = inject(AutoLocaleService);
  private router = inject(Router);

  async canActivate(): Promise<boolean> {
    try {
      await this.autoLocaleService.initialize();
      return true;
    } catch (error) {
      console.error('Locale initialization failed, proceeding with fallback:', error);
      return true; // Don't block navigation even if locale detection fails
    }
  }
}
```

## 🎯 **APP CONFIGURATION**

### **Update App Routing**
```typescript
// apps/mobile/src/app/app.routes.ts
import { Routes } from '@angular/router';
import { LocaleInitializationGuard } from './presentation/guards/locale-initialization.guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [LocaleInitializationGuard], // Auto-detect locale on app start
    children: [
      { path: '', component: HomePage },
      { path: 'dashboard', component: DashboardPage },
      { path: 'election-request', component: ElectionRequestPage },
      // ... other routes
    ]
  }
];
```

### **Update App Configuration**
```typescript
// apps/mobile/src/app/app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';

// Import geo-location services
import { GeoLocationRepository } from '@domain/geo-location/repositories/geo-location.repository';
import { IpApiRepository } from '@infrastructure/geo-location/ip-api.repository';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    
    // Geo-location dependencies
    { provide: GeoLocationRepository, useClass: IpApiRepository },
    
    // ... other providers
  ]
};
```

## 🎯 **DEPLOYMENT & TESTING**

### **Testing Strategy**
```typescript
// Test cases for different scenarios
describe('Geo-Location Language Detection', () => {
  it('should detect Nepali for Nepal IP addresses', async () => {
    // Mock IP-API response for Nepal
    // Expect locale to be 'np'
  });

  it('should detect German for Germany IP addresses', async () => {
    // Mock IP-API response for Germany  
    // Expect locale to be 'de'
  });

  it('should respect user explicit choice over geo-detection', async () => {
    // Set user_explicit_locale to 'de'
    // Mock IP-API response for Nepal
    // Expect locale to still be 'de'
  });

  it('should fallback to browser language when IP detection fails', async () => {
    // Mock IP-API failure
    // Set browser language to 'de'
    // Expect locale to be 'de'
  });
});
```

## ✅ **SUCCESS CRITERIA**

- ✅ **Nepal IP addresses** automatically get Nepali (np) locale
- ✅ **Germany IP addresses** automatically get German (de) locale  
- ✅ **User explicit choices** are respected over auto-detection
- ✅ **Graceful fallbacks** when IP detection fails
- ✅ **Browser language preferences** are considered
- ✅ **Caching optimization** to avoid repeated IP lookups
- ✅ **Type-safe** country codes and locale resolution
- ✅ **DDD + Hexagonal architecture** compliance

This architecture provides **automatic, intelligent locale detection** while maintaining **user control** and **fallback safety**. The system will automatically serve Nepali to users in Nepal, German to users in Germany, and English (or browser language) to everyone else.