import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.publicdigit.app',
  appName: 'PublicDigit',
  webDir: '../../dist/apps/mobile/browser',
  
  server: {
    androidScheme: 'https',
    hostname: 'localhost',
    cleartext: true
  },
  
  android: {
    path: 'android',
    allowMixedContent: true,
    webContentsDebuggingEnabled: true
  },
  
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#2563eb', // PublicDigit Primary Blue
      showSpinner: false
    },

    StatusBar: {
      style: 'LIGHT', // or 'DARK'
      backgroundColor: '#2563eb', // PublicDigit Primary Blue - Trust & Security
      overlaysWebView: false, // Don't overlay - this is important!
      translucent: false // Opaque status bar
    }
  }
};

export default config; 