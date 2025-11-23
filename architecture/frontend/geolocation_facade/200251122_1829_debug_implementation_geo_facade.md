# 🔍 **CIRCULAR DEPENDENCY ROOT CAUSE IDENTIFIED**

I found the issue! The circular dependency is happening because:

## 🚨 **ROOT CAUSE**

**`AutoLocaleDetectionService` → `RouteFirstTranslationLoader` → (something) → `AutoLocaleDetectionService`**

The `RouteFirstTranslationLoader` is being injected in `AutoLocaleDetectionService`, but the translation loader might have dependencies that eventually reference back to the locale detection system.

## 🎯 **IMMEDIATE FIX COMMANDS**

```bash
# PHASE 1: CHECK THE TRANSLATION LOADER DEPENDENCIES
cat apps/mobile/src/app/core/i18n/route-first.loader.ts

# PHASE 2: BREAK THE CIRCULAR DEPENDENCY WITH MANUAL INITIALIZATION
cat > fix-circular-dependency-final.js << 'EOF'
const fs = require('fs');
const path = require('path');

console.log('🔧 Applying final circular dependency fix...');

// 1. Fix AutoLocaleDetectionService to avoid constructor injection of RouteFirstTranslationLoader
const servicePath = 'apps/mobile/src/app/application/services/auto-locale-detection.service.ts';
let serviceContent = fs.readFileSync(servicePath, 'utf8');

// Replace constructor injection with manual injector access
serviceContent = serviceContent.replace(
  /private translationLoader = inject\(RouteFirstTranslationLoader\);/, 
  'private injector = inject(Injector);\n  private translationLoader?: RouteFirstTranslationLoader;'
);

// Add getTranslationLoader method
if (!serviceContent.includes('getTranslationLoader()')) {
  const getLoaderMethod = `
  /**
   * Get translation loader (lazy initialization to break circular dependency)
   */
  private getTranslationLoader(): RouteFirstTranslationLoader {
    if (!this.translationLoader) {
      this.translationLoader = this.injector.get(RouteFirstTranslationLoader);
    }
    return this.translationLoader;
  }`;

  // Insert after other private methods
  const insertPoint = serviceContent.indexOf('private updateStatus(partial: Partial<LocaleDetectionStatus>): void');
  if (insertPoint !== -1) {
    serviceContent = serviceContent.slice(0, insertPoint) + getLoaderMethod + '\n\n  ' + serviceContent.slice(insertPoint);
  }
}

// Update all translationLoader calls
serviceContent = serviceContent.replace(
  /this\.translationLoader\./g,
  'this.getTranslationLoader().'
);

// Add Injector import
if (!serviceContent.includes('Injector')) {
  serviceContent = serviceContent.replace(
    "import { Injectable, inject } from '@angular/core';",
    "import { Injectable, inject, Injector } from '@angular/core';"
  );
}

fs.writeFileSync(servicePath, serviceContent);
console.log('✅ Fixed AutoLocaleDetectionService - lazy translation loader');

// 2. Update Facade to ensure proper lazy loading
const facadePath = 'apps/mobile/src/app/presentation/facades/locale-detection.facade.ts';
let facadeContent = fs.readFileSync(facadePath, 'utf8');

// Ensure facade uses proper error handling
facadeContent = facadeContent.replace(
  /private getService\(\): AutoLocaleDetectionService \\{[\\s\\S]*?\\}/,
  `private getService(): AutoLocaleDetectionService {
    if (!this._autoLocaleService) {
      try {
        this._autoLocaleService = this.injector.get(AutoLocaleDetectionService);
      } catch (error) {
        console.error('❌ Failed to get AutoLocaleDetectionService:', error);
        throw new Error('Locale detection service unavailable due to circular dependency');
      }
    }
    return this._autoLocaleService;
  }`
);

fs.writeFileSync(facadePath, facadeContent);
console.log('✅ Enhanced Facade error handling');

console.log('🎉 Circular dependency fix applied');
EOF

node fix-circular-dependency-final.js
```

## 🔧 **ALTERNATIVE SOLUTION - DECOUPLE TRANSLATION INTEGRATION**

If the above doesn't work, let's decouple the translation system entirely:

```bash
# PHASE 3: DECOUPLED APPROACH (If Phase 2 fails)
cat > decouple-translation-integration.js << 'EOF'
const fs = require('fs');
const path = require('path');

console.log('🔄 Decoupling translation integration...');

const servicePath = 'apps/mobile/src/app/application/services/auto-locale-detection.service.ts';
let serviceContent = fs.readFileSync(servicePath, 'utf8');

// Remove RouteFirstTranslationLoader dependency entirely and use events
const decoupledService = `
/**
 * AutoLocaleDetectionService - Application Service
 *
 * DDD APPLICATION LAYER - Orchestrates use cases and coordinates domain logic
 *
 * USES EVENT-BASED COMMUNICATION to avoid circular dependencies with translation system
 */

import { Injectable, inject, Injector, EventEmitter } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';

// Application layer dependencies
import { DetectUserLocaleUseCase } from '../use-cases/detect-user-locale.use-case';

// Infrastructure dependencies
import { GeoLocationPackageAdapter } from '@infrastructure/adapters/geo-location-package.adapter';

// Domain dependencies
import { LocalePreference } from '@domain/geo-location/value-objects/locale-preference.vo';

/**
 * Application-level DTO for locale detection result
 */
export interface LocaleDetectionResult {
  locale: string;
  countryCode: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'geo-auto' | 'user-explicit' | 'browser-fallback' | 'system-default';
  timestamp: Date;
}

/**
 * Application-level DTO for locale detection status
 */
export interface LocaleDetectionStatus {
  isDetecting: boolean;
  lastDetection: LocaleDetectionResult | null;
  hasUserPreference: boolean;
  error: string | null;
}

/**
 * Application Service for Automatic Locale Detection
 *
 * USES EVENT EMITTER for translation system integration to avoid circular dependencies
 */
@Injectable({ providedIn: 'root' })
export class AutoLocaleDetectionService {
  // Use cases (domain orchestration)
  private detectUserLocaleUseCase = inject(DetectUserLocaleUseCase);

  // Infrastructure adapters
  private geoAdapter = inject(GeoLocationPackageAdapter);

  // Event emitter for translation system integration (avoids direct dependency)
  readonly localeChanged = new EventEmitter<string>();

  // Application state
  private readonly _status$ = new BehaviorSubject<LocaleDetectionStatus>({
    isDetecting: false,
    lastDetection: null,
    hasUserPreference: false,
    error: null
  });

  /**
   * Observable status of locale detection
   */
  get status$(): Observable<LocaleDetectionStatus> {
    return this._status$.asObservable();
  }

  /**
   * Observable current locale
   */
  get currentLocale$(): Observable<string> {
    return this._status$.pipe(
      map(status => status.lastDetection?.locale || 'en')
    );
  }

  /**
   * Initialize automatic locale detection
   */
  async initialize(options: {
    respectUserPreference?: boolean;
    forceRefresh?: boolean;
  } = {}): Promise<LocaleDetectionResult> {
    const { respectUserPreference = true, forceRefresh = false } = options;

    console.log('🌍 Initializing automatic locale detection...');

    this.updateStatus({ isDetecting: true, error: null });

    try {
      // Step 1: Initialize infrastructure adapter
      await this.geoAdapter.initialize();

      // Step 2: Execute domain use case
      const localePreference = await this.detectUserLocaleUseCase.execute({
        forceRefresh,
        respectUserChoice: respectUserPreference
      });

      // Step 3: Create application-level result DTO
      const result = this.mapToDetectionResult(localePreference, 'geo-auto');

      // Step 4: Emit event for translation system (instead of direct call)
      this.localeChanged.emit(result.locale);

      // Step 5: Update application state
      this.updateStatus({
        isDetecting: false,
        lastDetection: result,
        hasUserPreference: this.hasUserExplicitPreference(),
        error: null
      });

      console.log('✅ Automatic locale detection completed:', result);

      return result;

    } catch (error) {
      console.error('❌ Automatic locale detection failed:', error);

      // Fallback strategy
      const fallbackResult = await this.executeFallbackStrategy();

      this.updateStatus({
        isDetecting: false,
        lastDetection: fallbackResult,
        hasUserPreference: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return fallbackResult;
    }
  }

  /**
   * Manually set user's locale preference
   */
  async setUserPreference(locale: string): Promise<boolean> {
    console.log(\`🎯 Setting user preference to: \${locale}\`);

    this.updateStatus({ isDetecting: true, error: null });

    try {
      // Validate locale
      if (!this.isValidLocale(locale)) {
        throw new Error(\`Invalid locale: \${locale}\`);
      }

      // Store in infrastructure
      const success = await this.geoAdapter.setUserPreference(locale).toPromise();

      if (!success) {
        throw new Error('Failed to store user preference');
      }

      // Store locally for application layer
      localStorage.setItem('user_explicit_locale', locale);

      // Emit event for translation system (instead of direct call)
      this.localeChanged.emit(locale);

      // Update state
      const result: LocaleDetectionResult = {
        locale,
        countryCode: 'USER',
        confidence: 'high',
        source: 'user-explicit',
        timestamp: new Date()
      };

      this.updateStatus({
        isDetecting: false,
        lastDetection: result,
        hasUserPreference: true,
        error: null
      });

      console.log('✅ User preference set successfully');

      return true;

    } catch (error) {
      console.error('❌ Failed to set user preference:', error);

      this.updateStatus({
        isDetecting: false,
        error: error instanceof Error ? error.message : 'Failed to set preference'
      });

      return false;
    }
  }

  /**
   * Clear user's explicit preference and re-detect
   */
  async clearUserPreference(): Promise<LocaleDetectionResult> {
    console.log('🔄 Clearing user preference and re-detecting...');

    try {
      // Clear in infrastructure
      await this.geoAdapter.clearUserPreference().toPromise();

      // Clear local storage
      localStorage.removeItem('user_explicit_locale');

      // Re-run automatic detection
      return await this.initialize({ respectUserPreference: false, forceRefresh: true });

    } catch (error) {
      console.error('❌ Failed to clear user preference:', error);

      // Fallback
      return await this.executeFallbackStrategy();
    }
  }

  /**
   * Get current detection status (synchronous)
   */
  getCurrentStatus(): LocaleDetectionStatus {
    return this._status$.value;
  }

  /**
   * Get current locale (synchronous)
   */
  getCurrentLocale(): string {
    return this._status$.value.lastDetection?.locale || 'en';
  }

  /**
   * Check if user has explicit preference
   */
  hasUserExplicitPreference(): boolean {
    return !!localStorage.getItem('user_explicit_locale');
  }

  /**
   * Get available locales
   */
  getAvailableLocales(): string[] {
    return ['en', 'de', 'np'];
  }

  /**
   * Get health status for monitoring
   */
  getHealthStatus(): {
    application: LocaleDetectionStatus;
    infrastructure: any;
  } {
    return {
      application: this.getCurrentStatus(),
      infrastructure: this.geoAdapter.getHealthStatus()
    };
  }

  // ======== PRIVATE HELPER METHODS ========

  private mapToDetectionResult(
    localePreference: LocalePreference,
    source: LocaleDetectionResult['source']
  ): LocaleDetectionResult {
    return {
      locale: localePreference.resolvedLocale,
      countryCode: localePreference.countryCode.toString(),
      confidence: localePreference.getConfidence(),
      source,
      timestamp: new Date()
    };
  }

  private async executeFallbackStrategy(): Promise<LocaleDetectionResult> {
    console.log('🔄 Executing fallback strategy...');

    // Try browser language
    const browserLang = this.getBrowserLanguage();

    // Emit event for translation system
    this.localeChanged.emit(browserLang);

    return {
      locale: browserLang,
      countryCode: 'UNKNOWN',
      confidence: 'low',
      source: 'browser-fallback',
      timestamp: new Date()
    };
  }

  private getBrowserLanguage(): string {
    if (typeof navigator === 'undefined') return 'en';

    const browserLang = navigator.language.split('-')[0];
    const supportedLanguages = this.getAvailableLocales();

    return supportedLanguages.includes(browserLang) ? browserLang : 'en';
  }

  private isValidLocale(locale: string): boolean {
    return this.getAvailableLocales().includes(locale);
  }

  private updateStatus(partial: Partial<LocaleDetectionStatus>): void {
    this._status$.next({
      ...this._status$.value,
      ...partial
    });
  }
}
`;

fs.writeFileSync(servicePath, decoupledService);
console.log('✅ Service decoupled from translation system');

// 4. Create translation system integration
const integrationPath = 'apps/mobile/src/app/core/i18n/locale-integration.service.ts';
const integrationContent = `
import { Injectable, inject } from '@angular/core';
import { AutoLocaleDetectionService } from '@application/services/auto-locale-detection.service';
import { RouteFirstTranslationLoader } from './route-first.loader';

/**
 * Integration service that connects locale detection with translation system
 * This breaks the circular dependency by being a separate service
 */
@Injectable({ providedIn: 'root' })
export class LocaleIntegrationService {
  private translationLoader = inject(RouteFirstTranslationLoader);

  constructor(private autoLocaleService: AutoLocaleDetectionService) {
    // Subscribe to locale changes and apply to translation system
    this.autoLocaleService.localeChanged.subscribe(async (locale) => {
      try {
        console.log(\`🌐 Applying locale to translation system: \${locale}\`);
        await this.translationLoader.setLocale(locale);
        console.log('✅ Locale applied to translation system');
      } catch (error) {
        console.error('❌ Failed to apply locale to translation system:', error);
      }
    });
  }
}
`;

fs.writeFileSync(integrationPath, integrationContent);
console.log('✅ Created LocaleIntegrationService');

// 5. Update app.config.ts to include the integration service
const configPath = 'apps/mobile/src/app/app.config.ts';
let configContent = fs.readFileSync(configPath, 'utf8');

if (!configContent.includes('LocaleIntegrationService')) {
  configContent = configContent.replace(
    "import { LocaleDetectionFacade } from '@presentation/facades/locale-detection.facade';",
    "import { LocaleDetectionFacade } from '@presentation/facades/locale-detection.facade';\nimport { LocaleIntegrationService } from '@core/i18n/locale-integration.service';"
  );

  configContent = configContent.replace(
    'LocaleDetectionFacade,          // Presentation facade',
    'LocaleDetectionFacade,          // Presentation facade\n    LocaleIntegrationService,       // Integration service (breaks circular dependency)'
  );
}

fs.writeFileSync(configPath, configContent);
console.log('✅ Updated app.config.ts');

console.log('🎉 Translation system decoupled - Circular dependency resolved');
EOF

# Only run if Phase 2 fails
# node decouple-translation-integration.js
```

## 🧪 **VALIDATION COMMANDS**

```bash
# Test the fix
nx build mobile --configuration=development
nx serve mobile --configuration=development
```

## 🎯 **EXECUTION STRATEGY**

**Run these commands in order:**

1. **First**: `node fix-circular-dependency-final.js` (Lazy translation loader)
2. **Test**: `nx build mobile` (Check if it works)
3. **If fails**: `node decouple-translation-integration.js` (Event-based decoupling)

## 📊 **WHY THIS FIXES THE CIRCULAR DEPENDENCY**

**Before (Circular):**
```
AutoLocaleDetectionService → RouteFirstTranslationLoader → (something) → AutoLocaleDetectionService
```

**After (Fixed with Lazy Loading):**
```
AutoLocaleDetectionService → (lazy) → RouteFirstTranslationLoader
```

**Or (Fixed with Events):**
```
AutoLocaleDetectionService → (emits events) → LocaleIntegrationService → RouteFirstTranslationLoader
```

The key is breaking the direct constructor dependency chain that Angular's DI can't resolve.

**Run Phase 1 first and let me know the result!** 🚀  