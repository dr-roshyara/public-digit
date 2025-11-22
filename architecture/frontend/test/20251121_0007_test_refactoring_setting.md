TDD Infrastructure Setup - Complete Implementation# 🧪 TDD Infrastructure Setup - Complete Implementation

## 🎯 **PROMPT: TDD Infrastructure Enhancement**

**SYSTEM**: You are a Senior Testing Architect specializing in Angular, Jest, and comprehensive test automation. Enhance the existing testing infrastructure to support DDD + Hexagonal architecture with enterprise-grade testing practices.

**CONTEXT**: Existing Angular mobile app with Jest setup needs enhanced TDD infrastructure for political platform refactoring.

## 📋 **DELIVERABLES**

### **1. Enhanced Jest Configuration**
```typescript
// apps/mobile/jest.config.ts
import { getJestConfig } from '@nrwl/jest';

const jestConfig = getJestConfig(async () => {
  const config = {
    displayName: 'mobile',
    preset: '../../jest.preset.js',
    setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
    coverageDirectory: '../../coverage/apps/mobile',
    transform: {
      '^.+\\.(ts|mjs|js|html)$': [
        'jest-preset-angular',
        {
          tsconfig: '<rootDir>/tsconfig.spec.json',
          stringifyContentPathRegex: '\\.(html|svg)$',
        },
      ],
    },
    transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],
    snapshotSerializers: [
      'jest-preset-angular/build/serializers/no-ng-attributes',
      'jest-preset-angular/build/serializers/ng-snapshot',
      'jest-preset-angular/build/serializers/html-comment',
    ],
    
    // ENHANCED CONFIGURATION
    collectCoverageFrom: [
      'src/**/*.{ts,html}',
      '!src/**/*.spec.ts',
      '!src/**/*.test.ts',
      '!src/main.ts',
      '!src/**/index.ts',
      '!src/environments/**',
    ],
    coverageThreshold: {
      global: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    coverageReporters: ['html', 'text', 'lcov', 'json'],
    testTimeout: 10000,
    maxWorkers: '50%',
    verbose: true,
  };

  return config;
});

export default jestConfig;
```

### **2. Enhanced Test Setup**
```typescript
// apps/mobile/src/test-setup.ts
import 'jest-preset-angular/setup-jest';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

// Global test configuration
beforeEach(async () => {
  await TestBed.configureTestingModule({
    imports: [
      HttpClientTestingModule,
      NoopAnimationsModule,
    ],
    teardown: { destroyAfterEach: false },
  });
});

// Global mocks
Object.defineProperty(window, 'CSS', { value: null });
Object.defineProperty(document, 'doctype', {
  value: '<!DOCTYPE html>'
});
Object.defineProperty(window, 'getComputedStyle', {
  value: () => ({
    getPropertyValue: (prop: any) => ''
  })
});

// Custom matchers
import './testing/matchers/custom-matchers';
```

### **3. Test Utilities Structure**
```typescript
// apps/mobile/src/testing/
src/testing/
├── test-utils/
│   ├── index.ts
│   ├── test-bed.utils.ts
│   └── test-helpers.ts
├── factories/
│   ├── index.ts
│   ├── domain-factories.ts
│   └── http-factories.ts
├── builders/
│   ├── index.ts
│   ├── organization.builder.ts
│   └── member.builder.ts
├── matchers/
│   ├── index.ts
│   ├── custom-matchers.ts
│   └── domain-matchers.ts
├── mocks/
│   ├── index.ts
│   ├── http-mocks.ts
│   └── service-mocks.ts
└── data/
    ├── index.ts
    ├── test-data.ts
    └── mock-responses.ts
```

### **4. Core Test Utilities**
```typescript
// apps/mobile/src/testing/test-utils/test-bed.utils.ts
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Type } from '@angular/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

export class TestBedUtils {
  static configureTestingModule(moduleConfig: {
    declarations?: any[];
    imports?: any[];
    providers?: any[];
  }) {
    return TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        ...(moduleConfig.imports || [])
      ],
      declarations: moduleConfig.declarations || [],
      providers: moduleConfig.providers || [],
    });
  }

  static createComponent<T>(component: Type<T>): ComponentFixture<T> {
    return TestBed.createComponent(component);
  }

  static autoDetectChanges(fixture: ComponentFixture<any>): void {
    fixture.autoDetectChanges(true);
  }
}

// Quick setup helper
export function setupTest<T>(
  component: Type<T>,
  config: { imports?: any[]; providers?: any[] } = {}
): ComponentFixture<T> {
  TestBedUtils.configureTestingModule({
    declarations: [component],
    imports: config.imports,
    providers: config.providers,
  }).compileComponents();

  return TestBedUtils.createComponent(component);
}
```

### **5. Domain Test Factories**
```typescript
// apps/mobile/src/testing/factories/domain-factories.ts
import { faker } from '@faker-js/faker';
import { Organization, OrganizationType } from '../../../domains/organization/domain/organization.model';
import { Member, MemberRole } from '../../../domains/membership/domain/member.model';

export class DomainFactory {
  static createOrganization(overrides: Partial<Organization> = {}): Organization {
    const defaults: Organization = {
      id: faker.string.uuid(),
      name: faker.company.name(),
      type: faker.helpers.arrayElement(['POLITICAL_PARTY', 'NGO'] as OrganizationType[]),
      description: faker.company.catchPhrase(),
      logoUrl: faker.image.url(),
      website: faker.internet.url(),
      isVerified: faker.datatype.boolean(),
      memberCount: faker.number.int({ min: 1, max: 10000 }),
      transparencyScore: faker.number.int({ min: 0, max: 100 }),
      createdAt: faker.date.past(),
    };

    return { ...defaults, ...overrides } as Organization;
  }

  static createMember(overrides: Partial<Member> = {}): Member {
    const defaults: Member = {
      id: faker.string.uuid(),
      displayName: faker.person.fullName(),
      email: faker.internet.email(),
      role: faker.helpers.arrayElement(['ADMIN', 'MEMBER', 'GUEST'] as MemberRole[]),
      joinDate: faker.date.past(),
      organizationId: faker.string.uuid(),
      isActive: faker.datatype.boolean(),
      lastActiveAt: faker.date.recent(),
    };

    return { ...defaults, ...overrides } as Member;
  }

  static createOrganizationList(count: number = 5): Organization[] {
    return Array.from({ length: count }, () => this.createOrganization());
  }

  static createMemberList(count: number = 10): Member[] {
    return Array.from({ length: count }, () => this.createMember());
  }
}
```

### **6. Test Data Builders (Builder Pattern)**
```typescript
// apps/mobile/src/testing/builders/organization.builder.ts
import { Organization, OrganizationType } from '../../../domains/organization/domain/organization.model';
import { faker } from '@faker-js/faker';

export class OrganizationBuilder {
  private organization: Partial<Organization> = {};

  withId(id: string): OrganizationBuilder {
    this.organization.id = id;
    return this;
  }

  withName(name: string): OrganizationBuilder {
    this.organization.name = name;
    return this;
  }

  withType(type: OrganizationType): OrganizationBuilder {
    this.organization.type = type;
    return this;
  }

  asPoliticalParty(): OrganizationBuilder {
    this.organization.type = 'POLITICAL_PARTY';
    return this;
  }

  asNGO(): OrganizationBuilder {
    this.organization.type = 'NGO';
    return this;
  }

  withMemberCount(count: number): OrganizationBuilder {
    this.organization.memberCount = count;
    return this;
  }

  withTransparencyScore(score: number): OrganizationBuilder {
    this.organization.transparencyScore = score;
    return this;
  }

  verified(): OrganizationBuilder {
    this.organization.isVerified = true;
    return this;
  }

  unverified(): OrganizationBuilder {
    this.organization.isVerified = false;
    return this;
  }

  build(): Organization {
    const defaults: Organization = {
      id: this.organization.id || faker.string.uuid(),
      name: this.organization.name || faker.company.name(),
      type: this.organization.type || 'POLITICAL_PARTY',
      description: faker.company.catchPhrase(),
      logoUrl: faker.image.url(),
      website: faker.internet.url(),
      isVerified: this.organization.isVerified ?? faker.datatype.boolean(),
      memberCount: this.organization.memberCount || faker.number.int({ min: 1, max: 1000 }),
      transparencyScore: this.organization.transparencyScore || faker.number.int({ min: 0, max: 100 }),
      createdAt: faker.date.past(),
    };

    return { ...defaults, ...this.organization } as Organization;
  }

  static create(): OrganizationBuilder {
    return new OrganizationBuilder();
  }
}

// Usage example in tests:
// const organization = OrganizationBuilder.create()
//   .withName('Green Party')
//   .asPoliticalParty()
//   .withMemberCount(5000)
//   .verified()
//   .build();
```

### **7. Custom Matchers**
```typescript
// apps/mobile/src/testing/matchers/custom-matchers.ts
import { Organization } from '../../../domains/organization/domain/organization.model';

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidOrganization(): R;
      toHaveTransparencyScoreAbove(score: number): R;
      toBeVerifiedOrganization(): R;
      toContainMemberWithRole(role: string): R;
    }
  }
}

export const customMatchers = {
  toBeValidOrganization(received: Organization) {
    const pass = 
      received.id !== undefined &&
      received.name !== undefined && 
      received.name.length > 0 &&
      ['POLITICAL_PARTY', 'NGO'].includes(received.type) &&
      received.memberCount >= 0;

    return {
      message: () =>
        `expected organization to be valid but got ${JSON.stringify(received)}`,
      pass,
    };
  },

  toHaveTransparencyScoreAbove(received: Organization, score: number) {
    const pass = received.transparencyScore > score;
    return {
      message: () =>
        `expected organization to have transparency score above ${score} but got ${received.transparencyScore}`,
      pass,
    };
  },

  toBeVerifiedOrganization(received: Organization) {
    const pass = received.isVerified === true;
    return {
      message: () =>
        `expected organization to be verified but got ${received.isVerified}`,
      pass,
    };
  },
};

// Add to Jest in test-setup.ts
expect.extend(customMatchers);
```

### **8. HTTP Mock Utilities**
```typescript
// apps/mobile/src/testing/mocks/http-mocks.ts
import { HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';

export class HttpTestingUtils {
  static createMockResponse<T>(data: T, status: number = 200): HttpResponse<T> {
    return new HttpResponse({
      body: data,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
    });
  }

  static createMockErrorResponse(error: any, status: number = 500): Observable<never> {
    return new Observable(observer => {
      observer.error({
        status,
        statusText: 'Error',
        error,
      });
    });
  }

  static delayResponse<T>(data: T, delayMs: number = 100): Observable<T> {
    return new Observable(observer => {
      setTimeout(() => {
        observer.next(data);
        observer.complete();
      }, delayMs);
    });
  }
}

// Mock HTTP handlers for testing
export const mockOrganizationHandlers = {
  getOrganizations: (organizations: any[]) => 
    (req: HttpRequest<any>) => of(HttpTestingUtils.createMockResponse(organizations)),

  getOrganization: (organization: any) =>
    (req: HttpRequest<any>) => of(HttpTestingUtils.createMockResponse(organization)),

  createOrganization: (createdOrganization: any) =>
    (req: HttpRequest<any>) => of(HttpTestingUtils.createMockResponse(createdOrganization, 201)),
};
```

### **9. Test Data Management**
```typescript
// apps/mobile/src/testing/data/test-data.ts
import { OrganizationBuilder } from '../builders/organization.builder';
import { DomainFactory } from '../factories/domain-factories';

export const TestData = {
  organizations: {
    greenParty: OrganizationBuilder.create()
      .withName('Green Party')
      .asPoliticalParty()
      .withMemberCount(15000)
      .withTransparencyScore(85)
      .verified()
      .build(),

    redCross: OrganizationBuilder.create()
      .withName('Red Cross International')
      .asNGO()
      .withMemberCount(500000)
      .withTransparencyScore(95)
      .verified()
      .build(),

    sampleList: DomainFactory.createOrganizationList(5),
  },

  members: {
    admin: DomainFactory.createMember({ role: 'ADMIN' }),
    regular: DomainFactory.createMember({ role: 'MEMBER' }),
    guest: DomainFactory.createMember({ role: 'GUEST' }),
    sampleList: DomainFactory.createMemberList(10),
  },
};
```

### **10. Package.json Test Scripts Enhancement**
```json
// Add to apps/mobile/package.json or root package.json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:verbose": "jest --verbose",
    "test:ci": "jest --ci --coverage --maxWorkers=2",
    "test:integration": "jest --testPathPattern=\"integration\"",
    "test:unit": "jest --testPathPattern=\"spec\"",
    "test:debug": "node --inspect-brk ./node_modules/jest/bin/jest.js --runInBand --watch"
  }
}
```

### **11. Testing Conventions Document**
```markdown
# apps/mobile/TESTING_CONVENTIONS.md

## File Naming
- Unit tests: `*.spec.ts`
- Integration tests: `*.integration.ts`
- E2E tests: `*.e2e.ts`

## Test Structure (AAA Pattern)
```typescript
describe('Component/Service Name', () => {
  describe('when [scenario]', () => {
    it('should [expected behavior]', () => {
      // Arrange
      const testData = TestData.organizations.greenParty;
      
      // Act
      const result = component.doSomething(testData);
      
      // Assert
      expect(result).toBeValidOrganization();
    });
  });
});
```

## Coverage Requirements
- Minimum 80% coverage for new code
- 100% coverage for domain models
- Critical paths: 90%+ coverage

## Best Practices
- Use builders for complex object creation
- Prefer factories for simple object creation
- Use custom matchers for domain-specific assertions
- Mock at the boundary, not the core
```

## 🚀 **IMMEDIATE EXECUTION**

### **Run These Commands:**
```bash
# Install testing dependencies
npm install -D @faker-js/faker @types/faker

# Run enhanced test suite
npm run test:coverage

# Verify coverage thresholds
npm run test:ci
```

### **Verify Implementation:**
1. ✅ Enhanced Jest configuration with coverage thresholds
2. ✅ Comprehensive test utilities structure
3. ✅ Domain-specific test factories and builders
4. ✅ Custom matchers for domain assertions
5. ✅ HTTP mocking utilities
6. ✅ Test data management
7. ✅ Testing conventions and standards

This TDD infrastructure provides the **safety net** needed for your DDD + Hexagonal refactoring. You can now refactor with confidence, knowing that tests will catch regressions and enforce architectural boundaries.

**Ready to proceed with Phase 2: Core Layer Refactoring?** The TDD foundation is now in place!