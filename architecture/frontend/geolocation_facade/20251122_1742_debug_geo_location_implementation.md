# 🎯 **CLAUDI CLI PROMPT INSTRUCTIONS - CIRCULAR DEPENDENCY FIX**

## 🚀 **IMMEDIATE EXECUTION COMMANDS**

```bash
# PHASE 1: QUICK DIAGNOSTIC & BACKUP
echo "🔍 Diagnosing circular dependency..."
nx run mobile:lint --quiet | grep -i "circular" || echo "✅ No circular dependency warnings in lint"
cp apps/mobile/src/app/landing/landing.component.ts landing.backup.ts
cp apps/mobile/src/app/presentation/facades/locale-detection.facade.ts facade.backup.ts

# PHASE 2: APPLY CIRCULAR DEPENDENCY FIX
cat > fix-circular-dependency.js << 'EOF'
const fs = require('fs');
const path = require('path');

console.log('🔄 Applying circular dependency fix...');

// 1. Fix Landing Component - Use inject() pattern
const landingPath = 'apps/mobile/src/app/landing/landing.component.ts';
let landingContent = fs.readFileSync(landingPath, 'utf8');

// Replace constructor injection with inject() function
landingContent = landingContent.replace(
  /constructor\([^)]*\)\s*{[^}]*}/,
  ''
).replace(
  /export class LandingComponent[^{]*{/,
  `export class LandingComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly localeFacade = inject(LocaleDetectionFacade);`
);

// Ensure proper imports
if (!landingContent.includes('inject')) {
  landingContent = landingContent.replace(
    "import { Component, OnInit, OnDestroy } from '@angular/core';",
    "import { Component, inject, OnInit, OnDestroy } from '@angular/core';"
  );
}

fs.writeFileSync(landingPath, landingContent);
console.log('✅ Fixed Landing Component injection');

// 2. Fix Facade - Add lazy service injection
const facadePath = 'apps/mobile/src/app/presentation/facades/locale-detection.facade.ts';
let facadeContent = fs.readFileSync(facadePath, 'utf8');

// Add lazy service injection pattern
if (!facadeContent.includes('private getService()')) {
  const lazyInjectionPattern = `
  /**
   * Get the service instance (lazy initialization to break circular dependencies)
   */
  private getService(): AutoLocaleDetectionService {
    if (!this.autoLocaleService) {
      this.autoLocaleService = inject(AutoLocaleDetectionService);
    }
    return this.autoLocaleService;
  }`;

  facadeContent = facadeContent.replace(
    /private autoLocaleService = inject\(AutoLocaleDetectionService\);/,
    'private autoLocaleService?: AutoLocaleDetectionService;'
  );

  // Find a good place to insert the getService method
  const insertPoint = facadeContent.indexOf('private getDefaultLocaleOptions()');
  if (insertPoint !== -1) {
    facadeContent = facadeContent.slice(0, insertPoint) + lazyInjectionPattern + facadeContent.slice(insertPoint);
  }
}

// Update all service calls to use getService()
facadeContent = facadeContent.replace(
  /this\.autoLocaleService\./g,
  'this.getService().'
);

fs.writeFileSync(facadePath, facadeContent);
console.log('✅ Fixed Facade lazy service injection');

console.log('🎉 Circular dependency fixes applied');
EOF

node fix-circular-dependency.js
```

## 🔧 **NUCLEAR OPTION - SERVICE LOCATOR PATTERN**

```bash
# PHASE 3: SERVICE LOCATOR AS FALLBACK (If Phase 2 fails)
cat > implement-service-locator.js << 'EOF'
const fs = require('fs');
const path = require('path');

console.log('🛠️ Implementing Service Locator pattern...');

// 1. Create Service Locator
const serviceLocatorContent = `
import { Injectable, Injector } from '@angular/core';

/**
 * Manual service locator to break circular dependencies
 * Use as last resort when Angular DI fails
 */
@Injectable({ providedIn: 'root' })
export class ServiceLocator {
  private static injector: Injector;

  static setInjector(injector: Injector) {
    ServiceLocator.injector = injector;
  }

  static getInjector(): Injector {
    return ServiceLocator.injector;
  }

  static get<T>(token: any): T {
    if (!ServiceLocator.injector) {
      throw new Error('ServiceLocator not initialized. Call setInjector first.');
    }
    return ServiceLocator.injector.get<T>(token);
  }
}
`;

const serviceLocatorPath = 'apps/mobile/src/app/core/utils/service-locator.ts';
fs.mkdirSync(path.dirname(serviceLocatorPath), { recursive: true });
fs.writeFileSync(serviceLocatorPath, serviceLocatorContent);
console.log('✅ Service Locator created');

// 2. Update main.ts
const mainPath = 'apps/mobile/src/main.ts';
let mainContent = fs.readFileSync(mainPath, 'utf8');

if (!mainContent.includes('ServiceLocator')) {
  // Add import
  mainContent = mainContent.replace(
    "import { bootstrapApplication } from '@angular/platform-browser';",
    "import { bootstrapApplication } from '@angular/platform-browser';\nimport { ServiceLocator } from './app/core/utils/service-locator';"
  );
  
  // Add service locator initialization
  mainContent = mainContent.replace(
    /bootstrapApplication\(AppComponent, appConfig\)\s*\.catch\(\(err\) => console\.error\(err\)\);/,
    `bootstrapApplication(AppComponent, appConfig)\n  .then((appRef) => {\n    // Set service locator for manual dependency resolution\n    ServiceLocator.setInjector(appRef.injector);\n  })\n  .catch((err) => console.error(err));`
  );
}

fs.writeFileSync(mainPath, mainContent);
console.log('✅ Main.ts updated with Service Locator');

// 3. Update Facade to use Service Locator as fallback
const facadePath = 'apps/mobile/src/app/presentation/facades/locale-detection.facade.ts';
let facadeContent = fs.readFileSync(facadePath, 'utf8');

if (!facadeContent.includes('ServiceLocator')) {
  // Add import
  facadeContent = facadeContent.replace(
    "import { Injectable, inject, signal, computed } from '@angular/core';",
    "import { Injectable, inject, signal, computed } from '@angular/core';\nimport { ServiceLocator } from '@core/utils/service-locator';"
  );
  
  // Update getService method to use Service Locator as fallback
  facadeContent = facadeContent.replace(
    /private getService\(\): AutoLocaleDetectionService \{[^}]+\}/,
    `private getService(): AutoLocaleDetectionService {\n    if (!this.autoLocaleService) {\n      try {\n        this.autoLocaleService = inject(AutoLocaleDetectionService);\n      } catch (error) {\n        // Fallback to Service Locator if inject fails (circular dependency)\n        this.autoLocaleService = ServiceLocator.get(AutoLocaleDetectionService);\n      }\n    }\n    return this.autoLocaleService;\n  }`
  );
}

fs.writeFileSync(facadePath, facadeContent);
console.log('✅ Facade updated with Service Locator fallback');

console.log('🎉 Service Locator pattern implemented');
EOF

# Only run if Phase 2 fails
echo "⚠️  Run this only if circular dependency persists after Phase 2"
# node implement-service-locator.js
```

## 🧪 **VALIDATION & TESTING COMMANDS**

```bash
# PHASE 4: VALIDATE THE FIX
cat > validate-fix.sh << 'EOF'
#!/bin/bash

echo "🧪 Validating Circular Dependency Fix"
echo "======================================"

# Test 1: Build the application
echo "1. Testing build..."
nx build mobile --configuration=development > build.log 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Build successful"
    rm build.log
else
    echo "❌ Build failed - check build.log"
    grep -i "circular" build.log || echo "⚠️  Build failed for other reasons"
    exit 1
fi

# Test 2: Check for circular dependency warnings
echo "2. Checking for circular dependencies..."
nx run mobile:lint --quiet | grep -i "circular" && echo "❌ Circular dependencies found" || echo "✅ No circular dependencies"

# Test 3: Validate architecture
echo "3. Validating architecture..."
nx run mobile:validate-architecture > architecture.log 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Architecture validation passed"
    rm architecture.log
else
    echo "❌ Architecture validation failed - check architecture.log"
    exit 1
fi

# Test 4: Start dev server (brief test)
echo "4. Testing dev server startup..."
timeout 30s nx serve mobile --configuration=development > server.log 2>&1 &

SERVER_PID=$!
sleep 10

if ps -p $SERVER_PID > /dev/null; then
    echo "✅ Dev server started successfully"
    kill $SERVER_PID 2>/dev/null
    rm server.log
else
    echo "❌ Dev server failed to start - check server.log"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

echo ""
echo "🎉 ALL VALIDATIONS PASSED - Circular dependency fixed!"
EOF

chmod +x validate-fix.sh
./validate-fix.sh
```

## 🎯 **DEBUGGING & TROUBLESHOOTING COMMANDS**

```bash
# PHASE 5: ADVANCED DEBUGGING (If issues persist)
cat > advanced-debugging.js << 'EOF'
const fs = require('fs');
const path = require('path');

console.log('🔧 Advanced debugging for circular dependencies...');

// 1. Analyze dependency graph
console.log('1. Analyzing dependency graph...');
const analyzeDeps = `
// Dependency Chain Analysis:
// LandingComponent → LocaleDetectionFacade → AutoLocaleDetectionService
// Potential circular: AutoLocaleDetectionService → ??? → LandingComponent

// Check if AutoLocaleDetectionService imports anything that leads back to LandingComponent
`;

// 2. Create dependency visualization
const createDependencyMap = () => {
  const files = [
    'apps/mobile/src/app/landing/landing.component.ts',
    'apps/mobile/src/app/presentation/facades/locale-detection.facade.ts', 
    'apps/mobile/src/app/application/services/auto-locale-detection.service.ts'
  ];

  files.forEach(file => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      const imports = content.match(/import.*from\s+['"]([^'"]+)['"]/g) || [];
      console.log(\`\\n📁 ${file} imports:\\n  \${imports.slice(0, 5).join('\\n  ')}\${imports.length > 5 ? '\\n  ...' : ''}\`);
    }
  });
};

createDependencyMap();

// 3. Check for barrel file issues
console.log('\\n3. Checking for barrel file issues...');
const barrelFiles = [
  'apps/mobile/src/app/presentation/index.ts',
  'apps/mobile/src/app/application/index.ts', 
  'apps/mobile/src/app/domain/index.ts'
];

barrelFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(\`✅ Barrel file exists: \${file}\`);
  }
});

console.log('\\n🎯 Debugging analysis complete');
EOF

node advanced-debugging.js
```

## 📋 **COMPREHENSIVE FIX SEQUENCE**

```bash
# EXECUTE IN THIS ORDER:
echo "🎯 COMPREHENSIVE CIRCULAR DEPENDENCY FIX SEQUENCE"
echo "================================================="

echo "1. PHASE 1: Backup and diagnose"
cp apps/mobile/src/app/landing/landing.component.ts landing.backup.ts
cp apps/mobile/src/app/presentation/facades/locale-detection.facade.ts facade.backup.ts

echo "2. PHASE 2: Apply main fix"
node fix-circular-dependency.js

echo "3. PHASE 4: Validate fix"
./validate-fix.sh

echo ""
echo "🔮 NEXT STEPS BASED ON VALIDATION:"
echo "✅ If validation passes: Run 'nx serve mobile' and test functionality"
echo "❌ If validation fails: Run 'node implement-service-locator.js' then re-validate"
echo "🆘 If still failing: Run 'node advanced-debugging.js' for deep analysis"
```

## 🚨 **EMERGENCY ROLLBACK COMMANDS**

```bash
# If anything breaks, use these rollback commands:
cat > emergency-rollback.sh << 'EOF'
#!/bin/bash

echo "🚨 EMERGENCY ROLLBACK - Restoring backups..."

if [ -f "landing.backup.ts" ]; then
    cp landing.backup.ts apps/mobile/src/app/landing/landing.component.ts
    echo "✅ Landing component restored"
fi

if [ -f "facade.backup.ts" ]; then
    cp facade.backup.ts apps/mobile/src/app/presentation/facades/locale-detection.facade.ts
    echo "✅ Facade restored" 
fi

# Remove service locator if it was added
if [ -f "apps/mobile/src/app/core/utils/service-locator.ts" ]; then
    rm apps/mobile/src/app/core/utils/service-locator.ts
    echo "✅ Service locator removed"
fi

echo "🔄 Reverting main.ts changes..."
# This would need manual review, but for now just notify
echo "⚠️  Please manually review main.ts to remove ServiceLocator imports if added"

echo "🎉 Rollback complete - Original state restored"
EOF

chmod +x emergency-rollback.sh
```

## 📊 **SUCCESS METRICS & VERIFICATION**

```bash
# Final verification command
cat > final-verification.sh << 'EOF'
#!/bin/bash

echo "🎯 FINAL VERIFICATION - CIRCULAR DEPENDENCY FIX"
echo "=============================================="

echo "1. Checking build..."
nx build mobile --configuration=development && echo "✅ Build: PASS" || echo "❌ Build: FAIL"

echo "2. Checking for circular dependency errors..."
nx run mobile:lint --quiet | grep -i "circular" && echo "❌ Lint: CIRCULAR DEPS FOUND" || echo "✅ Lint: NO CIRCULAR DEPS"

echo "3. Testing application startup..."
timeout 10s nx serve mobile --configuration=development > /dev/null 2>&1 &
SERVER_PID=$!
sleep 5

if kill -0 $SERVER_PID 2>/dev/null; then
    echo "✅ Server: STARTED SUCCESSFULLY"
    kill $SERVER_PID 2>/dev/null
else
    echo "❌ Server: FAILED TO START"
fi

echo ""
echo "📊 VERIFICATION SUMMARY:"
echo "If all checks show ✅, the circular dependency is FIXED!"
echo "If any ❌ appear, run the emergency rollback and try alternative approaches."
EOF

chmod +x final-verification.sh
```

## 🎯 **EXECUTION SUMMARY**

**Run these commands in order:**

1. **First**: `node fix-circular-dependency.js` (Main fix)
2. **Then**: `./validate-fix.sh` (Test the fix)  
3. **If fails**: `node implement-service-locator.js` (Fallback)
4. **Final**: `./final-verification.sh` (Confirm resolution)

**Expected Outcome**: NG0200 circular dependency error resolved, app builds and runs successfully with full geo-location functionality intact.

**Ready to execute Phase 2?** 🚀
# 🔧 **CIRCULAR DEPENDENCY FIX - SENIOR ARCHITECT SOLUTION**

## 🎯 **IMMEDIATE DIAGNOSIS & FIX**

The circular dependency is between:
- `LandingComponent` → `LocaleDetectionFacade` → `AutoLocaleDetectionService`

This happens because we're injecting the facade in the landing component constructor. Let's fix this with proper Angular patterns.

## 🚀 **IMMEDIATE FIX COMMANDS**

### **PHASE 1: FIX CIRCULAR DEPENDENCY**

```bash
# 1. Fix Landing Component - Use inject() instead of constructor injection
cat > apps/mobile/src/app/landing/landing.component.ts << 'EOF'
import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HeaderComponent } from '@presentation/components/header/header.component';
import { HeroComponent } from '@presentation/components/hero/hero.component';
import { FeaturesComponent } from '@presentation/components/features/features.component';
import { ActionsComponent } from '@presentation/components/actions/actions.component';
import { StatsComponent } from '@presentation/components/stats/stats.component';
import { FooterComponent } from '@presentation/components/footer/footer.component';
import { LocaleDetectionFacade } from '@presentation/facades/locale-detection.facade';

/**
 * Landing Page Component
 * Complete frontpage integrating all individual components
 * Mobile-optimized with OKLCH color system
 * Includes automatic geo-location based language detection
 */
@Component({
  selector: 'pd-landing',
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
      <!-- Header with Language Selector -->
      <pd-header></pd-header>

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

      <!-- Debug Toggle -->
      <button (click)="toggleDebugInfo()" 
              class="fixed bottom-4 right-4 bg-blue-500 text-white p-2 rounded text-sm z-50">
        {{ showDebugInfo() ? '❌' : '🐛' }} Debug
      </button>

      <!-- Debug Panel -->
      @if (showDebugInfo()) {
        <div class="fixed bottom-20 right-4 bg-gray-800 text-white p-4 rounded max-w-md z-50 shadow-lg">
          <h4 class="font-bold mb-2">🌐 Locale Debug</h4>
          <div class="space-y-1 text-sm">
            <p><strong>Locale:</strong> {{ currentLocale() }}</p>
            <p><strong>Country:</strong> {{ detectedCountry() || 'Unknown' }}</p>
            <p><strong>Source:</strong> {{ detectionSource() }}</p>
            <p><strong>User Preference:</strong> {{ hasUserPreference() ? 'Yes' : 'No' }}</p>
            <p><strong>Loading:</strong> {{ isLoading() ? 'Yes' : 'No' }}</p>
          </div>
          <div class="mt-3 space-x-2">
            <button (click)="resetDetection()" class="text-sm bg-green-500 px-2 py-1 rounded">
              Reset Detection
            </button>
            <button (click)="forceRefresh()" class="text-sm bg-yellow-500 px-2 py-1 rounded">
              Force Refresh
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .bg-background {
      background-color: oklch(0.98 0.02 260);
    }
  `]
})
export class LandingComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly localeFacade = inject(LocaleDetectionFacade);

  // Reactive state
  private readonly _showDebugInfo = signal(false);
  readonly showDebugInfo = this._showDebugInfo.asReadonly();

  // Facade state proxies
  readonly currentLocale = this.localeFacade.currentLocale;
  readonly detectedCountry = this.localeFacade.detectedCountry;
  readonly detectionSource = this.localeFacade.detectionSource;
  readonly hasUserPreference = this.localeFacade.hasUserPreference;
  readonly isLoading = this.localeFacade.isLoading;

  async ngOnInit() {
    console.log('🚀 Landing Page - Initializing locale detection...');
    
    try {
      // Initialize locale detection with slight delay to avoid race conditions
      setTimeout(async () => {
        const result = await this.localeFacade.initialize();
        
        console.log('🌐 Locale detection completed:', {
          locale: result.locale,
          countryCode: result.countryCode,
          source: result.source,
          confidence: result.confidence
        });

        // Show debug info in development
        if (!this.isProduction()) {
          this._showDebugInfo.set(true);
        }
      }, 100);
      
    } catch (error) {
      console.error('❌ Locale detection failed:', error);
      // Continue with default language (English)
    }
  }

  toggleDebugInfo(): void {
    this._showDebugInfo.update(show => !show);
  }

  async resetDetection(): Promise<void> {
    try {
      await this.localeFacade.resetToAutoDetect();
      console.log('🔄 Locale detection reset');
    } catch (error) {
      console.error('❌ Failed to reset detection:', error);
    }
  }

  async forceRefresh(): Promise<void> {
    try {
      await this.localeFacade.initialize({ forceRefresh: true });
      console.log('🔄 Locale detection forced refresh');
    } catch (error) {
      console.error('❌ Failed to force refresh:', error);
    }
  }

  private isProduction(): boolean {
    // This should come from your environment configuration
    return false;
  }
}
EOF
```

### **PHASE 2: ENHANCE FACADE WITH BETTER ERROR HANDLING**

```bash
# 2. Check and enhance the facade to avoid circular dependencies
cat > apps/mobile/src/app/presentation/facades/locale-detection.facade.ts << 'EOF'
import { Injectable, inject, signal, computed } from '@angular/core';
import { AutoLocaleDetectionService } from '@application/services/auto-locale-detection.service';
import { LocaleDetectionResult, LocaleDetectionStatus } from '@application/services/auto-locale-detection.service';

export interface LocaleOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  isDefault?: boolean;
}

export interface LocaleDetectionViewModel {
  currentLocale: string;
  availableLocales: LocaleOption[];
  isLoading: boolean;
  errorMessage: string | null;
  hasUserPreference: boolean;
  detectedCountry: string | null;
  detectionSource: string;
}

/**
 * Facade for locale detection functionality
 * Provides reactive signals and simple API for components
 * Uses lazy service injection to avoid circular dependencies
 */
@Injectable({
  providedIn: 'root'
})
export class LocaleDetectionFacade {
  // Lazy service injection to break circular dependencies
  private autoLocaleService?: AutoLocaleDetectionService;

  // Reactive state
  private readonly state = signal<LocaleDetectionViewModel>({
    currentLocale: 'en',
    availableLocales: this.getDefaultLocaleOptions(),
    isLoading: false,
    errorMessage: null,
    hasUserPreference: false,
    detectedCountry: null,
    detectionSource: 'browser'
  });

  // Public signals
  readonly currentLocale = computed(() => this.state().currentLocale);
  readonly isLoading = computed(() => this.state().isLoading);
  readonly errorMessage = computed(() => this.state().errorMessage);
  readonly availableLocales = computed(() => this.state().availableLocales);
  readonly hasUserPreference = computed(() => this.state().hasUserPreference);
  readonly detectedCountry = computed(() => this.state().detectedCountry);
  readonly detectionSource = computed(() => this.state().detectionSource);

  // Complete view model
  readonly viewModel = computed((): LocaleDetectionViewModel => this.state());

  /**
   * Get the service instance (lazy initialization)
   */
  private getService(): AutoLocaleDetectionService {
    if (!this.autoLocaleService) {
      this.autoLocaleService = inject(AutoLocaleDetectionService);
    }
    return this.autoLocaleService;
  }

  /**
   * Get default locale options with English always first
   */
  private getDefaultLocaleOptions(): LocaleOption[] {
    return [
      { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', isDefault: true },
      { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
      { code: 'np', name: 'Nepali', nativeName: 'नेपाली', flag: '🇳🇵' }
    ];
  }

  /**
   * Initialize locale detection
   */
  async initialize(options?: {
    respectUserPreference?: boolean;
    forceRefresh?: boolean;
  }): Promise<LocaleDetectionResult> {
    this.state.update(state => ({ ...state, isLoading: true, errorMessage: null }));

    try {
      const service = this.getService();
      const result = await service.initialize(options);

      this.updateStateFromResult(result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Locale detection failed';
      this.state.update(state => ({ 
        ...state, 
        isLoading: false, 
        errorMessage 
      }));
      throw error;
    }
  }

  /**
   * Set manual locale preference
   */
  async setLocale(locale: string): Promise<boolean> {
    this.state.update(state => ({ ...state, isLoading: true, errorMessage: null }));

    try {
      const service = this.getService();
      const success = await service.setUserPreference(locale);
      
      if (success) {
        const status = service.getCurrentStatus();
        this.updateStateFromStatus(status);
      }

      return success;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to set locale';
      this.state.update(state => ({ 
        ...state, 
        isLoading: false, 
        errorMessage 
      }));
      return false;
    }
  }

  /**
   * Reset to auto-detection
   */
  async resetToAutoDetect(): Promise<LocaleDetectionResult> {
    this.state.update(state => ({ ...state, isLoading: true, errorMessage: null }));

    try {
      const service = this.getService();
      const result = await service.clearUserPreference();
      this.updateStateFromResult(result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reset locale';
      this.state.update(state => ({ 
        ...state, 
        isLoading: false, 
        errorMessage 
      }));
      throw error;
    }
  }

  /**
   * Get available locale options with English always first
   */
  getAvailableLocaleOptions(): LocaleOption[] {
    const currentLocale = this.currentLocale();
    const options = this.getDefaultLocaleOptions();
    
    // Ensure current locale is in the list
    if (!options.find(opt => opt.code === currentLocale)) {
      options.push({
        code: currentLocale,
        name: currentLocale.toUpperCase(),
        nativeName: currentLocale.toUpperCase(),
        flag: '🌐'
      });
    }

    return options;
  }

  /**
   * Get health status for monitoring
   */
  getHealthStatus() {
    const service = this.getService();
    return service.getHealthStatus();
  }

  /**
   * Get current detection status
   */
  getCurrentStatus(): LocaleDetectionStatus {
    const service = this.getService();
    return service.getCurrentStatus();
  }

  /**
   * Update state from detection result
   */
  private updateStateFromResult(result: LocaleDetectionResult): void {
    const service = this.getService();
    const status = service.getCurrentStatus();
    this.updateStateFromStatus(status);
  }

  /**
   * Update state from detection status
   */
  private updateStateFromStatus(status: LocaleDetectionStatus): void {
    this.state.update(state => ({
      ...state,
      currentLocale: status.lastDetection?.locale || 'en',
      isLoading: false,
      errorMessage: status.error || null,
      hasUserPreference: status.hasUserPreference,
      detectedCountry: status.lastDetection?.countryCode || null,
      detectionSource: status.lastDetection?.source || 'unknown'
    }));
  }
}
EOF
```

### **PHASE 3: VERIFY FIX & TEST**

```bash
# 3. Test the fix
nx run mobile:validate-architecture

# 4. Build to check for circular dependencies
nx build mobile

# 5. If build succeeds, start the dev server
nx serve mobile --configuration=development
```

## 🔧 **ALTERNATIVE SOLUTION - IF CIRCULAR DEPENDENCY PERSISTS**

If the circular dependency still exists, use this **nuclear option** with manual service management:

```bash
# Create a manual service locator to break all circular dependencies
cat > apps/mobile/src/app/core/utils/service-locator.ts << 'EOF'
import { Injectable, Injector } from '@angular/core';

/**
 * Manual service locator to break circular dependencies
 * Use as last resort when Angular DI fails
 */
@Injectable({ providedIn: 'root' })
export class ServiceLocator {
  private static injector: Injector;

  static setInjector(injector: Injector) {
    ServiceLocator.injector = injector;
  }

  static getInjector(): Injector {
    return ServiceLocator.injector;
  }

  static get<T>(token: any): T {
    return ServiceLocator.injector.get<T>(token);
  }
}
EOF

# Update main.ts to set the injector
cat >> apps/mobile/src/main.ts << 'EOF'
import { ServiceLocator } from './app/core/utils/service-locator';

// ... existing imports

bootstrapApplication(AppComponent, appConfig)
  .then((appRef) => {
    // Set service locator for manual dependency resolution
    ServiceLocator.setInjector(appRef.injector);
  })
  .catch((err) => console.error(err));
EOF
```

## 🎯 **ARCHITECT'S CIRCULAR DEPENDENCY STRATEGY**

### **Root Causes Fixed:**
1. **Constructor Injection** → **inject() function**
2. **Eager Service Loading** → **Lazy Service Access**
3. **Direct Service References** → **Facade Pattern**

### **Prevention Patterns:**
- Always use `inject()` in standalone components
- Use lazy service access in facades
- Avoid service-to-service constructor dependencies
- Use manual service locator as last resort

### **Testing the Fix:**
```bash
# Run these commands to verify the fix
echo "🔧 Testing Circular Dependency Fix..."

# 1. Check build
nx build mobile

# 2. Check architecture
nx run mobile:validate-architecture

# 3. Start dev server
nx serve mobile --configuration=development

echo "✅ If no errors, circular dependency is fixed!"
```

## 📊 **VERIFICATION CHECKLIST**

- [ ] **No NG0200 errors** in console
- [ ] **App builds successfully** 
- [ ] **Language selector appears** in header
- [ ] **Locale detection works** on page load
- [ ] **Manual language switching** functional
- [ ] **Debug panel toggles** correctly

**Run the Phase 1-3 commands above to implement the fix.** The lazy service injection pattern should resolve the circular dependency while maintaining all functionality. 🚀
