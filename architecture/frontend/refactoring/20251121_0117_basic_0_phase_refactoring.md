Perfect! That's the **correct sequence**. Let's execute this step-by-step.

## 🎯 **STEP 1: MOVE EXISTING CODE TO DDD STRUCTURE**

### **Current → Target Mapping**

```
BEFORE (Current):
apps/mobile/src/app/
├── components/          → MOVES TO presentation/
│   ├── header/          
│   ├── hero/            
│   ├── features/        
│   ├── footer/          
│   └── stats/           
├── auth/                → MOVES TO presentation/pages/auth/
├── home/                → MOVES TO presentation/pages/home/  
├── dashboard/           → MOVES TO presentation/pages/dashboard/
├── elections/           → MOVES TO presentation/pages/elections/
├── membership/          → MOVES TO presentation/pages/membership/
├── landing/             → STAYS (landing page)
├── features/            → EXTRACT DOMAINS FROM HERE LATER
│   ├── membership/      → domain/member/ (later)
│   ├── elections/       → domain/election/ (later)
│   ├── finance/         → domain/finance/ (later)
│   └── communication/   → domain/communication/ (later)
└── core/                → STAYS (cross-cutting)

AFTER (Move Only):
apps/mobile/src/app/
├── presentation/        ← NEW (from components/ + pages)
│   ├── components/      ← FROM components/
│   │   ├── header/
│   │   ├── hero/
│   │   ├── features/
│   │   ├── footer/
│   │   └── stats/
│   └── pages/           ← NEW (from auth/, home/, etc.)
│       ├── auth/
│       ├── home/
│       ├── dashboard/
│       ├── elections/
│       └── membership/
├── domain/              ← NEW (empty for now)
├── application/         ← NEW (empty for now) 
├── infrastructure/      ← NEW (empty for now)
├── features/            ← KEEP (extract domains later)
├── core/                ← KEEP
└── landing/             ← KEEP
```

## 🎯 **PROMPT: Move Existing Code to DDD Structure**

**SYSTEM**: You are an Angular Migration Specialist. Move existing files to the new DDD structure without changing any code logic - only update imports and paths.

**CONTEXT**: Need to physically move files to new DDD structure while maintaining all existing functionality.

## 📋 **DELIVERABLES - MOVE ONLY**

### **1. Create New Structure & Move Files**
```bash
# Create new DDD structure
mkdir -p apps/mobile/src/app/presentation/components
mkdir -p apps/mobile/src/app/presentation/pages
mkdir -p apps/mobile/src/app/domain
mkdir -p apps/mobile/src/app/application  
mkdir -p apps/mobile/src/app/infrastructure

# Move components to presentation
mv apps/mobile/src/app/components/* apps/mobile/src/app/presentation/components/

# Move pages to presentation/pages
mv apps/mobile/src/app/auth apps/mobile/src/app/presentation/pages/
mv apps/mobile/src/app/home apps/mobile/src/app/presentation/pages/
mv apps/mobile/src/app/dashboard apps/mobile/src/app/presentation/pages/
mv apps/mobile/src/app/elections apps/mobile/src/app/presentation/pages/
mv apps/mobile/src/app/membership apps/mobile/src/app/presentation/pages/
```

### **2. Update TypeScript Paths**
```json
// apps/mobile/tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@presentation/*": ["src/app/presentation/*"],
      "@domain/*": ["src/app/domain/*"],
      "@application/*": ["src/app/application/*"],
      "@infrastructure/*": ["src/app/infrastructure/*"],
      "@core/*": ["src/app/core/*"],
      "@features/*": ["src/app/features/*"]
    }
  }
}
```

### **3. Update Imports in All Files**
```typescript
// BEFORE in components:
import { HeaderComponent } from '../../components/header/header.component';

// AFTER: 
import { HeaderComponent } from '@presentation/components/header/header.component';

// BEFORE in pages:
import { AuthService } from '../../core/services/auth.service';

// AFTER:
import { AuthService } from '@core/services/auth.service';
```

### **4. Update Angular Routing**
```typescript
// apps/mobile/src/app/app.routes.ts
// Update paths for moved components

// BEFORE:
const routes: Routes = [
  { path: '', component: HomePage },
  { path: 'auth', loadChildren: () => import('./auth/auth.routes') },
  { path: 'dashboard', component: DashboardPage },
];

// AFTER:
const routes: Routes = [
  { path: '', component: HomePage },
  { 
    path: 'auth', 
    loadChildren: () => import('@presentation/pages/auth/auth.routes')
  },
  { 
    path: 'dashboard', 
    component: DashboardPage 
  },
];
```

### **5. Update Barrel Exports**
```typescript
// apps/mobile/src/app/presentation/components/index.ts
export { HeaderComponent } from './header/header.component';
export { HeroComponent } from './hero/hero.component';
export { FeaturesComponent } from './features/features.component';
export { FooterComponent } from './footer/footer.component';
export { StatsComponent } from './stats/stats.component';
```

## 🎯 **STEP 2: LANGUAGE SETUP FOR LANDING PAGE**

### **Language Files Structure**
```json
// apps/mobile/src/assets/i18n/en.json
{
  "landing": {
    "hero": {
      "title": "Building Trust in Democratic Institutions",
      "subtitle": "A secure platform for political parties and NGOs to engage members, ensure transparency, and strengthen democratic processes worldwide.",
      "cta": "Start Your Digital Transformation"
    },
    "features": {
      "title": "Why Choose Public Digit?",
      "subtitle": "Designed specifically for the unique needs of political organizations and NGOs with security, transparency, and engagement at our core."
    }
  }
}
```

```json
// apps/mobile/src/assets/i18n/es.json
{
  "landing": {
    "hero": {
      "title": "Construyendo Confianza en Instituciones Democráticas",
      "subtitle": "Una plataforma segura para partidos políticos y ONG para involucrar miembros, garantizar transparencia y fortalecer procesos democráticos en todo el mundo.",
      "cta": "Comienza Tu Transformación Digital"
    }
  }
}
```

### **Language Service for Landing Page**
```typescript
// apps/mobile/src/app/core/services/language.service.ts
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private currentLang = new BehaviorSubject<string>('en');
  
  setLanguage(lang: string): void {
    this.currentLang.next(lang);
    localStorage.setItem('public-digit-lang', lang);
  }
  
  getTranslation(key: string): string {
    // Simple implementation for landing page only
    const translations = {
      'en': {
        'landing.hero.title': 'Building Trust in Democratic Institutions',
        'landing.hero.cta': 'Start Your Digital Transformation'
      },
      'es': {
        'landing.hero.title': 'Construyendo Confianza en Instituciones Democráticas', 
        'landing.hero.cta': 'Comienza Tu Transformación Digital'
      }
    };
    
    return translations[this.currentLang.value]?.[key] || key;
  }
}
```

## 🎯 **STEP 3: ARCHITECTURE VALIDATION**

### **DDD Layer Rules Check**
```typescript
// apps/mobile/src/app/core/architecture/validation.rules.ts
export const architectureRules = {
  presentation: {
    canImport: ['@application/*', '@core/*', '@presentation/*'],
    cannotImport: ['@domain/*', '@infrastructure/*'] // Must use application layer
  },
  application: {
    canImport: ['@domain/*', '@application/*', '@core/*'],
    cannotImport: ['@infrastructure/*', '@presentation/*']
  },
  domain: {
    canImport: ['@domain/*', '@core/*'],
    cannotImport: ['@application/*', '@infrastructure/*', '@presentation/*']
  }
};
```

## 🚀 **EXECUTION SEQUENCE**

### **Phase 1: Move Files (Day 1)**
1. ✅ Create new folder structure
2. ✅ Move components to `presentation/components/`
3. ✅ Move pages to `presentation/pages/` 
4. ✅ Update all imports and routes
5. ✅ Verify app still works

### **Phase 2: Language Setup (Day 2)**
1. ✅ Create language files
2. ✅ Implement LanguageService
3. ✅ Update landing page to use translations
4. ✅ Add language switcher to landing page

### **Phase 3: Architecture Check (Day 3)**
1. ✅ Verify DDD layer boundaries
2. ✅ Check import restrictions
3. ✅ Validate dependency directions
4. ✅ Document architecture rules

### **Phase 4: Ready for Development (Day 4)**
1. ✅ Structure is DDD-ready
2. ✅ Language foundation working
3. ✅ Architecture validated
4. ✅ Can start domain development

## ✅ **SUCCESS CRITERIA AFTER MOVES**

- ✅ **Landing page works exactly as before**
- ✅ **All routes functional** 
- ✅ **No broken imports**
- ✅ **Language switcher works on landing page**
- ✅ **DDD structure in place**
- ✅ **Ready for domain development**

## 🎯 **READY TO START**

**Should I begin with Phase 1: Moving existing code to the new DDD structure?** I'll provide the exact file moves and import updates to ensure zero functionality breaks.

This approach gives you:
- ✅ **Clean DDD structure** without breaking changes
- ✅ **Language-ready** landing page  
- ✅ **Validated architecture** before domain development
- ✅ **Perfect foundation** for incremental domain extraction