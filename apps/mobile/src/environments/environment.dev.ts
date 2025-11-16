/**
 * Auto-detect API URL based on environment
 */
function getApiUrl(): string {
  // Check if running on mobile (Capacitor)
  const isMobile = !!(window as any).Capacitor;

  if (!isMobile) {
    // Running in browser - use localhost
    console.log('🌐 Environment: Browser (localhost)');
    return 'http://localhost:8000/api/v1';
  }

  // Running on mobile device
  const platform = (window as any).Capacitor?.getPlatform?.() || 'web';

  if (platform === 'android') {
    // Android Emulator uses 10.0.2.2 to access host machine
    // Physical devices use your computer's local IP

    console.log('📱 Environment: Android Emulator (10.0.2.2)');
    return 'http://10.0.2.2:8000/api/v1';  // Android Emulator

    // Uncomment below and comment above if using Physical Device:
    // console.log('📱 Environment: Physical Android Device (192.168.178.27)');
    // return 'http://192.168.178.27:8000/api/v1';
  }

  // Fallback to localhost
  console.log('⚠️ Environment: Unknown, using localhost');
  return 'http://localhost:8000/api/v1';
}

export const environment = {
  production: false,
  appId: 'com.publicdigit.app.dev',
  appName: 'PublicDigit Dev',

  // Auto-detected API URL based on platform
  apiUrl: getApiUrl(),

  version: '1.0.0-dev'
};