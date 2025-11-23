/**
 * LocaleStateService - Unit Tests
 *
 * TDD APPROACH - Testing Infrastructure Layer
 *
 * Tests cover:
 * - Signal-based state management
 * - Locale change tracking
 * - Source tracking (user, geo-location, auto-detect)
 * - LocalStorage persistence
 * - Event-driven architecture support
 */

import { TestBed } from '@angular/core/testing';
import { LocaleStateService, LocaleChangeEvent } from './locale-state.service';

describe('LocaleStateService', () => {
  let service: LocaleStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LocaleStateService]
    });

    // Clear localStorage before each test
    localStorage.clear();

    service = TestBed.inject(LocaleStateService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with default locale "en"', () => {
      expect(service.getCurrentLocale()).toBe('en');
      expect(service.currentLocale()).toBe('en');
    });

    it('should initialize from localStorage if available', () => {
      // Arrange
      localStorage.setItem('locale', 'de');
      localStorage.setItem('locale_source', 'user');

      // Act
      const newService = TestBed.inject(LocaleStateService);

      // Assert
      expect(newService.getCurrentLocale()).toBe('de');
      expect(newService.lastChangeSource()).toBe('user');
    });

    it('should use default locale if localStorage has invalid value', () => {
      // Arrange
      localStorage.setItem('locale', 'invalid-locale');

      // Act
      const newService = TestBed.inject(LocaleStateService);

      // Assert
      expect(newService.getCurrentLocale()).toBe('en'); // Fallback to default
    });
  });

  describe('setLocale()', () => {
    it('should update current locale', () => {
      // Act
      service.setLocale('de', 'user');

      // Assert
      expect(service.getCurrentLocale()).toBe('de');
      expect(service.currentLocale()).toBe('de');
    });

    it('should track source of locale change', () => {
      // Act
      service.setLocale('np', 'geo-location');

      // Assert
      expect(service.lastChangeSource()).toBe('geo-location');
    });

    it('should persist locale to localStorage', () => {
      // Act
      service.setLocale('de', 'user');

      // Assert
      expect(localStorage.getItem('locale')).toBe('de');
      expect(localStorage.getItem('locale_source')).toBe('user');
    });

    it('should not update if locale is already set to same value', () => {
      // Arrange
      const spy = spyOn(console, 'log');
      service.setLocale('en', 'system');

      // Act
      service.setLocale('en', 'system');

      // Assert
      expect(spy).toHaveBeenCalledWith(jasmine.stringContaining('already set to en'));
    });

    it('should record locale change in history', () => {
      // Act
      service.setLocale('de', 'user');
      service.setLocale('np', 'user');

      // Assert
      const history = service.getLocaleHistory();
      expect(history.length).toBe(2);
      expect(history[0].newLocale).toBe('de');
      expect(history[1].newLocale).toBe('np');
    });

    it('should validate locale and fallback to "en" if invalid', () => {
      // Arrange
      const spy = spyOn(console, 'warn');

      // Act
      service.setLocale('invalid-locale', 'user');

      // Assert
      expect(service.getCurrentLocale()).toBe('en');
      expect(spy).toHaveBeenCalledWith(jasmine.stringContaining('Invalid locale'));
    });

    it('should accept all supported locales', () => {
      const validLocales = ['en', 'de', 'np'];

      validLocales.forEach(locale => {
        service.setLocale(locale, 'system');
        expect(service.getCurrentLocale()).toBe(locale);
      });
    });
  });

  describe('Locale Change History', () => {
    it('should record previousLocale and newLocale', () => {
      // Act
      service.setLocale('de', 'user');

      // Assert
      const history = service.getLocaleHistory();
      expect(history[0].previousLocale).toBe('en');
      expect(history[0].newLocale).toBe('de');
    });

    it('should record source in history', () => {
      // Act
      service.setLocale('np', 'geo-location');

      // Assert
      const history = service.getLocaleHistory();
      expect(history[0].source).toBe('geo-location');
    });

    it('should record timestamp', () => {
      // Act
      const beforeTime = new Date();
      service.setLocale('de', 'user');
      const afterTime = new Date();

      // Assert
      const history = service.getLocaleHistory();
      const timestamp = history[0].timestamp;
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should clear history', () => {
      // Arrange
      service.setLocale('de', 'user');
      service.setLocale('np', 'user');

      // Act
      service.clearHistory();

      // Assert
      expect(service.getLocaleHistory().length).toBe(0);
    });
  });

  describe('Computed Signals', () => {
    it('should compute isUserSelected correctly for user source', () => {
      // Act
      service.setLocale('de', 'user');

      // Assert
      expect(service.isUserSelected()).toBe(true);
    });

    it('should compute isUserSelected as false for auto-detect source', () => {
      // Act
      service.setLocale('de', 'auto-detect');

      // Assert
      expect(service.isUserSelected()).toBe(false);
    });

    it('should compute isUserSelected as false for geo-location source', () => {
      // Act
      service.setLocale('np', 'geo-location');

      // Assert
      expect(service.isUserSelected()).toBe(false);
    });
  });

  describe('resetToDefault()', () => {
    it('should reset locale to "en"', () => {
      // Arrange
      service.setLocale('de', 'user');

      // Act
      service.resetToDefault('system');

      // Assert
      expect(service.getCurrentLocale()).toBe('en');
    });

    it('should record source in history', () => {
      // Act
      service.resetToDefault('system');

      // Assert
      const history = service.getLocaleHistory();
      expect(history[0].source).toBe('system');
    });
  });

  describe('Signal Reactivity', () => {
    it('should emit signal when locale changes', (done) => {
      // Arrange
      let emitted = false;

      // Subscribe to signal changes (using effect in test context)
      TestBed.runInInjectionContext(() => {
        const unsubscribe = service.currentLocale.subscribe(() => {
          if (!emitted) {
            emitted = true;
            expect(service.getCurrentLocale()).toBe('de');
            done();
          }
        });
      });

      // Act
      service.setLocale('de', 'user');
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid locale changes', () => {
      // Act
      service.setLocale('de', 'user');
      service.setLocale('np', 'user');
      service.setLocale('en', 'user');

      // Assert
      expect(service.getCurrentLocale()).toBe('en');
      expect(service.getLocaleHistory().length).toBe(3);
    });

    it('should handle localStorage errors gracefully', () => {
      // Arrange
      spyOn(localStorage, 'setItem').and.throwError('Storage error');

      // Act & Assert (should not throw)
      expect(() => service.setLocale('de', 'user')).not.toThrow();
    });

    it('should handle all valid source types', () => {
      const validSources: Array<LocaleChangeEvent['source']> = [
        'user',
        'auto-detect',
        'geo-location',
        'system'
      ];

      validSources.forEach(source => {
        service.setLocale('en', source);
        expect(service.lastChangeSource()).toBe(source);
      });
    });
  });
});
