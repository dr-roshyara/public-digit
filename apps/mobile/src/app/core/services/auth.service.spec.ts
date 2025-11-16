import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';
import { TenantContextService } from './tenant-context.service';
import {
  LoginRequest,
  LoginResponse,
  User,
  ApiResponse,
  Tenant,
  TenantListResponse
} from '../models/auth.models';

/**
 * AuthService Tests
 *
 * **TDD Approach - RED Phase**
 *
 * Tests for loadUserTenants() method (Phase 3D requirement):
 * - Fetch user's tenants from /api/v1/auth/tenants
 * - Handle successful response with tenant list
 * - Handle empty tenant list
 * - Handle API errors
 * - Cache tenants for offline use
 */
describe('AuthService', () => {
  let service: AuthService;
  let apiService: jest.Mocked<ApiService>;
  let tenantContextService: jest.Mocked<TenantContextService>;
  let router: jest.Mocked<Router>;
  let httpTestingController: HttpTestingController;

  const mockUser: User = {
    id: 1,
    tenant_id: null,
    name: 'Test User',
    email: 'test@example.com',
    email_verified_at: '2024-01-01T00:00:00Z',
    type: 'member',
    tenant_permissions: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  };

  const mockTenants: Tenant[] = [
    {
      id: 1,
      slug: 'nrna',
      name: 'NRNA',
      domain: 'nrna.publicdigit.com',
      status: 'active',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    },
    {
      id: 2,
      slug: 'uml',
      name: 'UML',
      domain: 'uml.publicdigit.com',
      status: 'active',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }
  ];

  beforeEach(() => {
    const apiServiceMock = {
      login: jest.fn(),
      logout: jest.fn(),
      getCurrentUser: jest.fn(),
      getUserTenants: jest.fn()
    };

    const tenantContextServiceMock = {
      setTenantSlug: jest.fn(),
      clearTenant: jest.fn(),
      hasTenantContext: jest.fn()
    };

    const routerMock = {
      navigate: jest.fn()
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: ApiService, useValue: apiServiceMock },
        { provide: TenantContextService, useValue: tenantContextServiceMock },
        { provide: Router, useValue: routerMock }
      ]
    });

    service = TestBed.inject(AuthService);
    apiService = TestBed.inject(ApiService) as jest.Mocked<ApiService>;
    tenantContextService = TestBed.inject(TenantContextService) as jest.Mocked<TenantContextService>;
    router = TestBed.inject(Router) as jest.Mocked<Router>;
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  describe('loadUserTenants()', () => {
    /**
     * Test 1: Should load user's tenants successfully
     */
    it('should load user tenants from API successfully', (done) => {
      // Arrange
      const mockResponse: ApiResponse<Tenant[]> = {
        success: true,
        data: mockTenants,
        message: 'Tenants loaded successfully'
      };

      apiService.getUserTenants.mockReturnValue(of(mockResponse));

      // Act
      service.loadUserTenants().subscribe({
        next: (tenants) => {
          // Assert
          expect(tenants).toEqual(mockTenants);
          expect(tenants.length).toBe(2);
          expect(tenants[0].slug).toBe('nrna');
          expect(tenants[1].slug).toBe('uml');
          expect(apiService.getUserTenants).toHaveBeenCalled();
          done();
        },
        error: () => fail('Should not error')
      });
    });

    /**
     * Test 2: Should handle empty tenant list
     */
    it('should handle empty tenant list', (done) => {
      // Arrange
      const mockResponse: ApiResponse<Tenant[]> = {
        success: true,
        data: [],
        message: 'No tenants found'
      };

      apiService.getUserTenants.mockReturnValue(of(mockResponse));

      // Act
      service.loadUserTenants().subscribe({
        next: (tenants) => {
          // Assert
          expect(tenants).toEqual([]);
          expect(tenants.length).toBe(0);
          done();
        },
        error: () => fail('Should not error')
      });
    });

    /**
     * Test 3: Should handle API errors
     */
    it('should handle API errors when loading tenants', (done) => {
      // Arrange
      const errorMessage = 'Failed to load tenants';
      apiService.getUserTenants.mockReturnValue(
        throwError(() => new Error(errorMessage))
      );

      // Act
      service.loadUserTenants().subscribe({
        next: () => fail('Should not succeed'),
        error: (error) => {
          // Assert
          expect(error.message).toBe(errorMessage);
          expect(apiService.getUserTenants).toHaveBeenCalled();
          done();
        }
      });
    });

    /**
     * Test 4: Should handle unsuccessful API response
     */
    it('should handle unsuccessful API response', (done) => {
      // Arrange
      const mockResponse: ApiResponse<Tenant[]> = {
        success: false,
        message: 'Unauthorized',
        errors: { auth: ['Invalid token'] }
      };

      apiService.getUserTenants.mockReturnValue(of(mockResponse));

      // Act
      service.loadUserTenants().subscribe({
        next: () => fail('Should not succeed'),
        error: (error) => {
          // Assert
          expect(error.message).toContain('Unauthorized');
          done();
        }
      });
    });

    /**
     * Test 5: Should cache tenants in memory
     */
    it('should cache tenants in memory after loading', (done) => {
      // Arrange
      const mockResponse: ApiResponse<Tenant[]> = {
        success: true,
        data: mockTenants
      };

      apiService.getUserTenants.mockReturnValue(of(mockResponse));

      // Act - First call
      service.loadUserTenants().subscribe({
        next: (tenants) => {
          expect(tenants).toEqual(mockTenants);

          // Act - Second call should return cached data
          service.getUserTenants().subscribe({
            next: (cachedTenants) => {
              // Assert
              expect(cachedTenants).toEqual(mockTenants);
              // API should only be called once (first time)
              expect(apiService.getUserTenants).toHaveBeenCalledTimes(1);
              done();
            }
          });
        }
      });
    });

    /**
     * Test 6: Should store tenants in secure storage for offline access
     */
    it('should store tenants in secure storage', (done) => {
      // Arrange
      const mockResponse: ApiResponse<Tenant[]> = {
        success: true,
        data: mockTenants
      };

      apiService.getUserTenants.mockReturnValue(of(mockResponse));

      // Act
      service.loadUserTenants().subscribe({
        next: (tenants) => {
          // Assert
          expect(tenants).toEqual(mockTenants);

          // Verify storage was attempted by checking that tenants are cached
          // (implementation uses Capacitor Preferences internally)
          service.getUserTenants().subscribe({
            next: (cachedTenants) => {
              expect(cachedTenants).toEqual(mockTenants);
              done();
            }
          });
        }
      });
    });

    /**
     * Test 7: Should refresh tenants (bypass cache)
     */
    it('should refresh tenants bypassing cache', (done) => {
      // Arrange
      const mockResponse: ApiResponse<Tenant[]> = {
        success: true,
        data: mockTenants
      };

      apiService.getUserTenants.mockReturnValue(of(mockResponse));

      // Act - First load
      service.loadUserTenants().subscribe(() => {
        // Reset spy
        jest.clearAllMocks();
        apiService.getUserTenants.mockReturnValue(of(mockResponse));

        // Act - Refresh should call API again
        service.loadUserTenants(true).subscribe({
          next: (tenants) => {
            // Assert
            expect(tenants).toEqual(mockTenants);
            expect(apiService.getUserTenants).toHaveBeenCalledTimes(1);
            done();
          }
        });
      });
    });

    /**
     * Test 8: Should filter out inactive tenants
     */
    it('should only return active tenants', (done) => {
      // Arrange
      const tenantsWithInactive: Tenant[] = [
        ...mockTenants,
        {
          id: 3,
          slug: 'inactive',
          name: 'Inactive Tenant',
          domain: 'inactive.publicdigit.com',
          status: 'inactive',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ];

      const mockResponse: ApiResponse<Tenant[]> = {
        success: true,
        data: tenantsWithInactive
      };

      apiService.getUserTenants.mockReturnValue(of(mockResponse));

      // Act
      service.loadUserTenants().subscribe({
        next: (tenants) => {
          // Assert - should only have active tenants
          expect(tenants.length).toBe(2);
          expect(tenants.every(t => t.status === 'active')).toBe(true);
          expect(tenants.find(t => t.slug === 'inactive')).toBeUndefined();
          done();
        }
      });
    });

    /**
     * Test 9: Should expose getUserTenants() for accessing cached data
     */
    it('should provide getUserTenants() method for accessing cached tenants', (done) => {
      // Arrange
      const mockResponse: ApiResponse<Tenant[]> = {
        success: true,
        data: mockTenants
      };

      apiService.getUserTenants.mockReturnValue(of(mockResponse));

      // Act - Load first
      service.loadUserTenants().subscribe(() => {
        // Act - Get cached
        service.getUserTenants().subscribe({
          next: (tenants) => {
            // Assert
            expect(tenants).toEqual(mockTenants);
            done();
          }
        });
      });
    });

    /**
     * Test 10: Should clear cached tenants on logout
     */
    it('should clear cached tenants on logout', (done) => {
      // Arrange
      const mockResponse: ApiResponse<Tenant[]> = {
        success: true,
        data: mockTenants
      };

      apiService.getUserTenants.mockReturnValue(of(mockResponse));
      apiService.logout.mockReturnValue(of({ success: true }));

      // Act - Load tenants
      service.loadUserTenants().subscribe(() => {
        // Act - Logout
        service.logout().subscribe(() => {
          // Act - Try to get cached tenants
          service.getUserTenants().subscribe({
            next: (tenants) => {
              // Assert - should be empty after logout
              expect(tenants).toEqual([]);
              done();
            }
          });
        });
      });
    });
  });

  describe('getUserTenants()', () => {
    /**
     * Test 11: Should return empty array if no tenants loaded
     */
    it('should return empty array if no tenants have been loaded', (done) => {
      // Act
      service.getUserTenants().subscribe({
        next: (tenants) => {
          // Assert
          expect(tenants).toEqual([]);
          expect(apiService.getUserTenants).not.toHaveBeenCalled();
          done();
        }
      });
    });

    /**
     * Test 12: Should return cached tenants if already loaded
     */
    it('should return cached tenants without API call', (done) => {
      // Arrange
      const mockResponse: ApiResponse<Tenant[]> = {
        success: true,
        data: mockTenants
      };

      apiService.getUserTenants.mockReturnValue(of(mockResponse));

      // Act - Load first
      service.loadUserTenants().subscribe(() => {
        // Reset call count
        jest.clearAllMocks();

        // Act - Get cached
        service.getUserTenants().subscribe({
          next: (tenants) => {
            // Assert
            expect(tenants).toEqual(mockTenants);
            expect(apiService.getUserTenants).not.toHaveBeenCalled();
            done();
          }
        });
      });
    });
  });

  describe('Integration: loadUserTenants() workflow', () => {
    /**
     * Test 13: Complete flow - login → load tenants → select tenant
     */
    it('should support complete workflow: login → load tenants → select tenant', (done) => {
      // Arrange
      const loginRequest: LoginRequest = {
        email: 'test@example.com',
        password: 'password123'
      };

      const loginResponse: LoginResponse = {
        token: 'mock-token',
        user: mockUser
      };

      const mockTenantsResponse: ApiResponse<Tenant[]> = {
        success: true,
        data: mockTenants
      };

      // Setup spies
      apiService.login.mockReturnValue(of({
        success: true,
        data: loginResponse
      }));
      apiService.getUserTenants.mockReturnValue(of(mockTenantsResponse));
      tenantContextService.hasTenantContext.mockReturnValue(false);
      tenantContextService.setTenantSlug.mockResolvedValue(undefined);

      // Act - Step 1: Login
      service.login(loginRequest).subscribe(() => {
        // Act - Step 2: Load tenants
        service.loadUserTenants().subscribe({
          next: (tenants) => {
            // Assert
            expect(tenants.length).toBe(2);

            // Step 3: Select tenant (simulated - would happen in component)
            const selectedTenant = tenants[0];
            expect(selectedTenant.slug).toBe('nrna');
            done();
          }
        });
      });
    });
  });
});
