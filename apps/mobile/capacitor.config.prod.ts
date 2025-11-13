import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.publicdigit.app',
  appName: 'PublicDigit',
  webDir: '../../dist/apps/mobile/browser',
  server: {
    androidScheme: 'https'
  },
  android: {
    path: 'android',
    allowMixedContent: false,
    webContentsDebuggingEnabled: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#667EEA'
    }
  }
};

export default config;