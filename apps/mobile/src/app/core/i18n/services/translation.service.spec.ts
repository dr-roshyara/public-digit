/**
 * TranslationService - Unit Tests
 *
 * TDD APPROACH - Testing Application Layer
 *
 * Tests cover:
 * - Translation retrieval with parameter interpolation
 * - Route-based translation loading
 * - Locale change handling
 * - Router integration
 * - Reactive signal updates
 * - Error handling and fallbacks
 */

import { TestBed } from '@angular/core/testing';
import { Router, NavigationEnd } from '@angular/router';
import { Subject } from 'rxjs';
import { TranslationService } from './translation.service';
import { RouteFirstTranslationLoader } from '../route-first.loader';
import { LocaleStateService } from './locale-state.service';

describe('TranslationService', () => {
  let service: TranslationService;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockLoader: jasmine.SpyObj<RouteFirstTranslationLoader>;
  let mockLocaleState: jasmine.SpyObj<LocaleStateService>;
  let routerEventsSubject: Subject<any>;

  beforeEach(() => {
    // Create mock router with events subject
    routerEventsSubject = new Subject();
    mockRouter = jasmine.createSpyObj('Router', [], {
      events: routerEventsSubject.asObservable(),
      url: '/'
    });

    // Create mock loader
    mockLoader = jasmine.createSpyObj('RouteFirstTranslationLoader', [
      'loadPageTranslations',
      'ensureCoreTranslationsLoaded',
      'loadCoreTranslations',
      'loadPageTranslationsForRoute',
      'preloadRoutes',
      'clearTranslationCache'
    ]);

    // Create mock locale state
    mockLocaleState = jasmine.createSpyObj('LocaleStateService', [
      'getCurrentLocale',
      'setLocale'
    ], {
      currentLocale: jasmine.createSpy('currentLocale').and.returnValue('en')
    });

    TestBed.configureTestingModule({
      providers: [
        TranslationService,
        { provide: Router, useValue: mockRouter },
        { provide: RouteFirstTranslationLoader, useValue: mockLoader },
        { provide: LocaleStateService, useValue: mockLocaleState }
      ]
    });

    // Setup default mock responses
    mockLoader.loadCoreTranslations.and.returnValue(Promise.resolve({
      common: { welcome: 'Welcome', save: 'Save' },
      navigation: { home: 'Home', dashboard: 'Dashboard' },
      footer: { copyright: '© 2025 Public Digit' }
    }));

    mockLoader.loadPageTranslationsForRoute.and.returnValue(Promise.resolve({
      home: { hero: { title: 'Welcome Home' } }
    }));

    mockLoader.ensureCoreTranslationsLoaded.and.returnValue(Promise.resolve());
    mockLoader.loadPageTranslations.and.returnValue(Promise.resolve());
    mockLoader.preloadRoutes.and.returnValue(Promise.resolve());
    mockLocaleState.getCurrentLocale.and.returnValue('en');

    service = TestBed.inject(TranslationService);
  });

  describe('Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize successfully', async () => {
      // Act
      await service.initialize();

      // Assert
      expect(mockLoader.loadPageTranslations).toHaveBeenCalledWith('/');
      expect(mockLoader.preloadRoutes).toHaveBeenCalled();
    });

    it('should not initialize twice', async () => {
      // Act
      await service.initialize();
      await service.initialize();

      // Assert
      expect(mockLoader.loadPageTranslations).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization errors gracefully', async () => {
      // Arrange
      mockLoader.loadPageTranslations.and.returnValue(Promise.reject(new Error('Load failed')));

      // Act & Assert (should not throw)
      await expectAsync(service.initialize()).toBeResolved();
      expect(service.error()).toContain('Load failed');
    });

    it('should preload common routes after initialization', async () => {
      // Act
      await service.initialize();

      // Assert
      expect(mockLoader.preloadRoutes).toHaveBeenCalledWith([
        '/dashboard',
        '/login',
        '/register'
      ]);
    });
  });

  describe('translate()', () => {
    beforeEach(async () => {
      // Setup translations
      await service.initialize();
    });

    it('should translate simple key', () => {
      // Act
      const result = service.translate('common.welcome');

      // Assert
      expect(result).toBe('Welcome');
    });

    it('should translate nested key', () => {
      // Act
      const result = service.translate('home.hero.title');

      // Assert
      expect(result).toBe('Welcome Home');
    });

    it('should return key if translation not found', () => {
      // Act
      const result = service.translate('non.existent.key');

      // Assert
      expect(result).toBe('non.existent.key');
    });

    it('should interpolate parameters', () => {
      // Arrange - Mock translation with placeholder
      mockLoader.loadCoreTranslations.and.returnValue(Promise.resolve({
        common: { greeting: 'Hello, {{name}}!' }
      }));

      // Act
      const result = service.translate('common.greeting', { name: 'John' });

      // Assert
      expect(result).toBe('Hello, John!');
    });

    it('should handle multiple parameters', () => {
      // Arrange
      mockLoader.loadCoreTranslations.and.returnValue(Promise.resolve({
        common: { message: '{{user}} has {{count}} items' }
      }));

      // Act
      const result = service.translate('common.message', { user: 'Alice', count: '5' });

      // Assert
      expect(result).toBe('Alice has 5 items');
    });

    it('should handle missing parameters gracefully', () => {
      // Arrange
      mockLoader.loadCoreTranslations.and.returnValue(Promise.resolve({
        common: { greeting: 'Hello, {{name}}!' }
      }));

      // Act
      const result = service.translate('common.greeting', {});

      // Assert
      expect(result).toBe('Hello, {{name}}!'); // Placeholder remains
    });

    it('should warn when translation key not found', () => {
      // Arrange
      const spy = spyOn(console, 'warn');

      // Act
      service.translate('missing.key');

      // Assert
      expect(spy).toHaveBeenCalledWith(jasmine.stringContaining('Translation key not found'));
    });
  });

  describe('setLanguage()', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should update locale state', async () => {
      // Act
      await service.setLanguage('de');

      // Assert
      expect(mockLocaleState.setLocale).toHaveBeenCalledWith('de', 'user');
    });

    it('should set loading state during language change', async () => {
      // Arrange
      let loadingStatesDuring: boolean[] = [];

      // Monitor loading state
      const subscription = service.isLoading.subscribe(loading => {
        loadingStatesDuring.push(loading);
      });

      // Act
      await service.setLanguage('de');

      // Assert
      expect(loadingStatesDuring).toContain(true); // Was loading
      expect(service.isLoading()).toBe(false); // No longer loading
      subscription.unsubscribe();
    });

    it('should handle language change errors', async () => {
      // Arrange
      mockLocaleState.setLocale.and.throwError('Change failed');

      // Act & Assert
      await expectAsync(service.setLanguage('de')).toBeRejected();
      expect(service.error()).toContain('Failed to change language');
    });
  });

  describe('Router Integration', () => {
    it('should load translations on route change', async () => {
      // Arrange
      await service.initialize();
      mockLoader.loadPageTranslations.calls.reset();

      // Act
      routerEventsSubject.next(new NavigationEnd(1, '/dashboard', '/dashboard'));

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert
      expect(mockLoader.loadPageTranslations).toHaveBeenCalledWith('/dashboard');
    });

    it('should not load translations for non-NavigationEnd events', async () => {
      // Arrange
      await service.initialize();
      mockLoader.loadPageTranslations.calls.reset();

      // Act
      routerEventsSubject.next({ type: 'NavigationStart' }); // Not NavigationEnd

      // Wait
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert
      expect(mockLoader.loadPageTranslations).not.toHaveBeenCalled();
    });
  });

  describe('preloadRoutes()', () => {
    it('should preload specified routes', async () => {
      // Act
      await service.preloadRoutes(['/elections', '/profile']);

      // Assert
      expect(mockLoader.preloadRoutes).toHaveBeenCalledWith(['/elections', '/profile']);
    });

    it('should handle preload errors gracefully', async () => {
      // Arrange
      mockLoader.preloadRoutes.and.returnValue(Promise.reject(new Error('Preload failed')));

      // Act & Assert (should not throw)
      await expectAsync(service.preloadRoutes(['/test'])).toBeResolved();
    });
  });

  describe('clearCache()', () => {
    it('should clear translation loader cache', () => {
      // Act
      service.clearCache();

      // Assert
      expect(mockLoader.clearTranslationCache).toHaveBeenCalled();
    });

    it('should clear translations signal', () => {
      // Act
      service.clearCache();

      // Assert
      expect(service.translations()).toEqual({});
    });
  });

  describe('getCurrentLocale()', () => {
    it('should return current locale from state service', () => {
      // Arrange
      mockLocaleState.getCurrentLocale.and.returnValue('np');

      // Act
      const locale = service.getCurrentLocale();

      // Assert
      expect(locale).toBe('np');
    });
  });

  describe('Reactive Signals', () => {
    it('should expose currentLocale computed signal', () => {
      // Arrange
      mockLocaleState.currentLocale.and.returnValue('de');

      // Act
      const locale = service.currentLocale();

      // Assert
      expect(locale).toBe('de');
    });

    it('should expose translations readonly signal', () => {
      // Act
      const translations = service.translations();

      // Assert
      expect(translations).toBeDefined();
    });

    it('should expose isLoading readonly signal', () => {
      // Act
      const loading = service.isLoading();

      // Assert
      expect(loading).toBe(false);
    });

    it('should expose error readonly signal', () => {
      // Act
      const error = service.error();

      // Assert
      expect(error).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid language changes', async () => {
      // Arrange
      await service.initialize();

      // Act
      await service.setLanguage('de');
      await service.setLanguage('np');
      await service.setLanguage('en');

      // Assert
      expect(mockLocaleState.setLocale).toHaveBeenCalledTimes(3);
    });

    it('should handle empty translation key', () => {
      // Act
      const result = service.translate('');

      // Assert
      expect(result).toBe('');
    });

    it('should handle null params in translate', () => {
      // Act & Assert (should not throw)
      expect(() => service.translate('common.welcome', undefined)).not.toThrow();
    });
  });
});
