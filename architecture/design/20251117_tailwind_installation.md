# Claude CLI Prompt Engineering Instructions: Tailwind CSS + Angular + Android Setup

## PROMPT TEMPLATE STRUCTURE

### 1. **CONTEXT SETUP**
```
You are an expert Angular developer specializing in mobile app development with Tailwind CSS and Capacitor. The user needs complete setup instructions for integrating Tailwind CSS into an Angular project targeting Android deployment.
```

### 2. **ROLE & TONE SPECIFICATION**
```
Role: Senior Full-Stack Mobile Developer
Tone: Technical, precise, step-by-step
Audience: Angular developers familiar with CLI tools
Depth: Production-ready, comprehensive setup
```

### 3. **RESPONSE STRUCTURE COMMAND**
```
Structure your response in this exact sequence:
1. Prerequisites verification
2. Installation commands (copy-paste ready)
3. Configuration files (complete code blocks)
4. Android-specific adaptations
5. Verification steps
6. Troubleshooting common issues
```

### 4. **TECHNICAL SCOPE DEFINITION**
```
Technical scope to cover:
- Angular 15+ compatibility
- Tailwind CSS v3.x
- Capacitor 4+ for Android
- Ionic integration (optional but recommended)
- Production optimization steps
- Mobile-specific styling considerations
```

## SAMPLE PROMPT FOR USER TO USE

```
Create a complete post-installation guide for setting up Tailwind CSS in an Angular project that will be deployed as an Android app using Capacitor. Include:

1. Step-by-step CLI commands for Tailwind installation
2. Complete configuration files (tailwind.config.js, styles.css, etc.)
3. Capacitor setup for Android deployment
4. Mobile-optimized Tailwind configuration
5. Verification steps to confirm proper setup
6. Production build optimization tips

Provide copy-paste ready code blocks and explain each configuration decision specifically for mobile app development.
```

## EXPECTED OUTPUT FORMAT

```
## TAILWIND CSS + ANGULAR + ANDROID SETUP GUIDE

### PREREQUISITES
- [ ] Angular 15+ project
- [ ] Node.js 16+
- [ ] Android Studio (for Capacitor)

### 1. INSTALLATION COMMANDS
```bash
# Copy-paste this entire block
ng add @tailwindcss/angular
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init
```

### 2. CONFIGURATION FILES

#### tailwind.config.js
```javascript
// Mobile-optimized config
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
    "./projects/**/*.{html,ts}"
  ],
  theme: {
    extend: {
      screens: {
        'xs': '360px', // Mobile breakpoint
      }
    },
  },
  plugins: [],
}
```

### 3. ANDROID CAPACITOR SETUP
```bash
npm install @capacitor/core @capacitor/cli
npx cap init MyApp com.example.myapp
npx cap add android
```

### 4. MOBILE-SPECIFIC STYLING
```css
/* Add to styles.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Mobile optimizations */
@layer utilities {
  .safe-area-padding {
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
  }
}
```

### 5. VERIFICATION STEPS
1. Run `ng serve` and check for Tailwind classes
2. Test responsive design on mobile viewport
3. Build Android app: `npx cap run android`

### 6. TROUBLESHOOTING
Common issues and solutions:
- Styles not applying? Check content paths in config
- Build errors? Verify PostCSS configuration
- Android build failing? Ensure Android SDK installed
```

## FOLLOW-UP PROMPT IDEAS

If the user needs more specific help, they can use these follow-up prompts:

```
"Create a mobile-first component using Tailwind in Angular for Android"
```

```
"Optimize Tailwind purge settings for production Android builds"
```

```
"Add Ionic framework to the existing Angular + Tailwind + Capacitor setup"
```

```
"Fix common Tailwind class conflicts in Angular Material components"
```

## KEY PROMPT ENGINEERING ELEMENTS

1. **Explicit structure commands** - Direct Claude's output format
2. **Technical specificity** - Define exact versions and configurations
3. **Mobile context** - Emphasize Android-specific considerations
4. **Actionable steps** - Provide copy-paste ready commands
5. **Verification methodology** - Include testing and validation steps
6. **Troubleshooting preemption** - Address common issues proactively

This prompt engineering approach ensures Claude provides comprehensive, production-ready instructions specifically tailored for Angular + Tailwind + Android development.