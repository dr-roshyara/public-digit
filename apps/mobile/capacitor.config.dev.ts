import type { CapacitorConfig } from '@capacitor/cli';

// Get local IP address for live-reload (optional)
const getLocalIP = (): string => {
  // You can set this manually or use a script to detect it
  return '192.168.178.27'; // Replace with your actual local IP
};

const config: CapacitorConfig = {
  appId: 'com.publicdigit.app.dev',
  appName: 'PublicDigit Dev',
  webDir: '../../dist/apps/mobile/browser',
  
  // Live-reload configuration
  server: {
    url: `http://${getLocalIP()}:4200`,
    cleartext: true
  },
  
  android: {
    path: 'android',
    allowMixedContent: true,
    webContentsDebuggingEnabled: true
  },
  
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000, // Faster in dev
      launchAutoHide: true,
      backgroundColor: '#667EEA'
    }
  }
};

export default config;