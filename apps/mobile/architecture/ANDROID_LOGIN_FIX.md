# Android Login Fix - Summary

## Problem
Android app couldn't login because `localhost` doesn't work on Android devices:
- **Android Emulator**: `localhost` refers to the emulator itself, not your computer
- **Physical Device**: Can't access `localhost` at all

## Solutions Applied

### 1. Updated API URL (environment.ts) ✅
**File**: `apps/mobile/src/environments/environment.ts`

Changed from:
```typescript
apiUrl: 'http://localhost:8000/api/v1'
```

To:
```typescript
apiUrl: 'http://10.0.2.2:8000/api/v1'  // For Android Emulator
```

**For Physical Device**, change to:
```typescript
apiUrl: 'http://192.168.178.27:8000/api/v1'  // Your computer's IP
```

### 2. Created Network Security Config ✅
**File**: `apps/mobile/android/app/src/main/res/xml/network_security_config.xml`

Allows HTTP (cleartext) traffic for development with these domains:
- `10.0.2.2` - Android Emulator
- `192.168.178.27` - Your local IP
- `localhost`, `127.0.0.1` - For other platforms

### 3. Updated AndroidManifest.xml ✅
**File**: `apps/mobile/android/app/src/main/AndroidManifest.xml`

Added:
```xml
android:usesCleartextTraffic="true"
android:networkSecurityConfig="@xml/network_security_config"
```

### 4. Fixed CORS Configuration ✅
**File**: `packages/laravel-backend/config/cors.php`

Added allowed origins for:
- Android Emulator: `http://10.0.2.2`, `http://10.0.2.2:8000`
- Physical Device: `http://192.168.178.27`, `http://192.168.178.27:8000`
- Capacitor WebView: `capacitor://localhost`

## Steps to Test

### Option 1: Android Emulator (Recommended)

1. **Start Laravel server for Android development**:

   ⚠️ **IMPORTANT**: Must use `--host=0.0.0.0` so Android Emulator can access it!

   ```bash
   cd packages/laravel-backend

   # Windows - Use the provided script:
   serve-dev.bat

   # OR manually:
   php artisan serve --host=0.0.0.0 --port=8000

   # Should show: Server started on http://0.0.0.0:8000
   ```

   **Why?** Laravel's default `php artisan serve` only listens on `127.0.0.1` which Android Emulator cannot access. Using `--host=0.0.0.0` makes it accessible via `10.0.2.2:8000`.

2. **Build and sync for DEVELOPMENT** (Important!):

   **Option A - Using Nx script (Recommended)**:
   ```bash
   # From project root
   nx run mobile:cap:sync:dev
   ```

   **Option B - Manual steps**:
   ```bash
   # Build with development configuration
   nx build mobile --configuration=development

   # OR use npm (from project root)
   npm run build:mobile:dev

   # Then sync to Android
   cd apps/mobile
   npx cap sync android
   ```

3. **Run in Android Studio**:
   - Open Android Studio
   - Open project: `apps/mobile/android`
   - Click Run (green play button) or `Shift + F10`
   - Select Android Emulator

4. **Test Login**:
   - Email: `test@test.com`
   - Password: `password123`

### ⚠️ **IMPORTANT: Build Configuration**

The build configuration determines which API URL is used:

| Configuration | Environment File | API URL |
|--------------|------------------|---------|
| `development` | `environment.dev.ts` | `http://10.0.2.2:8000/api/v1` |
| `production` | `environment.prod.ts` | `https://publicdigit.com/api/v1` |
| `staging` | `environment.staging.ts` | (configure as needed) |

**Default is now set to `development`** - but always specify explicitly!

### Option 2: Physical Android Device

1. **Update environment.dev.ts** (NOT environment.ts):
   ```typescript
   // File: apps/mobile/src/environments/environment.dev.ts
   apiUrl: 'http://192.168.178.27:8000/api/v1'
   ```

2. **Make sure your phone is on the SAME WiFi network** as your computer

3. **Check Laravel is accessible**:
   - Edit `packages/laravel-backend/.env`:
   ```bash
   APP_URL=http://192.168.178.27:8000
   ```

   - Restart Laravel:
   ```bash
   php artisan serve --host=0.0.0.0 --port=8000
   ```

4. **Build and sync with development configuration**:
   ```bash
   nx run mobile:cap:sync:dev
   ```

5. **Connect device via USB** and enable USB debugging

6. **Run from Android Studio** (select your physical device)

## Troubleshooting

### Issue: "HTTP Error 0" or "Connection refused"

This means the Android emulator can't reach your Laravel server.

**Check 1**: Laravel is listening on `0.0.0.0` (not just `127.0.0.1`)
```bash
# Check what Laravel is listening on:
netstat -an | findstr ":8000"

# Should show:
# TCP    0.0.0.0:8000           0.0.0.0:0              LISTENING
# (NOT just TCP 127.0.0.1:8000)

# If it shows 127.0.0.1:8000, restart with:
php artisan serve --host=0.0.0.0 --port=8000
```

**Check 2**: Firewall allows port 8000
```bash
# Windows: Allow port 8000 in Windows Firewall (Run as Administrator)
netsh advfirewall firewall add rule name="Laravel Dev Server" dir=in action=allow protocol=TCP localport=8000
```

**Check 3**: Test connectivity from your computer
```bash
# Test from your computer first:
curl http://localhost:8000/api/v1/health
# Should return JSON

# Test from your local IP:
curl http://192.168.178.27:8000/api/v1/health
# Should also return JSON
```

**Check 4**: Test from emulator's browser (optional)
- Open Chrome in Android Emulator
- Navigate to: `http://10.0.2.2:8000/api/v1/health`
- Should show JSON response

### Issue: "Cleartext HTTP traffic not permitted"

**Solution**: Make sure you've synced the changes
```bash
cd apps/mobile
npx cap sync android
```

Then rebuild in Android Studio: `Build > Clean Project` then `Build > Rebuild Project`

### Issue: CORS errors

**Check**: CORS config is correct
```bash
cd packages/laravel-backend
php artisan config:cache  # Clear and rebuild config cache
```

## Quick Reference

| Platform | API URL to Use |
|----------|----------------|
| Android Emulator | `http://10.0.2.2:8000/api/v1` |
| Physical Device | `http://192.168.178.27:8000/api/v1` |
| iOS Simulator | `http://localhost:8000/api/v1` |
| Web Browser | `http://localhost:8000/api/v1` |

## Test Credentials

```
Email: test@test.com
Password: password123
```

## Verification

After login, you should see:
- Success response with token
- User data in response
- No CORS errors in logcat
- No network security policy violations

---

**Last Updated**: 2025-11-14
**Status**: ✅ Ready for testing
