import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LocaleDetectionFacade, LocaleOption } from '@presentation/facades/locale-detection.facade';

@Component({
  selector: 'pd-language-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="language-selector" [class.loading]="localeFacade.isLoading()">
      <!-- Current Language Display -->
      <div class="current-language" (click)="toggleDropdown()">
        <span class="flag">{{ getCurrentLocaleOption()?.flag }}</span>
        <span class="name">{{ getCurrentLocaleOption()?.nativeName }}</span>
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
  `,
  styles: [`
    /* PRODUCTION FIX: Explicit host display to ensure custom element is visible */
    :host {
      display: block;
      width: 100%;
    }

    .language-selector {
      position: relative;
      display: inline-block;
      width: 100%;
      isolation: isolate;  /* CRITICAL: Create new stacking context to escape parent z-index limitations */
      z-index: 1000;       /* Higher than header buttons */
      /* DEBUG: Temporary border for visibility check */
      /* border: 2px solid red !important; */
    }

    .current-language {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      /* FALLBACK COLORS: Use standard CSS colors for better browser support */
      background: rgba(248, 250, 252, 1);
      background: oklch(0.98 0.02 260);
      border: 1px solid rgba(226, 232, 240, 1);
      border: 1px solid oklch(0.90 0.05 260);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      min-height: 44px;  /* Touch-friendly height */
      /* DEBUG: Temporary border for visibility check */
      /* border: 2px solid blue !important; */
    }

    .current-language:hover {
      background: rgba(241, 245, 249, 1);
      background: oklch(0.96 0.03 260);
      border-color: rgba(203, 213, 225, 1);
      border-color: oklch(0.85 0.07 260);
    }

    .current-language .flag {
      font-size: 1.3em;
      line-height: 1;
    }

    .current-language .name {
      font-weight: 500;
      color: rgba(51, 65, 85, 1);
      color: oklch(0.30 0.05 260);
      flex: 1;
      white-space: nowrap;
    }

    .current-language .chevron {
      font-size: 0.75em;
      color: rgba(100, 116, 139, 1);
      color: oklch(0.50 0.05 260);
      margin-left: 4px;
      line-height: 1;
    }

    .dropdown-menu {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 1px solid rgba(226, 232, 240, 1);
      border: 1px solid oklch(0.90 0.05 260);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      box-shadow: 0 4px 12px oklch(0 0 0 / 0.1);
      margin-top: 4px;
      min-width: 200px;
      z-index: 10050;              /* CRITICAL: Higher than any header element to escape stacking contexts */
      transform: translateZ(0);    /* Hardware acceleration - force GPU layer */
      will-change: transform;      /* Performance hint for browser optimization */
      /* DEBUG: Temporary border for visibility check */
      /* border: 2px solid green !important; */
    }

    .dropdown-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      cursor: pointer;
      transition: background-color 0.2s ease;
      min-height: 48px;  /* Touch-friendly height */
    }

    .dropdown-item:hover {
      background-color: rgba(248, 250, 252, 1);
      background-color: oklch(0.98 0.02 260);
    }

    .dropdown-item.active {
      background-color: rgba(241, 245, 249, 1);
      background-color: oklch(0.96 0.04 260);
      font-weight: 600;
    }

    .dropdown-item:first-child {
      border-top-left-radius: 7px;
      border-top-right-radius: 7px;
    }

    .dropdown-item:last-child {
      border-bottom-left-radius: 7px;
      border-bottom-right-radius: 7px;
    }

    .dropdown-item .flag {
      font-size: 1.3em;
      line-height: 1;
    }

    .dropdown-item .name {
      flex: 1;
      color: rgba(51, 65, 85, 1);
      color: oklch(0.30 0.05 260);
    }

    .dropdown-item .badge {
      font-size: 0.7em;
      padding: 3px 8px;
      background: rgba(226, 232, 240, 1);
      background: oklch(0.90 0.05 260);
      border-radius: 4px;
      color: rgba(71, 85, 105, 1);
      color: oklch(0.40 0.05 260);
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    .dropdown-item.auto-detect .badge {
      background: rgba(191, 219, 254, 1);
      background: oklch(0.85 0.15 200);
      color: rgba(29, 78, 216, 1);
      color: oklch(0.30 0.15 200);
    }

    .language-selector.loading {
      opacity: 0.6;
      pointer-events: none;
    }

    /* Mobile responsive improvements */
    @media (max-width: 767px) {
      :host {
        width: 100%;
      }

      .language-selector {
        width: 100%;
      }

      .current-language {
        justify-content: center;
        width: 100%;
      }

      .dropdown-menu {
        width: 100%;
        left: 0;
        right: auto;
      }
    }

    /* Desktop improvements */
    @media (min-width: 768px) {
      :host {
        width: auto;
        min-width: 160px;
      }

      .language-selector {
        width: auto;
        min-width: 160px;
      }

      .dropdown-menu {
        left: auto;
        right: 0;
        width: auto;
        min-width: 200px;
      }
    }
  `]
})
export class LanguageSelectorComponent {
  readonly localeFacade = inject(LocaleDetectionFacade);
  private readonly _isDropdownOpen = signal(false);
  readonly isDropdownOpen = this._isDropdownOpen.asReadonly();
  readonly availableLocales = computed(() => this.getAvailableLocaleOptions());

  constructor() {
    // DEBUG LOGGING: Verify component initialization
    console.log('🔧 [LanguageSelector] Component initialized');
    console.log('🌐 [LanguageSelector] Available locales:', this.availableLocales());
    console.log('🏳️  [LanguageSelector] Current locale:', this.localeFacade.currentLocale());
    console.log('📊 [LanguageSelector] Is loading:', this.localeFacade.isLoading());
    console.log('👤 [LanguageSelector] Has user preference:', this.localeFacade.hasUserPreference());
    console.log('🎯 [LanguageSelector] Current option:', this.getCurrentLocaleOption());
  }

  toggleDropdown(): void {
    console.log('🔄 [LanguageSelector] Toggling dropdown, current state:', this._isDropdownOpen());
    this._isDropdownOpen.update(open => !open);
    console.log('✅ [LanguageSelector] New dropdown state:', this._isDropdownOpen());
  }

  async selectLanguage(locale: string): Promise<void> {
    console.log(`🎯 [LanguageSelector] Selecting language: ${locale}`);
    this._isDropdownOpen.set(false);

    try {
      await this.localeFacade.setLocale(locale);
      console.log(`✅ [LanguageSelector] Language set to: ${locale}`);
    } catch (error) {
      console.error('❌ [LanguageSelector] Failed to set language:', error);
    }
  }

  async resetToAutoDetect(): Promise<void> {
    console.log('🔄 [LanguageSelector] Resetting to auto-detect');
    this._isDropdownOpen.set(false);

    try {
      await this.localeFacade.resetToAutoDetect();
      console.log('✅ [LanguageSelector] Reset to auto-detect complete');
    } catch (error) {
      console.error('❌ [LanguageSelector] Failed to reset to auto-detect:', error);
    }
  }

  getCurrentLocaleOption(): LocaleOption | undefined {
    const currentCode = this.localeFacade.currentLocale();
    const option = this.availableLocales().find(opt => opt.code === currentCode);

    if (!option) {
      console.warn(`⚠️  [LanguageSelector] No option found for locale: ${currentCode}, using default`);
      return this.availableLocales()[0]; // Fallback to first option (English)
    }

    return option;
  }

  private getAvailableLocaleOptions(): LocaleOption[] {
    return [
      { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', isDefault: true },
      { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
      { code: 'np', name: 'Nepali', nativeName: 'नेपाली', flag: '🇳🇵' }
    ];
  }
}
