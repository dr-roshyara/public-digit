# 🎯 **Claude CLI Prompt Instructions: i18n Folder Structure Synchronization**
-Separating Angular frontend and Laravel  frontend pages for admin pages
- Use seperate i18n structure 

## **SYSTEM PROMPT**
```
You are an Internationalization (i18n) Architecture Specialist specializing in Angular applications with DDD + Hexagonal architecture. Your expertise includes translation file organization, maintainable i18n structures, and synchronization between frontend components and translation assets.
```

## **CONTEXT**
```
Angular DDD application with this presentation layer structure:
apps/mobile/src/app/presentation/
├── pages/
│   ├── auth/
│   │   ├── login/
│   │   └── tenant-selection/
│   ├── home/
│   ├── dashboard/
│   ├── elections/
│   └── membership/
└── components/
    ├── header/
    ├── hero/
    ├── features/
    ├── footer/
    └── stats/
```

## **PRIMARY PROMPT: i18n Structure Synchronization**
```
Create a mirrored i18n folder structure that exactly matches the Angular presentation layer for optimal maintainability and scalability.

REQUIREMENTS:
1. **Exact Mirror Structure**: i18n folders must match presentation/ folder hierarchy
2. **Component-Focused Files**: Each component/page has its own translation file
3. **Shared Translations**: Common strings extracted to shared files
4. **Type Safety**: TypeScript interfaces for translation keys
5. **Scalable Organization**: Support for large-scale political platform

IMPLEMENTATION:
1. Create folder structure mirroring presentation/ layer
2. Generate translation files for each component/page
3. Create shared translation files for common strings
4. Implement translation key interfaces
5. Setup i18n service with structured loading

DELIVERABLES:
- Complete i18n folder structure
- Example translation files for each layer
- Translation service implementation
- TypeScript interfaces for type safety
- Usage examples for components
```

## **FOLDER STRUCTURE PROMPT**
```
Generate the exact i18n folder structure that mirrors the presentation layer:

TARGET STRUCTURE:
apps/mobile/src/assets/i18n/
├── pages/                    ← Mirrors presentation/pages/
│   ├── auth/
│   │   ├── login/
│   │   │   ├── en.json
│   │   │   ├── np.json
│   │   │   └── index.ts
│   │   └── tenant-selection/
│   │       ├── en.json
│   │       ├── np.json
│   │       └── index.ts
│   ├── home/
│   │   ├── en.json
│   │   ├── np.json
│   │   └── index.ts
│   ├── dashboard/
│   │   ├── en.json
│   │   ├── np.json
│   │   └── index.ts
│   ├── elections/
│   │   ├── en.json
│   │   ├── np.json
│   │   └── index.ts
│   └── membership/
│       ├── en.json
│       ├── np.json
│       └── index.ts
├── components/               ← Mirrors presentation/components/
│   ├── header/
│   │   ├── en.json
│   │   ├── np.json
│   │   └── index.ts
│   ├── hero/
│   │   ├── en.json
│   │   ├── np.json
│   │   └── index.ts
│   ├── features/
│   │   ├── en.json
│   │   ├── np.json
│   │   └── index.ts
│   ├── footer/
│   │   ├── en.json
│   │   ├── np.json
│   │   └── index.ts
│   └── stats/
│       ├── en.json
│       ├── np.json
│       └── index.ts
├── shared/                   ← Common translations
│   ├── common/
│   │   ├── en.json
│   │   ├── np.json
│   │   └── index.ts
│   ├── errors/
│   │   ├── en.json
│   │   ├── np.json
│   │   └── index.ts
│   └── navigation/
│       ├── en.json
│       ├── np.json
│       └── index.ts
└── languages/               ← Language configuration
    ├── supported-languages.ts
    └── language-config.ts

Provide the complete folder creation commands and initial file structures.
```

## **TRANSLATION FILES PROMPT**
```
Generate example translation files for each component that demonstrate:

1. **Component-Specific Translations**: Each component gets its own translation file
2. **Structured Keys**: Hierarchical keys matching component structure
3. **Political Platform Context**: Appropriate content for political/NGO platform
4. **Multiple Languages**: English and nepalese examples

COMPONENT EXAMPLES:
- Hero Component: Political engagement messaging
- Features Component: Platform value propositions  
- Header Component: Navigation and branding
- Auth Pages: Login and organization selection
- Election Pages: Democratic process terminology

For each component/page, provide:
- Complete en.json with political platform content
- Complete np.json with nepalese translations
- TypeScript interface for type-safe keys
- Barrel export file

Focus on realistic political platform content that matches the Public Digit brand.
```

## **TYPE SAFETY PROMPT**
```
Implement TypeScript interfaces for type-safe translation keys across the entire i18n structure.

REQUIREMENTS:
1. **Automatic Key Generation**: Interfaces generated from folder structure
2. **Compile-Time Safety**: TypeScript errors for invalid keys
3. **IntelliSense Support**: IDE autocomplete for translation keys
4. **Hierarchical Interfaces**: Mirror the i18n folder structure
5. **Easy Refactoring**: Rename components → automatically update keys

IMPLEMENT:
1. Root translation interface that encompasses all translations
2. Interface for each component/page translation file
3. Shared translation interfaces
4. Key path generation utilities
5. Usage examples in components

DELIVERABLES:
- Complete TranslationKeys interface hierarchy
- Key path utility functions
- Component usage examples
- Refactoring safety documentation
```

## **I18N SERVICE PROMPT**
```
Create a sophisticated i18n service that leverages the structured folder organization.

FEATURES:
1. **Structured Loading**: Load translations by component path
2. **Lazy Loading**: Load only needed translation files
3. **Component Scoping**: Component-specific translation methods
4. **Fallback Chains**: English fallback for missing translations
5. **Hot Reloading**: Development-time translation updates
6. **Pluralization**: Support for singular/plural forms
7. **Interpolation**: Variable substitution in translations

IMPLEMENTATION:
1. TranslationService with structured loading
2. Component translation scoping
3. Language change management
4. Fallback and error handling
5. Development utilities

DELIVERABLES:
- Complete TranslationService implementation
- Component translation scoping utilities
- Language change management
- Development and production configurations
```

## **COMPONENT INTEGRATION PROMPT**
```
Create integration patterns for components to use the structured i18n system.

PATTERNS:
1. **Component-Specific Translations**: Each component uses its own translation file
2. **Shared Translations**: Common strings from shared files
3. **Page-Level Translations**: Page components aggregate child translations
4. **Directive Usage**: Structural directives for conditional translations
5. **Pipe Usage**: Translation pipes for template strings

IMPLEMENT FOR EACH COMPONENT TYPE:
- Hero Component: Landing page translations
- Header Component: Navigation and branding
- Auth Components: Login and organization selection
- Feature Components: Platform value propositions
- Election Components: Democratic process terms

DELIVERABLES:
- Component translation service usage examples
- Template translation patterns
- Directive and pipe implementations
- Best practices documentation
```

## **MAINTENANCE PROMPT**
```
Create maintenance utilities and patterns for the i18n structure.

TOOLS:
1. **Translation Key Validator**: Verify all keys exist in all languages
2. **Missing Translation Reporter**: Identify untranslated strings
3. **Structure Synchronizer**: Keep i18n structure in sync with components
4. **Translation Extraction**: Extract new keys from components
5. **Batch Translation Tools**: Manage multiple language files

WORKFLOWS:
1. Adding new components → automatically create translation files
2. Renaming components → update i18n structure
3. Adding new languages → replicate structure
4. Translation key cleanup → remove unused keys

DELIVERABLES:
- Validation scripts and tools
- Synchronization utilities
- Extraction patterns
- Team workflow documentation
```

## **EXECUTION WORKFLOW**
```
Execute prompts in sequence:

1. FOLDER STRUCTURE → Create i18n folder hierarchy
2. TRANSLATION FILES → Generate component translation files  
3. TYPE SAFETY → Implement TypeScript interfaces
4. I18N SERVICE → Create translation service
5. COMPONENT INTEGRATION → Implement usage patterns
6. MAINTENANCE → Create maintenance utilities

Between each step, provide:
- Implementation completeness report
- TypeScript compilation verification
- Usage examples verification
- Performance impact assessment
```

## **SUCCESS CRITERIA**
```
- ✅ i18n structure exactly mirrors presentation/ folder
- ✅ Each component has dedicated translation files
- ✅ TypeScript interfaces provide full type safety
- ✅ Translation service supports lazy loading
- ✅ Components can scope to their translations
- ✅ Maintenance tools keep structure synchronized
- ✅ Political platform content appropriate for Public Digit
```

This prompt engineering framework ensures your i18n structure will be perfectly synchronized with your Angular components, providing excellent maintainability as your political platform grows.