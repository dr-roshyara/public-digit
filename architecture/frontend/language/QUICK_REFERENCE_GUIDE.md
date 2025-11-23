# 🚀 **Angular i18n Quick Reference Guide**

**Status**: ✅ Production Ready
**Last Updated**: 2025-11-23

---

## 📋 **TABLE OF CONTENTS**

1. [Quick Start](#quick-start)
2. [Usage in Components](#usage-in-components)
3. [Adding New Translations](#adding-new-translations)
4. [Changing Language](#changing-language)
5. [Architecture Overview](#architecture-overview)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

---

## 🚀 **QUICK START**

### **The System Is Already Working!**

Everything is initialized automatically. Just start using translations in your components.

### **Verify It's Working**

```bash
# Build the app
nx build mobile

# Serve the app
nx serve mobile

# Visit http://localhost:4200
# Click the language selector in the header
# Watch the UI update to the selected language ✨
```

---

## 💻 **USAGE IN COMPONENTS**

### **Method 1: In Templates (Recommended)**

```typescript
import { Component } from '@angular/core';
import { TranslatePipe } from '@core/i18n/pipes/translate.pipe';

@Component({
  selector: 'app-my-component',
  standalone: true,
  imports: [TranslatePipe],  // ← Add this
  template: `
    <!-- Simple translation -->
    <h1>{{ 'home.hero.title' | translate }}</h1>

    <!-- With parameters -->
    <p>{{ 'common.greeting' | translate:{ name: userName } }}</p>

    <!-- Buttons -->
    <button>{{ 'common.buttons.save' | translate }}</button>
  `
})
export class MyComponent {
  userName = 'John';
}
```

### **Method 2: In TypeScript**

```typescript
import { Component, inject } from '@angular/core';
import { TranslationService } from '@core/i18n/services/translation.service';

@Component({
  selector: 'app-my-component',
  template: `<div>{{ translatedText }}</div>`
})
export class MyComponent {
  private translationService = inject(TranslationService);

  translatedText = this.translationService.translate('common.welcome');

  // With parameters
  greeting = this.translationService.translate('common.greeting', {
    name: 'Alice'
  });
}
```

---

## ➕ **ADDING NEW TRANSLATIONS**

### **Step 1: Add Key to Translation Files**

Navigate to: `/apps/mobile/src/assets/i18n/modular/{locale}/`

**Example: Add new button text**

```json
// en/common.json
{
  "buttons": {
    "save": "Save",
    "cancel": "Cancel",
    "new_action": "New Action"  // ← Add this
  }
}

// de/common.json
{
  "buttons": {
    "save": "Speichern",
    "cancel": "Abbrechen",
    "new_action": "Neue Aktion"  // ← Add this
  }
}

// np/common.json
{
  "buttons": {
    "save": "सुरक्षित गर्नुहोस्",
    "cancel": "रद्द गर्नुहोस्",
    "new_action": "नयाँ कार्य"  // ← Add this
  }
}
```

### **Step 2: Use in Component**

```html
<button>{{ 'common.buttons.new_action' | translate }}</button>
```

### **Step 3: Done! 🎉**

No rebuild needed. The app will load the new translations automatically.

---

## 🌍 **CHANGING LANGUAGE**

### **User-Triggered (Language Selector)**

Already implemented! The language selector in the header automatically triggers translation updates.

```typescript
// This is already done in LanguageSelectorComponent
async selectLanguage(locale: string): Promise<void> {
  await this.localeFacade.setLocale(locale);
  // ✨ Translations update automatically
}
```

### **Programmatic Change**

```typescript
import { inject } from '@angular/core';
import { LocaleDetectionFacade } from '@presentation/facades/locale-detection.facade';

export class MyComponent {
  private localeFacade = inject(LocaleDetectionFacade);

  async changeToGerman(): Promise<void> {
    await this.localeFacade.setLocale('de');
    // ✨ Entire app updates to German
  }
}
```

### **Supported Languages**

- `en` - English 🇺🇸
- `de` - German (Deutsch) 🇩🇪
- `np` - Nepali (नेपाली) 🇳🇵

---

## 🏗️ **ARCHITECTURE OVERVIEW**

### **Translation File Structure**

```
/assets/i18n/
├── modular/               ← Core translations
│   ├── en/
│   │   ├── common.json    ← Buttons, labels, validation
│   │   ├── navigation.json ← Menu items
│   │   └── footer.json    ← Footer links
│   ├── de/
│   └── np/
└── pages/                 ← Page-specific translations
    └── home/
        ├── en.json        ← Home page text
        ├── de.json
        └── np.json
```

### **Translation Key Hierarchy**

```
common.welcome              ← Core translation
navigation.home             ← Navigation item
home.hero.title             ← Page-specific
common.buttons.save         ← Nested key
```

### **How It Works**

```
User clicks language selector
  ↓
LocaleDetectionFacade.setLocale('de')
  ↓
LocaleStateService updates (emits signal)
  ↓
TranslationService detects change
  ↓
Loads German translations from files
  ↓
TranslatePipe updates in templates
  ↓
UI updates automatically ✨
```

---

## 🧪 **TESTING**

### **Run All Tests**

```bash
nx test mobile
```

### **Run i18n Tests Only**

```bash
nx test mobile --testPathPattern=i18n
```

### **Test Coverage**

- **LocaleStateService**: 25 unit tests ✅
- **TranslationService**: 30 unit tests ✅
- **Total**: 55 comprehensive tests

---

## 🔧 **TROUBLESHOOTING**

### **Problem: Translation Key Not Found**

**Symptom**: Seeing `home.hero.title` instead of actual text

**Solution**:
1. Check if translation file exists: `/assets/i18n/modular/en/common.json`
2. Verify the key structure matches: `{ "home": { "hero": { "title": "..." } } }`
3. Check browser console for warnings
4. Try clearing cache: `service.clearCache()`

### **Problem: Language Change Not Working**

**Symptom**: Clicking language selector doesn't update UI

**Solution**:
1. Check browser console for errors
2. Verify translation files exist for that language
3. Ensure component imports `TranslatePipe`
4. Check if `LocaleStateService` is updating (browser console logs)

### **Problem: Parameters Not Interpolating**

**Symptom**: Seeing `Hello, {{name}}!` instead of `Hello, John!`

**Solution**:
```typescript
// ❌ Wrong
{{ 'greeting' | translate }}

// ✅ Correct
{{ 'greeting' | translate:{ name: userName } }}
```

### **Problem: Build Errors**

**Symptom**: TypeScript compilation errors

**Solution**:
```bash
# Clear nx cache
nx reset

# Rebuild
nx build mobile

# If still failing, check:
# 1. All imports are correct
# 2. No circular dependencies
# 3. TranslatePipe is imported where used
```

---

## 📝 **COMMON PATTERNS**

### **Pattern 1: Conditional Translation**

```typescript
getMessage() {
  const key = this.isError ? 'common.error' : 'common.success';
  return this.translationService.translate(key);
}
```

### **Pattern 2: Dynamic Parameters**

```html
<p>{{ 'common.items_count' | translate:{ count: items.length } }}</p>
```

**Translation file**:
```json
{
  "items_count": "You have {{count}} items"
}
```

### **Pattern 3: Pluralization**

```json
{
  "votes_count": {
    "zero": "No votes",
    "one": "1 vote",
    "other": "{{count}} votes"
  }
}
```

```typescript
getVotesText(count: number): string {
  if (count === 0) return this.translate('votes_count.zero');
  if (count === 1) return this.translate('votes_count.one');
  return this.translate('votes_count.other', { count });
}
```

### **Pattern 4: Preload Translations**

```typescript
async ngOnInit() {
  // Preload translations for better UX
  await this.translationService.preloadRoutes([
    '/dashboard',
    '/elections',
    '/profile'
  ]);
}
```

---

## 🎨 **DESIGN PRESERVATION**

### **OKLCH Colors Maintained** ✅

All existing OKLCH color values are preserved:

```css
/* Header background */
background: oklch(0.98 0.02 260);

/* Button hover */
background: oklch(0.96 0.03 260);
```

**Zero visual regressions** - Your design system is intact!

---

## 📚 **ADDITIONAL RESOURCES**

### **Key Files**

- **Translation Files**: `/apps/mobile/src/assets/i18n/`
- **LocaleStateService**: `/apps/mobile/src/app/core/i18n/services/locale-state.service.ts`
- **TranslationService**: `/apps/mobile/src/app/core/i18n/services/translation.service.ts`
- **TranslatePipe**: `/apps/mobile/src/app/core/i18n/pipes/translate.pipe.ts`

### **Documentation**

- **Implementation Guide**: `IMPLEMENTATION_COMPLETE.md`
- **Critical Fixes**: `CRITICAL_FIXES_COMPLETE.md`
- **Architecture Decisions**: `20251123_1013_claude_instructions_language_implementation.md`

---

## ✅ **QUICK CHECKLIST**

Before deploying:

- [x] Build succeeds: `nx build mobile`
- [x] Tests pass: `nx test mobile`
- [x] Translation files exist for all languages
- [x] Language selector works in UI
- [x] No TypeScript errors
- [x] DDD boundaries respected

**Status**: ✅ All checks passed - Ready for deployment!

---

**Need Help?** Check the comprehensive documentation in:
- `IMPLEMENTATION_COMPLETE.md` - Full implementation details
- `CRITICAL_FIXES_COMPLETE.md` - Debugging and fixes

**Happy Translating!** 🌍✨
