/**
 * Vue.js Integration Example
 *
 * This example shows how to integrate the geo-location package in a Vue.js application
 */

import { ref, reactive, onMounted, onUnmounted } from 'vue';
import type { Ref } from 'vue';

// Import from shared geo-location package
import {
  UnifiedGeoLocationFacade,
  GeoFacadeFactoryService,
  GeoTranslationBridgeService,
  CountryDetectionService
} from '../index';

interface GeoLocationState {
  currentLocale: string;
  detectedLocale: string;
  source: string;
  status: string;
  error: string | null;
}

export function useGeoLocationIntegration() {
  // Reactive state
  const state: Ref<GeoLocationState> = ref({
    currentLocale: 'en',
    detectedLocale: 'en',
    source: 'default',
    status: 'idle',
    error: null
  });

  const geoFacade = ref<UnifiedGeoLocationFacade | null>(null);
  const translationBridge = ref<GeoTranslationBridgeService | null>(null);

  // ======== PUBLIC API ========

  /**
   * Initialize automatic language detection
   */
  const initializeAutomaticLanguageDetection = async (): Promise<void> => {
    if (!translationBridge.value) return;

    try {
      state.value.status = 'detecting';

      await translationBridge.value.initializeAutomaticLanguageDetection().toPromise();

      // Subscribe to state changes
      const stateSub = translationBridge.value.state$.subscribe(bridgeState => {
        state.value = { ...state.value, ...bridgeState };
      });

      // Cleanup on unmount
      onUnmounted(() => {
        stateSub.unsubscribe();
      });

    } catch (error) {
      state.value.status = 'error';
      state.value.error = 'Failed to initialize language detection';
    }
  };

  /**
   * Manually set language preference
   */
  const setLanguagePreference = async (languageCode: string): Promise<void> => {
    if (!translationBridge.value) return;

    try {
      state.value.status = 'applying';

      const success = await translationBridge.value.setLanguagePreference(languageCode).toPromise();

      if (success) {
        state.value.currentLocale = languageCode;
        state.value.source = 'user-preference';
        state.value.status = 'success';
      }
    } catch (error) {
      state.value.status = 'error';
      state.value.error = 'Failed to set language preference';
    }
  };

  /**
   * Clear user preference and enable auto-detection
   */
  const clearUserPreference = async (): Promise<void> => {
    if (!translationBridge.value) return;

    try {
      await translationBridge.value.clearUserPreference().toPromise();
    } catch (error) {
      state.value.status = 'error';
      state.value.error = 'Failed to clear user preference';
    }
  };

  /**
   * Get current country code
   */
  const getCurrentCountry = (): string | null => {
    // This would be implemented with proper reactive subscription
    return geoFacade.value?.countryCode$.getValue()?.toString() || null;
  };

  // ======== INITIALIZATION ========

  const initialize = (): void => {
    // Create services using factory
    const countryDetectionService = GeoFacadeFactoryService.createCountryDetectionService();

    // Note: In a real Vue app, you would inject the existing geo facade
    // For this example, we'll create a mock or use the factory
    const existingGeoFacade = {} as any; // This would be properly injected

    geoFacade.value = GeoFacadeFactoryService.createForLaravelFrontend(
      existingGeoFacade,
      countryDetectionService
    );

    translationBridge.value = new GeoTranslationBridgeService(geoFacade.value);

    // Initialize on mount
    onMounted(() => {
      initializeAutomaticLanguageDetection();
    });
  };

  // Initialize the service
  initialize();

  return {
    state: state as Readonly<Ref<GeoLocationState>>,
    initializeAutomaticLanguageDetection,
    setLanguagePreference,
    clearUserPreference,
    getCurrentCountry
  };
}

// Example usage in a Vue component
export default {
  name: 'LanguageSelector',
  setup() {
    const {
      state,
      initializeAutomaticLanguageDetection,
      setLanguagePreference,
      clearUserPreference,
      getCurrentCountry
    } = useGeoLocationIntegration();

    const setLanguage = async (languageCode: string) => {
      await setLanguagePreference(languageCode);
    };

    const enableAutoDetection = async () => {
      await clearUserPreference();
    };

    return {
      state,
      setLanguage,
      enableAutoDetection,
      getCurrentCountry
    };
  },
  template: `
    <div class="language-selector">
      <div class="current-language">
        Current Language: {{ state.currentLocale }}
      </div>

      <div class="detection-info" v-if="state.source === 'geo-detection'">
        🎯 Auto-detected based on your location
      </div>

      <div class="language-buttons">
        <button @click="setLanguage('en')">English</button>
        <button @click="setLanguage('de')">German</button>
        <button @click="setLanguage('np')">Nepali</button>
      </div>

      <div class="auto-detection" v-if="state.source !== 'geo-detection'">
        <button @click="enableAutoDetection">Enable Auto-Detection</button>
      </div>

      <div class="status" :class="state.status">
        Status: {{ state.status }}
      </div>

      <div class="error" v-if="state.error">
        Error: {{ state.error }}
      </div>
    </div>
  `
};