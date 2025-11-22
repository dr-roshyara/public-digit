# 🏗️ **Phase 1: Architecture Guardrails Implementation**

Based on the comprehensive analysis, let's implement the foundational guardrails to enforce DDD architecture before any refactoring.

## 🎯 **PROMPT: Architecture Guardrails Setup**

**SYSTEM**: You are an Angular Architecture Enforcement Specialist. Implement comprehensive guardrails to enforce DDD + Hexagonal architecture boundaries using TypeScript, ESLint, and build-time validation.

**CONTEXT**: Current Angular app has DDD violations. Need to establish unbreakable architectural boundaries before refactoring.

## 📋 **DELIVERABLES**

### **1. Enhanced TypeScript Path Mapping**
```json
// apps/mobile/tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      // Domain Layer - Pure business logic
      "@domain/*": ["src/domain/*"],
      "@domain/contexts/*": ["src/domain/contexts/*"],
      
      // Application Layer - Use cases, commands, queries
      "@application/*": ["src/application/*"],
      "@application/use-cases/*": ["src/application/use-cases/*"],
      
      // Infrastructure Layer - External adapters
      "@infrastructure/*": ["src/infrastructure/*"],
      "@infrastructure/repositories/*": ["src/infrastructure/repositories/*"],
      
      // Presentation Layer - UI components
      "@presentation/*": ["src/presentation/*"],
      "@presentation/components/*": ["src/presentation/components/*"],
      
      // Core - Cross-cutting concerns
      "@core/*": ["src/core/*"],
      
      // Testing utilities
      "@testing/*": ["src/testing/*"]
    }
  }
}
```

### **2. Layer Boundary ESLint Rules**
```javascript
// apps/mobile/eslint-layer-rules.config.mjs
import { FlatCompat } from '@eslint/eslintrc';
const compat = new FlatCompat();

export default [
  ...compat.extends('../../eslint.config.mjs'),
  {
    files: ['**/*.ts'],
    rules: {
      // DOMAIN LAYER RULES - No external dependencies
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            // DOMAIN LAYER - Pure TypeScript only
            {
              sourceTag: 'domain',
              onlyDependOnLibsWithTags: ['domain', 'typescript'],
            },
            // APPLICATION LAYER - Can depend on domain
            {
              sourceTag: 'application',
              onlyDependOnLibsWithTags: ['application', 'domain', 'typescript'],
            },
            // INFRASTRUCTURE LAYER - Can depend on domain and application
            {
              sourceTag: 'infrastructure',
              onlyDependOnLibsWithTags: ['infrastructure', 'domain', 'application', 'typescript'],
            },
            // PRESENTATION LAYER - Can depend on application and infrastructure
            {
              sourceTag: 'presentation',
              onlyDependOnLibsWithTags: ['presentation', 'application', 'infrastructure', 'domain', 'typescript'],
            },
            // CORE - Can be used by all layers
            {
              sourceTag: 'core',
              onlyDependOnLibsWithTags: ['core', 'typescript'],
            },
          ],
        },
      ],
      
      // Additional architectural rules
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/infrastructure/*'],
              message: 'Infrastructure should not be imported in domain layer. Use dependency inversion.',
            },
            {
              group: ['**/application/*'],
              message: 'Application layer should not be imported in domain layer.',
            },
            {
              group: ['@angular/common/http'],
              importNames: ['HttpClient'],
              message: 'HttpClient should only be used in infrastructure layer.',
            },
            {
              group: ['@capacitor/preferences'],
              message: 'Storage should only be used in infrastructure layer.',
            },
          ],
        },
      ],
    },
  },
];
```

### **3. Architecture Validation Script**
```typescript
// apps/mobile/scripts/validate-architecture.ts
#!/usr/bin/env ts-node
import { Project, StructureKind, InterfaceDeclaration, ClassDeclaration } from 'ts-morph';
import * as path from 'path';

class ArchitectureValidator {
  private project: Project;

  constructor() {
    this.project = new Project({
      tsConfigFilePath: 'tsconfig.json',
    });
  }

  validateDomainLayer(): ValidationResult {
    const violations: ArchitectureViolation[] = [];
    const domainFiles = this.project.getSourceFiles('src/domain/**/*.ts');

    domainFiles.forEach(file => {
      const imports = file.getImportDeclarations();

      imports.forEach(importDecl => {
        const moduleSpecifier = importDecl.getModuleSpecifierValue();
        
        // Domain layer cannot depend on external libraries
        if (this.isExternalDependency(moduleSpecifier)) {
          violations.push({
            file: file.getFilePath(),
            rule: 'DOMAIN_EXTERNAL_DEPENDENCY',
            message: `Domain layer cannot depend on external library: ${moduleSpecifier}`,
            severity: 'ERROR',
          });
        }

        // Domain layer cannot depend on infrastructure
        if (moduleSpecifier.includes('infrastructure')) {
          violations.push({
            file: file.getFilePath(),
            rule: 'DOMAIN_INFRASTRUCTURE_DEPENDENCY',
            message: 'Domain layer cannot depend on infrastructure layer',
            severity: 'ERROR',
          });
        }
      });

      // Check for anemic domain models
      file.getClasses().forEach(classDecl => {
        if (this.isAnemicDomainModel(classDecl)) {
          violations.push({
            file: file.getFilePath(),
            rule: 'ANEMIC_DOMAIN_MODEL',
            message: `Domain model ${classDecl.getName()} has no behavior (only properties)`,
            severity: 'WARNING',
          });
        }
      });
    });

    return { violations, totalFiles: domainFiles.length };
  }

  validateInfrastructureLayer(): ValidationResult {
    const violations: ArchitectureViolation[] = [];
    const infrastructureFiles = this.project.getSourceFiles('src/infrastructure/**/*.ts');

    infrastructureFiles.forEach(file => {
      // Infrastructure must implement domain interfaces
      const classes = file.getClasses();
      const interfaces = file.getInterfaces();
      
      if (classes.length === 0 && interfaces.length === 0) {
        violations.push({
          file: file.getFilePath(),
          rule: 'INFRASTRUCTURE_NO_IMPLEMENTATION',
          message: 'Infrastructure files should implement domain interfaces',
          severity: 'WARNING',
        });
      }
    });

    return { violations, totalFiles: infrastructureFiles.length };
  }

  private isExternalDependency(moduleSpecifier: string): boolean {
    const externalDependencies = [
      '@angular/',
      '@capacitor/',
      'rxjs',
      'axios',
      'http',
      'https',
    ];
    
    return externalDependencies.some(dep => moduleSpecifier.startsWith(dep));
  }

  private isAnemicDomainModel(classDecl: ClassDeclaration): boolean {
    const properties = classDecl.getProperties();
    const methods = classDecl.getMethods();
    
    // If class has properties but no methods (or only getters/setters), it's anemic
    return properties.length > 0 && 
           methods.filter(m => !m.getName().startsWith('get') && !m.getName().startsWith('set')).length === 0;
  }

  generateReport(): ArchitectureReport {
    const domainValidation = this.validateDomainLayer();
    const infrastructureValidation = this.validateInfrastructureLayer();

    return {
      timestamp: new Date(),
      domainLayer: domainValidation,
      infrastructureLayer: infrastructureValidation,
      totalViolations: domainValidation.violations.length + infrastructureValidation.violations.length,
      hasCriticalViolations: domainValidation.violations.some(v => v.severity === 'ERROR'),
    };
  }
}

// Types
interface ArchitectureViolation {
  file: string;
  rule: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
}

interface ValidationResult {
  violations: ArchitectureViolation[];
  totalFiles: number;
}

interface ArchitectureReport {
  timestamp: Date;
  domainLayer: ValidationResult;
  infrastructureLayer: ValidationResult;
  totalViolations: number;
  hasCriticalViolations: boolean;
}

// Run validation
const validator = new ArchitectureValidator();
const report = validator.generateReport();

console.log('🏗️  Architecture Validation Report');
console.log('=================================');
console.log(`Timestamp: ${report.timestamp.toISOString()}`);
console.log(`Domain Layer: ${report.domainLayer.totalFiles} files, ${report.domainLayer.violations.length} violations`);
console.log(`Infrastructure Layer: ${report.infrastructureLayer.totalFiles} files, ${report.infrastructureLayer.violations.length} violations`);
console.log(`Total Violations: ${report.totalViolations}`);
console.log(`Critical Violations: ${report.hasCriticalViolations ? 'YES ❌' : 'NO ✅'}`);

if (report.totalViolations > 0) {
  console.log('\n📋 Violation Details:');
  [...report.domainLayer.violations, ...report.infrastructureLayer.violations].forEach(violation => {
    console.log(`[${violation.severity}] ${violation.rule}: ${violation.message}`);
    console.log(`   File: ${violation.file}`);
  });
  process.exit(1);
} else {
  console.log('\n🎉 All architecture rules passed!');
  process.exit(0);
}
```

### **4. Barrel Exports for Clean APIs**
```typescript
// src/domain/index.ts
// Domain Layer Public API
export * from './contexts/election/entities/election.entity';
export * from './contexts/election/value-objects/election-id.vo';
export * from './contexts/election/domain-services/election-validation.service';
export * from './contexts/election/events/election-created.event';
export * from './contexts/election/repositories/election.repository';

// src/application/index.ts
// Application Layer Public API
export * from './use-cases/create-election.use-case';
export * from './use-cases/cast-vote.use-case';
export * from './commands/create-election.command';
export * from './queries/get-active-elections.query';
export * from './dtos/election.dto';

// src/infrastructure/index.ts
// Infrastructure Layer Public API
export * from './repositories/http-election.repository';
export * from './adapters/storage.adapter';

// src/presentation/index.ts
// Presentation Layer Public API
export * from './components/election-list/election-list.component';
export * from './pages/elections/elections.page';
```

### **5. Dependency Injection Configuration**
```typescript
// src/core/dependency-injection/app-di.config.ts
import { Provider } from '@angular/core';
import { ElectionRepository } from '@domain/contexts/election/repositories/election.repository';
import { HttpElectionRepository } from '@infrastructure/repositories/http-election.repository';

export const DOMAIN_PROVIDERS: Provider[] = [
  // Domain services
];

export const APPLICATION_PROVIDERS: Provider[] = [
  // Use cases, command handlers, query handlers
];

export const INFRASTRUCTURE_PROVIDERS: Provider[] = [
  // Repository implementations
  { provide: ElectionRepository, useClass: HttpElectionRepository },
];

export const PRESENTATION_PROVIDERS: Provider[] = [
  // Components, pages, pipes
];

export const CORE_PROVIDERS: Provider[] = [
  // Cross-cutting concerns
];
```

### **6. Build-Time Architecture Check**
```javascript
// apps/mobile/architect.config.js
const { execSync } = require('child_process');

module.exports = {
  "architect": {
    "build": {
      "builder": "@angular-devkit/build-angular:browser",
      "options": {
        // ... existing options
      },
      "configurations": {
        "production": {
          "prebuild": [
            {
              "command": "ts-node scripts/validate-architecture.ts",
              "description": "Validate DDD architecture before build"
            }
          ]
        }
      }
    },
    "test": {
      "builder": "@nrwl/jest:jest",
      "options": {
        "setupFiles": ["scripts/architecture-check.js"]
      }
    }
  }
};
```

### **7. Architecture Decision Records (ADRs)**
```markdown
# apps/mobile/docs/architecture/decisions/
├── 001-use-ddd-and-hexagonal-architecture.md
├── 002-layer-boundary-enforcement.md
├── 003-dependency-inversion-principle.md
└── 004-testing-strategy-for-ddd.md
```

**Example ADR:**
```markdown
# ADR 001: Use DDD and Hexagonal Architecture

## Status
Accepted

## Context
Current Angular app has mixed concerns and direct infrastructure dependencies preventing scalability.

## Decision
Implement Domain-Driven Design with Hexagonal Architecture:
- Domain Layer: Pure business logic, no external dependencies
- Application Layer: Use cases and orchestration
- Infrastructure Layer: External adapters and implementations
- Presentation Layer: UI components

## Consequences
- ✅ Clear separation of concerns
- ✅ Better testability
- ✅ Easier maintenance
- ❌ Initial refactoring complexity
- ❌ Learning curve for team
```

### **8. Package.json Scripts Enhancement**
```json
{
  "scripts": {
    "build": "ng build",
    "build:with-arch-check": "npm run validate:architecture && ng build",
    "validate:architecture": "ts-node scripts/validate-architecture.ts",
    "lint:architecture": "eslint . --config eslint-layer-rules.config.mjs",
    "test:architecture": "jest --testPathPattern=\"architecture\\.spec\"",
    "architecture:report": "npm run validate:architecture -- --report"
  }
}
```

### **9. Git Hooks for Architecture Enforcement**
```bash
#!/bin/bash
# .husky/pre-commit
echo "🔍 Running architecture validation..."

# Validate architecture before commit
npm run validate:architecture

if [ $? -ne 0 ]; then
  echo "❌ Architecture validation failed! Please fix violations before committing."
  exit 1
fi

echo "✅ Architecture validation passed!"
```

## 🚀 **IMMEDIATE EXECUTION**

### **Run These Commands:**
```bash
# Install architecture validation dependencies
npm install -D ts-morph ts-node

# Test the architecture validation
npm run validate:architecture

# Check current violations
npm run architecture:report

# Add to pre-commit hooks
npx husky add .husky/pre-commit "npm run validate:architecture"
```

### **Expected Output:**
```
🏗️  Architecture Validation Report
=================================
Timestamp: 2025-11-21T10:00:00.000Z
Domain Layer: 0 files, 15 violations
Infrastructure Layer: 0 files, 8 violations
Total Violations: 23
Critical Violations: YES ❌

📋 Violation Details:
[ERROR] DOMAIN_EXTERNAL_DEPENDENCY: Domain layer cannot depend on external library: @angular/common/http
   File: apps/mobile/src/app/features/elections/services/election.service.ts
```

## 🎯 **NEXT STEPS AFTER GUARDRAILS**

Once the architecture guardrails are in place and blocking violations, we can safely proceed with:

1. **Phase 2**: Create rich domain models in `src/domain/`
2. **Phase 3**: Implement application layer use cases  
3. **Phase 4**: Build infrastructure adapters
4. **Phase 5**: Refactor existing components to use new architecture

The guardrails will **prevent regression** and ensure all new code follows DDD principles from day one.

**Ready to implement these architecture guardrails?** This will create an unbreakable foundation for your DDD transformation!