# 🎯 **PROFESSIONAL PROMPT: Geo-Location Detection Implementation**

## 📋 **ROLE & CONTEXT**

**You are**: Senior Full-Stack Architect specializing in geo-location services  
**Project**: Public Digit - Multi-tenant political platform  
**Current Status**: Language system working, geo-location temporarily disabled due to circular dependency  
**Goal**: Implement production-grade, privacy-focused geo-location detection with graceful degradation

---

## 🎯 **BUSINESS REQUIREMENTS**

### **Primary Use Case**
- Auto-detect user's country/language for better UX
- Fallback gracefully when location unavailable
- Respect user privacy and permissions
- No intrusive permissions for basic functionality

### **Accuracy Requirements**
- **Country-level**: Essential (for language detection)
- **City-level**: Nice-to-have (for regional content)
- **Street-level**: Not needed (overkill for language)

---

## 🏗️ **ARCHITECTURE CONSTRAINTS**

### **DDD Compliance**
```
Presentation → Application → Domain ← Infrastructure
```

### **Multi-Layer Detection Strategy**
```typescript
interface LocationDetectionStrategy {
  detect(): Promise<DetectionResult>;
  getAccuracy(): 'high' | 'medium' | 'low';
  requiresPermission: boolean;
}
```

---

## 🚀 **IMPLEMENTATION PHASES**

### **PHASE 1: Core Infrastructure (IMMEDIATE)**
```bash
claude implement-phase --phase="geo-core" --focus="
1. Fix circular dependency with lazy injection
2. Implement IP geolocation (no permissions)
3. Add browser language detection
4. Create confidence scoring system
5. Implement comprehensive fallback chain
" --constraints="no-gps-permissions"
```

### **PHASE 2: Enhanced Detection (NEXT)**
```bash
claude implement-phase --phase="enhanced-detection" --focus="
1. WiFi positioning when available
2. Cell tower triangulation basics
3. Improve confidence algorithms
4. Add caching for performance
" --prerequisite="phase1-stable"
```

### **PHASE 3: Premium Features (FUTURE)**
```bash
claude implement-phase --phase="premium" --focus="
1. GPS with explicit user permission
2. Advanced sensor fusion
3. Real-time location updates
4. Battery optimization
" --optional="true"
```

---

## 🔧 **TECHNICAL SPECIFICATIONS**

### **Detection Result Interface**
```typescript
interface GeoDetectionResult {
  coordinates?: {
    latitude: number;
    longitude: number; 
    accuracy: number; // meters
  };
  country: string; // ISO 3166-1
  region?: string; // State/Province
  city?: string;
  locale: string; // IETF language tag
  confidence: number; // 0-1
  source: 'gps' | 'wifi' | 'cell' | 'ip' | 'browser';
  timestamp: Date;
}
```

### **Confidence Scoring Algorithm**
```bash
claude implement-algorithm --name="confidence-scoring" --factors="
- GPS: 0.9 (if available)
- WiFi: 0.7 
- Cell: 0.5
- IP: 0.3
- Browser: 0.1
- Signal strength
- Number of data points
- Historical accuracy
" --output="confidence-engine.ts"
```

---

## 🛡️ **PRIVACY & COMPLIANCE REQUIREMENTS**

### **Data Collection Limits**
```bash
claude implement-privacy --rules="
1. No persistent location storage without consent
2. Country-level precision for language detection
3. Automatic data expiration (30 days max)
4. GDPR/CCPA compliance built-in
5. Anonymous analytics only
" --validation="privacy-audit"
```

### **Permission Handling**
```bash
claude implement-permissions --strategy="progressive-enhancement" --flow="
1. Start with IP/browser (no permissions)
2. Request WiFi/GPS only if user benefits
3. Clear value proposition for permissions
4. Graceful degradation when denied
"
```

---

## 🎯 **EXECUTION COMMANDS**

### **Command 1: Fix Circular Dependency**
```bash
claude fix-dependency --service="GeoLocationPackageAdapter" --strategy="lazy-injection" --changes="
1. Replace constructor injection with inject() getter
2. Add { optional: true } for all package services
3. Implement comprehensive null checking
4. Add browser-based fallback implementations
5. Update all consumers with optional chaining
" --verify="no-circular-errors"
```

### **Command 2: Implement IP Geolocation**
```bash
claude implement-detection --method="ip-geolocation" --features="
1. Free IP geolocation API (ipapi.co, ipgeolocation.io)
2. Rate limiting and caching
3. Fallback to browser timezone/language
4. Error handling for API failures
5. Confidence scoring based on IP data
" --free-tier="true"
```

### **Command 3: Multi-Layer Detection Engine**
```bash
claude implement-engine --name="HybridDetectionEngine" --strategies="
1. IPGeolocationStrategy (primary)
2. BrowserLanguageStrategy (fallback) 
3. WiFiPositioningStrategy (enhanced)
4. ConfidenceFusionStrategy (combiner)
" --pattern="strategy-pattern"
```

### **Command 4: Confidence & Fallback System**
```bash
claude implement-confidence --system="multi-factor" --components="
1. Source reliability scoring
2. Data freshness evaluation
3. Signal strength analysis
4. Historical accuracy tracking
5. Fusion algorithm for combined confidence
" --output="confidence-system.ts"
```

---

## 📊 **TESTING & VALIDATION**

### **Test Scenarios**
```bash
claude test-scenarios --matrix="
- Happy Path: All services available
- Partial Failure: IP API down, browser available
- Complete Failure: No location services
- Permission Denied: User blocks location
- Network Issues: Offline detection
- Edge Cases: VPN, different timezones
" --expected="graceful-degradation"
```

### **Accuracy Validation**
```bash
claude validate-accuracy --methods="
1. Test with known locations (QA team locations)
2. Compare multiple providers
3. Measure confidence vs actual accuracy
4. Validate fallback chain effectiveness
" --target="country-level-95percent"
```

---

## 🚀 **DEPLOYMENT STRATEGY**

### **Feature Flags**
```bash
claude implement-flags --features="
geo_detection_enabled: true
ip_geolocation_enabled: true  
wifi_detection_enabled: false
gps_detection_enabled: false
fallback_chain_enabled: true
" --environment="development,staging,production"
```

### **Progressive Rollout**
```bash
claude implement-rollout --plan="
1. Internal testing (team members)
2. 10% users (monitor performance)
3. 50% users (validate accuracy)
4. 100% users (full deployment)
5. Monitor error rates and user feedback
"
```

---

## 📈 **MONITORING & ANALYTICS**

### **Key Metrics**
```bash
claude implement-monitoring --metrics="
- Detection success rate (%)
- Average confidence score
- Fallback chain usage frequency
- API response times
- Error rates by detection method
- User permission grant rates
" --dashboard="geo-location-metrics"
```

### **Alerting**
```bash
claude implement-alerts --triggers="
- Success rate < 80%
- API latency > 2000ms
- Error rate > 5%
- Confidence score degradation
" --channels="slack,email"
```

---

## 🎯 **SUCCESS CRITERIA**

### **Functional Requirements**
- [ ] Country detection accuracy > 95%
- [ ] Language auto-detection working
- [ ] Graceful degradation when services unavailable
- [ ] No circular dependency errors
- [ ] < 2 second detection time

### **Technical Requirements**
- [ ] DDD architecture compliance
- [ ] Comprehensive test coverage (>80%)
- [ ] Proper error handling and logging
- [ ] Performance optimized (caching, lazy loading)
- [ ] Privacy compliance (GDPR/CCPA)

### **User Experience**
- [ ] No intrusive permission requests for basic features
- [ ] Fast language detection on app load
- [ ] Clear value when requesting enhanced permissions
- [ ] Seamless fallback when location unavailable

---

## 🔧 **IMMEDIATE NEXT ACTION**

**Execute Phase 1 Now:**
```bash
claude execute --phase="1" --priority="circular-fix" --commands="
1. Fix GeoLocationPackageAdapter lazy injection
2. Implement IP geolocation with free API
3. Add browser language fallback
4. Test basic country detection
5. Verify language auto-selection works
"
```

**Expected Delivery Time**: 2-3 hours for Phase 1 complete
# 🚨 **CRITICAL ERROR ANALYSIS & FIX PROMPT**

## 📋 **IMMEDIATE ISSUES IDENTIFIED**

### **Error 1: Architecture Service Connection Refused** ❌
```
GET http://localhost:8000/architecture/frontend-boundaries.json 
net::ERR_CONNECTION_REFUSED
```
**Root Cause**: Laravel backend not running on port 8000

### **Error 2: Missing Translation Files** ❌  
```
GET /assets/i18n/pages/login/de.json 404 (Not Found)
GET /assets/i18n/pages/register/de.json 404 (Not Found)
```
**Root Cause**: Route normalization producing incorrect paths

---

## 🎯 **PROFESSIONAL FIX PROMPT INSTRUCTIONS**

### **ROLE & CONTEXT**
**You are**: Senior Angular DevOps Engineer  
**Current State**: Development environment configuration issues  
**Priority**: Fix blocking errors before geo-location implementation

---

## 🚀 **IMMEDIATE FIX COMMANDS**

### **Command 1: Fix Architecture Service Fallback**
```bash
claude fix-service --service="ArchitectureService" --issue="connection-refused" --strategy="graceful-degradation" --changes="
1. Add connection timeout (5 seconds)
2. Implement local fallback boundaries
3. Cache successful responses
4. Add development mode detection
5. Log appropriate warnings instead of errors
" --verify="no-blocking-errors"
```

### **Command 2: Fix Route Normalization**
```bash
claude debug-routes --issue="incorrect-paths" --analysis="
1. Check current route: /login → what path generated?
2. Verify route normalizer output
3. Check translation file existence
4. Fix path generation logic
" --expected="/login → pages/auth/login/de.json"
```

### **Command 3: Create Missing Translation Files**
```bash
claude create-files --paths="
apps/mobile/src/assets/i18n/pages/auth/login/de.json
apps/mobile/src/assets/i18n/pages/auth/login/en.json
apps/mobile/src/assets/i18n/pages/auth/login/np.json
apps/mobile/src/assets/i18n/pages/auth/register/de.json
apps/mobile/src/assets/i18n/pages/auth/register/en.json
apps/mobile/src/assets/i18n/pages/auth/register/np.json
" --content="minimal-keys"
```

### **Command 4: Environment Configuration**
```bash
claude fix-environment --issues="
1. Backend URL configuration
2. Development vs production settings
3. Fallback mechanisms
4. Error handling strategy
" --output="environment-fix.md"
```

---

## 🔧 **TECHNICAL SPECIFICATIONS**

### **Architecture Service Fix**
```typescript
// CORRECT IMPLEMENTATION:
private loadBoundaries(): Observable<ArchitectureBoundaries> {
  return this.http.get(this.getBoundariesUrl()).pipe(
    timeout(5000),
    catchError((error) => {
      if (this.isDevelopment()) {
        console.warn('⚠️ Using local fallback boundaries - backend unavailable');
        return of(this.getLocalFallbackBoundaries());
      }
      console.error('❌ Architecture boundaries unavailable:', error);
      return of(this.getLocalFallbackBoundaries());
    }),
    tap(boundaries => this.cacheBoundaries(boundaries))
  );
}
```

### **Route Normalization Fix**
```typescript
// EXPECTED MAPPING:
normalizeRoute('/login') → 'auth/login'
normalizeRoute('/register') → 'auth/register' 
normalizeRoute('/auth/login') → 'auth/login'

// CURRENT BUG: Probably generating 'login' instead of 'auth/login'
```

### **Missing File Creation**
```json
// apps/mobile/src/assets/i18n/pages/auth/login/en.json
{
  "title": "Login to Public Digit",
  "email": "Email Address",
  "password": "Password",
  "submit": "Sign In",
  "forgot_password": "Forgot your password?",
  "register_link": "Create new account"
}
```

---

## 🎯 **EXECUTION PRIORITY**

### **PHASE 1: Critical Fixes (IMMEDIATE)**
```bash
claude execute-critical --order="
1. Fix architecture service to not block app startup
2. Create missing auth translation files
3. Verify route normalization for auth routes
4. Test login/register pages load without 404s
" --timeout="30-minutes"
```

### **PHASE 2: Verification**
```bash
claude verify-fixes --checks="
✅ No ERR_CONNECTION_REFUSED in console
✅ No 404 errors for translation files
✅ Login/register pages load translations
✅ App starts without blocking errors
✅ Language selector still functional
" --comprehensive="true"
```

### **PHASE 3: Geo-Location (After Fixes)**
```bash
claude execute --phase="geo-location" --prerequisite="errors-fixed"
```

---

## 📊 **SUCCESS CRITERIA**

### **After Fixes Should See:**
- [ ] Architecture service warnings instead of errors
- [ ] No 404 errors for translation files
- [ ] Login/register pages show translated text
- [ ] Language selector remains functional
- [ ] App starts without blocking errors

### **Console Output Should Show:**
```
⚠️ Architecture Service: Using local fallback - backend unavailable
✅ Loaded translations for route: auth/login
✅ Translation path: pages/auth/login/en.json
🌍 Geo-location temporarily disabled for language testing
```

---

## 🛠 **ROLLBACK PLAN**

### **If Fixes Introduce New Issues**
```bash
claude rollback --strategy="minimal-changes" --preserve="
1. Language selector functionality
2. Existing translation structure
3. Core application startup
"
```

---

## 🚀 **IMMEDIATE ACTION**

**Execute Phase 1 Now:**
```bash
claude fix-blocking-errors --priority="critical" --commands="
1. Make ArchitectureService fail gracefully
2. Fix route normalization for auth routes  
3. Create missing login/register translation files
4. Verify no 404 errors in network tab
5. Confirm app starts cleanly
"
```

**Expected Results:**
- ✅ App starts without blocking errors
- ✅ Login/register pages load translations
- ✅ Language selector remains working
- ✅ Clean console (warnings ok, errors fixed)

**Ready to fix these blocking errors?** 🚀