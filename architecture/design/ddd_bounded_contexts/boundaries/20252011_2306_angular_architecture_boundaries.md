## Securing Architecture Boundaries

### **1. TSConfig Path Mapping & Barrel Exports**
```json
// tsconfig.base.json
{
  "compilerOptions": {
    "paths": {
      "@public-digit/domains/*": ["libs/domains/*/src/index.ts"],
      "@public-digit/application/*": ["libs/application/*/src/index.ts"],
      "@public-digit/infrastructure/*": ["libs/infrastructure/*/src/index.ts"],
      "@public-digit/shared/*": ["libs/shared/*/src/index.ts"],
      "@public-digit/features/*": ["libs/features/*/src/index.ts"]
    }
  }
}
```

### **2. Barrel Exports (Public API)**
```typescript
// libs/domains/organization/src/index.ts
export { Organization } from './lib/entities/organization.entity';
export { OrganizationRepository } from './lib/repositories/organization.repository';
export { OrganizationCreatedEvent } from './lib/events/organization-created.event';
// ❌ NOT exported: internal domain services, value objects
```

```typescript
// libs/application/organization/src/index.ts
export { CreateOrganizationCommand } from './lib/commands/create-organization/create-organization.command';
export { GetOrganizationQuery } from './lib/queries/get-organization/get-organization.query';
export { OrganizationFacadeService } from './lib/services/organization-facade.service';
// ❌ NOT exported: handlers, internal DTOs
```

### **3. Layer Access Rules**
```typescript
// ✅ ALLOWED: Presentation → Application
import { OrganizationFacadeService } from '@public-digit/application/organization';

// ✅ ALLOWED: Application → Domain  
import { Organization } from '@public-digit/domains/organization';

// ✅ ALLOWED: Infrastructure → Domain
import { OrganizationRepository } from '@public-digit/domains/organization';

// ❌ FORBIDDEN: Presentation → Domain (bypasses application layer)
// import { Organization } from '@public-digit/domains/organization';

// ❌ FORBIDDEN: Domain → Infrastructure (dependency inversion)
// import { LaravelOrganizationRepository } from '@public-digit/infrastructure/api';
```

---

## Claude File Generation Control

### **1. NX Generators with Architecture Rules**
```javascript
// tools/schematics/domain/index.js
const { strings } = require('@angular-devkit/core');

function default_1(options) {
  return (tree, context) => {
    // ENFORCE: domains/ can only contain entities, value objects, repositories
    const allowedFiles = [
      'entity.ts', 'value-object.ts', 'repository.ts', 
      'domain-service.ts', 'event.ts', 'exception.ts'
    ];
    
    const fileName = strings.dasherize(options.name);
    
    if (!allowedFiles.some(pattern => fileName.includes(pattern))) {
      throw new Error(`Domain layer can only contain: ${allowedFiles.join(', ')}`);
    }

    // GENERATE correct file structure
    const domainPath = `libs/domains/${options.name}`;
    
    tree.create(`${domainPath}/src/index.ts`, 
      `export { ${options.name} } from './lib/entities/${fileName}.entity';`
    );
  };
}
```

### **2. ESLint Architecture Rules**
```javascript
// .eslintrc.js
module.exports = {
  rules: {
    "no-restricted-imports": ["error", {
      "patterns": [
        {
          "group": ["@public-digit/domains/*"],
          "importNames": ["default"],
          "message": "Domain imports restricted - use application layer instead"
        },
        {
          "group": ["@public-digit/infrastructure/*"],
          "importNames": ["default"], 
          "message": "Infrastructure should not be imported directly"
        }
      ]
    }]
  }
};
```

### **3. File Location Validation Script**
```javascript
// tools/architecture/validate-structure.js
const fs = require('fs');
const path = require('path');

const ARCHITECTURE_RULES = {
  'libs/domains': {
    allowed: ['entities/', 'value-objects/', 'repositories/', 'events/'],
    forbidden: ['components/', 'services/', '*.component.ts']
  },
  'libs/application': {
    allowed: ['commands/', 'queries/', 'dtos/', 'services/'],
    forbidden: ['entities/', 'components/']
  },
  'libs/infrastructure': {
    allowed: ['clients/', 'repositories/', 'mappers/', 'interceptors/'],
    forbidden: ['entities/', 'commands/']
  }
};

function validateStructure() {
  for (const [basePath, rules] of Object.entries(ARCHITECTURE_RULES)) {
    if (!fs.existsSync(basePath)) continue;
    
    const files = getAllFiles(basePath);
    
    files.forEach(file => {
      // Check forbidden patterns
      rules.forbidden.forEach(forbidden => {
        if (file.includes(forbidden)) {
          throw new Error(`Architecture violation: ${file} should not be in ${basePath}`);
        }
      });
    });
  }
}
```

### **4. Claude Prompt Engineering for Correct Files**
```
SYSTEM: You are an NX Architecture Guardian. Enforce these rules:

FILE LOCATION RULES:
- DOMAIN: Only entities, value objects, repository interfaces, domain events
- APPLICATION: Only commands, queries, handlers, DTOs, facade services  
- INFRASTRUCTURE: Only repository implementations, HTTP clients, mappers
- FEATURES: Only components, pages, feature services, routes

IMPORT RULES:
- ✅ Features → Application → Domain
- ✅ Infrastructure → Domain
- ❌ Features → Domain (bypass application layer)
- ❌ Domain → Infrastructure (violates dependency inversion)

GENERATION TEMPLATE:
When asked for {COMPONENT}:
1. Check if it belongs in domains/, application/, infrastructure/, features/, or shared/
2. Generate file at correct location with proper barrel exports
3. Include only layer-appropriate code
4. Add architecture validation comments

EXAMPLE:
User: "Create organization entity"
You: Generate at `libs/domains/organization/src/lib/entities/organization.entity.ts`
Include: business logic, validation, domain events
Exclude: API calls, UI logic, application services
```

### **5. Build-Time Architecture Validation**
```json
// project.json for each lib
{
  "targets": {
    "build": {
      "executor": "@nx/angular:package",
      "options": {
        "pre-commands": ["node tools/architecture/validate-structure.js"]
      }
    }
  }
}
```

This ensures:
- ✅ **Correct file locations** based on architecture layer
- ✅ **Proper imports** following dependency direction
- ✅ **Build failures** on architecture violations  
- ✅ **Claude generates** files in correct places with appropriate code
- ✅ **Team consistency** with automated architecture guards