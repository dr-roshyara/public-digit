## 🚀 **ESBUILD MIGRATION PROMPT FOR CLAUDE CLI**

### **PROJECT CONTEXT**
- **Root Folder**: `C:\Users\nabra\OneDrive\Desktop\roshyara\xamp\nrna\public-digit-platform`
- **Angular Project**: `C:\Users\nabra\OneDrive\Desktop\roshyara\xamp\nrna\public-digit-platform\apps\mobile`
- **Target**: Use TypeScript native compilation with ESBuild for faster builds

### **🎯 OBJECTIVE**
Check current build configuration and migrate from Webpack to ESBuild if needed.

---

## **🔍 INVESTIGATION PHASE**

### **1. CHECK CURRENT BUILD SYSTEM**
```bash
# Navigate to project root
cd C:\Users\nabra\OneDrive\Desktop\roshyara\xamp\nrna\public-digit-platform

# Check Nx configuration
nx report
nx show project mobile
```

### **2. EXAMINE KEY CONFIGURATION FILES**
**Check these files for build configuration:**

#### **A. Nx Configuration**
- `nx.json` - Nx workspace configuration
- `package.json` - Build scripts and dependencies
- `apps/mobile/project.json` - Project-specific build config

#### **B. Angular Configuration** 
- `apps/mobile/angular.json` - Angular build configuration
- `apps/mobile/tsconfig.*.json` - TypeScript configuration

#### **C. Build Files**
- `apps/mobile/vite.config.ts` - Vite configuration (if using Vite)
- `apps/mobile/webpack.config.js` - Webpack configuration (if exists)

### **3. IDENTIFY CURRENT BUILDER**
Look for these patterns in configuration files:

```json
// If using Webpack (OLD)
"builder": "@angular-devkit/build-angular:browser"

// If using ESBuild (NEW)
"builder": "@angular-devkit/build-angular:application"
"builder": "@nx/angular:application" 
```

---

## **🛠️ MIGRATION PHASE (IF WEBPACK DETECTED)**

### **1. UPDATE PROJECT CONFIGURATION**
**File**: `apps/mobile/project.json`

**From Webpack:**
```json
{
  "targets": {
    "build": {
      "executor": "@angular-devkit/build-angular:browser",
      "options": {
        "outputPath": "dist/apps/mobile",
        "index": "apps/mobile/src/index.html",
        "main": "apps/mobile/src/main.ts",
        "polyfills": ["zone.js"]
      }
    }
  }
}
```

**To ESBuild:**
```json
{
  "targets": {
    "build": {
      "executor": "@angular-devkit/build-angular:application",
      "options": {
        "outputPath": "dist/apps/mobile",
        "index": "apps/mobile/src/index.html",
        "browser": "apps/mobile/src/main.ts",
        "polyfills": ["zone.js"],
        "tsConfig": "apps/mobile/tsconfig.app.json"
      }
    }
  }
}
```

### **2. UPDATE ANGULAR CONFIGURATION**
**File**: `apps/mobile/angular.json` (if exists)

**Migrate to new application builder format.**

### **3. UPDATE PACKAGE.JSON SCRIPTS**
**File**: `package.json`

Ensure build scripts use the new builder:
```json
{
  "scripts": {
    "build:mobile": "nx build mobile",
    "serve:mobile": "nx serve mobile"
  }
}
```

### **4. VERIFY TYPESCRIPT CONFIGURATION**
**File**: `apps/mobile/tsconfig.app.json`

Ensure proper configuration for ESBuild:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "types": []
  },
  "files": ["src/main.ts"],
  "include": ["src/**/*.d.ts"]
}
```

---

## **🧪 TESTING PHASE**

### **1. TEST THE MIGRATION**
```bash
# Clean previous builds
nx reset
rm -rf dist apps/mobile/dist

# Test build with new configuration
nx build mobile

# Test development server
nx serve mobile
```

### **2. VERIFY BUILD OUTPUT**
- Check build times (should be significantly faster)
- Verify application works correctly
- Ensure all assets are properly bundled

### **3. CHECK FOR COMPATIBILITY ISSUES**
- Custom Webpack configurations (if any)
- Third-party libraries that might need ESBuild plugins
- Asset loading and processing

---

## **📋 FALLBACK PLAN**

### **If Migration Issues Occur:**
1. **Keep Webpack temporarily** while fixing issues
2. **Use incremental migration** for complex configurations
3. **Consult Angular 17+ documentation** for ESBuild compatibility

### **Alternative: Use Nx Angular Plugin**
```bash
# If using Nx Angular plugin
nx g @nx/angular:setup-esbuild mobile
```

---

## **🎯 SUCCESS CRITERIA**

- ✅ **Build times reduced** by 40-60%
- ✅ **Application functions identically** 
- ✅ **No breaking changes** in functionality
- ✅ **Development server works** with hot reload
- ✅ **Production builds optimized**

---

## **📝 CLAUDE CLI INSTRUCTIONS**

**Execute these steps systematically:**

1. **First**: Investigate current build system in the mobile project
2. **Second**: Identify if using Webpack or already on ESBuild  
3. **Third**: If Webpack detected, migrate to ESBuild configuration
4. **Fourth**: Test build performance and functionality
5. **Fifth**: Report migration results and performance improvements

**Start by examining the project configuration files to determine the current build system.**

---

**Expected Outcome**: Angular mobile app using ESBuild for significantly faster compilation times while maintaining full TypeScript support and application functionality.