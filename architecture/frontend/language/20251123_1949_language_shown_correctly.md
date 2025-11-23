```markdown
# Claude Code CLI Prompt Engineering Instructions
## Senior Frontend Engineer - Angular Component Debugging

## CONTEXT
Language selector component not displaying in Angular application. Need systematic debugging approach.

## TECHNICAL STACK
- Angular 17+ (standalone components)
- Signals-based state management
- OKLCH color system
- Mobile-first responsive design
- Facade pattern for locale detection

## DEBUGGING PROMPT STRATEGY

### PHASE 1: INITIAL DIAGNOSIS
```bash
# 1. Check component rendering basics
claude "Analyze the language selector component structure. Check if:
- Component selector 'pd-language-selector' is properly used in header template
- All required imports are present in header component
- CSS encapsulation isn't blocking styles
- Component is actually being rendered in DOM

Focus on Angular template syntax and component hierarchy first."
```

### PHASE 2: STYLING DEBUGGING
```bash
# 2. Investigate CSS/display issues  
claude "Add debug CSS to language selector to verify visibility:
- Add bright border colors to key elements
- Check if parent containers have proper display properties
- Verify z-index for dropdown positioning
- Test responsive behavior in mobile view

Use browser dev tools inspection approach to identify hidden/overflow elements."
```

### PHASE 3: STATE MANAGEMENT VERIFICATION
```bash
# 3. Check facade service and signals
claude "Add console logging to verify:
- LanguageSelectorComponent constructor is called
- LocaleDetectionFacade is properly injected
- availableLocales() computed signal returns expected data
- currentLocale() signal has valid value
- isLoading() state doesn't block rendering

Create a minimal test version that bypasses the facade if needed."
```

### PHASE 4: RESPONSIVE DESIGN CHECK
```bash
# 4. Mobile-specific debugging
claude "Focus on mobile header implementation:
- Check if .nav-actions container has proper mobile styling
- Verify language selector isn't being hidden by media queries
- Test hamburger menu interaction with language selector
- Ensure dropdown positioning works on mobile viewport

Provide specific CSS fixes for mobile responsive issues."
```

## COMPREHENSIVE DEBUGGING COMMAND
```bash
claude "As senior frontend engineer, systematically debug the Angular language selector display issue:

COMPONENT RENDERING:
1. Verify 'pd-language-selector' selector is correctly placed in header template
2. Check Angular compiler isn't throwing template errors
3. Confirm component standalone imports are complete

VISIBILITY & STYLING:
1. Add diagnostic borders: red for container, blue for current-language, green for dropdown
2. Check parent container CSS: display, position, z-index, overflow
3. Verify OKLCH colors aren't causing contrast issues
4. Test dropdown absolute positioning relative to viewport

STATE & DATA FLOW:
1. Add constructor logging to verify component instantiation
2. Check LocaleDetectionFacade injection works
3. Verify signals (availableLocales, currentLocale) emit expected values
4. Test isLoading state doesn't create permanent loading overlay

MOBILE RESPONSIVE:
1. Inspect .nav-actions mobile CSS (flex-direction, width)
2. Check media queries aren't hiding the component
3. Verify dropdown menu positioning in mobile layout
4. Test touch interactions work correctly

FACADE INTEGRATION:
1. Create fallback data if facade returns empty
2. Add null-safe operators in template (?.)
3. Implement loading state with skeleton UI
4. Provide graceful degradation if facade fails

DELIVERABLES:
- Specific CSS fixes with debug borders
- Angular template null-safety improvements
- Console logging strategy for diagnosis
- Mobile-responsive positioning fixes
- Facade integration fallback plan"
```

## QUICK FIX SEQUENCE
```bash
# Rapid iteration commands:

claude "Add emergency debug styling: bright colored borders, fixed z-index, and forced display properties to make language selector visible regardless of other CSS"

claude "Create minimal working version: remove facade dependency, use hardcoded locales, focus only on basic display functionality"

claude "Check browser dev tools: inspect element, console errors, CSS computed styles. Provide specific property overrides to fix visibility"

claude "Mobile-first CSS fix: ensure language selector works in hamburger menu with proper flex layout and touch targets"
```

## VERIFICATION PROMPT
```bash
claude "Create verification checklist:
✅ Component appears in DOM inspector
✅ Debug borders visible
✅ Click handlers work
✅ Dropdown toggles open/close
✅ Locale options display
✅ Mobile responsive works
✅ No console errors

Provide step-by-step validation commands for each checkpoint."
```

## EXPERT TROUBLESHOOTING NOTES
- **Angular Specific**: Check ChangeDetection, ViewEncapsulation, standalone imports
- **Signals**: Verify computed() dependencies, async updates
- **CSS**: OKLCH fallbacks, cascade conflicts, mobile viewport units
- **Performance**: OnPush change detection, memoized computations
- **Accessibility**: Screen reader support, keyboard navigation, focus management

Use this structured approach to systematically identify and resolve the display issue.
```
Looking at your code, I can see several potential issues that might be causing the language selector not to display correctly. Let me help you troubleshoot and fix this:

## Common Issues and Solutions:

### 1. **CSS Styling Issues**

The language selector might be rendering but not visible due to styling problems. Let's add some debug styling:

```typescript
// In your language-selector.component.ts, temporarily add debug styles:
styles: [`
  .language-selector {
    position: relative;
    display: inline-block;
    border: 2px solid red !important; /* Debug border */
  }

  .current-language {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: oklch(0.98 0.02 260);
    border: 1px solid oklch(0.90 0.05 260);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 2px solid blue !important; /* Debug border */
  }

  /* Rest of your styles... */
`]
```

### 2. **Check Header Component Styling**

Make sure your `header.component.scss` isn't hiding or affecting the language selector:

```scss
// In header.component.scss, ensure proper styling:
.mobile-header {
  position: relative;
  z-index: 1000;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  
  // Ensure language selector is visible
  pd-language-selector {
    display: block;
    position: relative;
  }
}

// Mobile responsive styles
@media (max-width: 768px) {
  .nav-actions {
    flex-direction: column;
    width: 100%;
    gap: 16px;
    
    pd-language-selector {
      width: 100%;
      
      .language-selector {
        width: 100%;
        
        .current-language {
          justify-content: center;
        }
        
        .dropdown-menu {
          right: auto;
          left: 0;
          width: 100%;
        }
      }
    }
  }
}
```

### 3. **Add Debug Logging**

Add console logs to verify the component is working:

```typescript
export class LanguageSelectorComponent {
  readonly localeFacade = inject(LocaleDetectionFacade);
  private readonly _isDropdownOpen = signal(false);
  readonly isDropdownOpen = this._isDropdownOpen.asReadonly();
  readonly availableLocales = computed(() => this.getAvailableLocaleOptions());

  constructor() {
    console.log('🔧 LanguageSelectorComponent - Constructor called');
    console.log('🌐 Available locales:', this.availableLocales());
    console.log('🏳️ Current locale:', this.localeFacade.currentLocale());
  }

  toggleDropdown(): void {
    console.log('🔄 Toggling dropdown, current state:', this._isDropdownOpen());
    this._isDropdownOpen.update(open => !open);
  }

  // ... rest of your methods
}
```

### 4. **Fix Potential Null Reference Issues**

Update your template to handle null cases:

```typescript
template: `
  <div class="language-selector" [class.loading]="localeFacade.isLoading()">
    <!-- Current Language Display -->
    <div class="current-language" (click)="toggleDropdown()">
      <span class="flag">{{ getCurrentLocaleOption()?.flag || '🏳️' }}</span>
      <span class="name">{{ getCurrentLocaleOption()?.nativeName || 'Loading...' }}</span>
      <span class="chevron">{{ isDropdownOpen() ? '▲' : '▼' }}</span>
    </div>

    <!-- Dropdown Menu -->
    @if (isDropdownOpen()) {
      <div class="dropdown-menu">
        <!-- Auto-detect option -->
        @if (localeFacade.hasUserPreference()) {
          <div
            class="dropdown-item auto-detect"
            (click)="resetToAutoDetect()"
          >
            <span class="flag">🌐</span>
            <span class="name">Auto-detect</span>
            <span class="badge">AI</span>
          </div>
        }

        <!-- Available languages -->
        @for (option of availableLocales(); track option.code) {
          <div
            class="dropdown-item"
            [class.active]="localeFacade.currentLocale() === option.code"
            [class.default]="option.isDefault"
            (click)="selectLanguage(option.code)"
          >
            <span class="flag">{{ option.flag }}</span>
            <span class="name">{{ option.nativeName }}</span>
            @if (option.isDefault) {
              <span class="badge">Default</span>
            }
          </div>
        }
      </div>
    }
  </div>
`
```

### 5. **Check Facade Service State**

Make sure your `LocaleDetectionFacade` is properly initialized. Add this to your header component:

```typescript
export class HeaderComponent {
  menuOpen = false;
  private localeFacade = inject(LocaleDetectionFacade);

  constructor() {
    console.log('🏠 HeaderComponent - Locale facade state:', {
      currentLocale: this.localeFacade.currentLocale(),
      isLoading: this.localeFacade.isLoading(),
      hasUserPreference: this.localeFacade.hasUserPreference()
    });
  }

  // ... rest of your methods
}
```

### 6. **Alternative: Simplified Version for Testing**

If the issue persists, try this simplified version:

```typescript
@Component({
  selector: 'pd-language-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="simple-language-selector" style="border: 2px solid green; padding: 8px;">
      <button (click)="toggleDropdown()" style="display: flex; align-items: center; gap: 8px;">
        <span>🌐</span>
        <span>Language</span>
        <span>{{ isDropdownOpen() ? '▲' : '▼' }}</span>
      </button>
      
      @if (isDropdownOpen()) {
        <div style="position: absolute; background: white; border: 1px solid #ccc; margin-top: 4px;">
          <div (click)="selectLanguage('en')">🇺🇸 English</div>
          <div (click)="selectLanguage('de')">🇩🇪 Deutsch</div>
          <div (click)="selectLanguage('np')">🇳🇵 नेपाली</div>
        </div>
      }
    </div>
  `
})
```

### 7. **Check Browser Console**

Open your browser's developer tools and check for:
- JavaScript errors
- CSS loading issues
- Component rendering in Elements tab

### 8. **Verify Component Import**

Make sure the component is properly imported in your module or standalone component:

```typescript
// In your main.ts or module
import { LanguageSelectorComponent } from './path/to/language-selector.component';

// Ensure it's included in imports if needed
```

Try these solutions in order, and the debug borders and console logs should help you identify exactly where the issue is occurring. The most common causes are CSS display issues or the component not being properly initialized due to facade service state.