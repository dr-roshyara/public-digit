import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TenantContextService, Tenant } from './tenant-context.service';
import { DomainService } from './domain.service';

/**
 * TenantContextService Test Suite (TDD)
 *
 * Tests tenant context management for Angular application
 * Following TDD approach: Write tests FIRST, then implement
 */
describe('TenantContextService', () => {
  let service: TenantContextService;
  let httpMock: HttpTestingController;
  let domainService: jasmine.SpyObj<DomainService>;

  beforeEach(() => {
    const domainServiceSpy = jasmine.createSpyObj('DomainService', [
      'getCurrentDomainInfo',
      'getApiBaseUrl',
      'extractTenantSlug',
      'isDevelopment'
    ]);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        TenantContextService,
        { provide: DomainService, useValue: domainServiceSpy }
      ]
    });

    service = TestBed.inject(TenantContextService);
    httpMock = TestBed.inject(HttpTestingController);
    domainService = TestBed.inject(DomainService) as jasmine.SpyObj<DomainService>;

    // Clear local storage before each test
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Tenant Loading', () => {
    it('should load tenant from slug', async () => {
      const mockTenant: Tenant = {
        id: 1,
        slug: 'nrna',
        name: 'NRNA',
        status: 'active',
        logo_url: 'https://example.com/logo.png'
      };

      domainService.getApiBaseUrl.and.returnValue('https://nrna.publicdigit.com');

      const loadPromise = service.loadTenant('nrna');

      const req = httpMock.expectOne('https://nrna.publicdigit.com/api/v1/tenant/info');
      expect(req.request.method).toBe('GET');

      req.flush({
        success: true,
        data: mockTenant
      });

      const result = await loadPromise;

      expect(result).toEqual(mockTenant);
      expect(service.getCurrentTenant()).toEqual(mockTenant);
    });

    it('should handle tenant loading failure', async () => {
      domainService.getApiBaseUrl.and.returnValue('https://nrna.publicdigit.com');

      const loadPromise = service.loadTenant('nrna');

      const req = httpMock.expectOne('https://nrna.publicdigit.com/api/v1/tenant/info');
      req.flush({ success: false, message: 'Tenant not found' }, { status: 404, statusText: 'Not Found' });

      await expectAsync(loadPromise).toBeRejectedWithError('Tenant not found');
    });

    it('should emit tenant change via observable', (done) => {
      const mockTenant: Tenant = {
        id: 1,
        slug: 'nrna',
        name: 'NRNA',
        status: 'active'
      };

      domainService.getApiBaseUrl.and.returnValue('https://nrna.publicdigit.com');

      service.tenant$.subscribe(tenant => {
        if (tenant) {
          expect(tenant).toEqual(mockTenant);
          done();
        }
      });

      service.loadTenant('nrna');

      const req = httpMock.expectOne('https://nrna.publicdigit.com/api/v1/tenant/info');
      req.flush({ success: true, data: mockTenant });
    });
  });

  describe('Initialization', () => {
    it('should initialize with tenant slug from domain', async () => {
      const mockTenant: Tenant = {
        id: 1,
        slug: 'nrna',
        name: 'NRNA',
        status: 'active'
      };

      domainService.getCurrentDomainInfo.and.returnValue({
        type: 'tenant',
        hostname: 'nrna.publicdigit.com',
        tenantSlug: 'nrna',
        isPublicDomain: false,
        isLandlordDomain: false,
        isTenantDomain: true,
        isMobileDomain: false,
        isPlatformDomain: false
      });

      domainService.getApiBaseUrl.and.returnValue('https://nrna.publicdigit.com');

      const initPromise = service.initialize();

      const req = httpMock.expectOne('https://nrna.publicdigit.com/api/v1/tenant/info');
      req.flush({ success: true, data: mockTenant });

      await initPromise;

      expect(service.getCurrentTenant()).toEqual(mockTenant);
    });

    it('should not initialize if not on tenant domain', async () => {
      domainService.getCurrentDomainInfo.and.returnValue({
        type: 'public',
        hostname: 'www.publicdigit.com',
        isPublicDomain: true,
        isLandlordDomain: false,
        isTenantDomain: false,
        isMobileDomain: false,
        isPlatformDomain: false
      });

      await service.initialize();

      expect(service.getCurrentTenant()).toBeNull();
      httpMock.expectNone(() => true);
    });

    it('should store tenant slug in localStorage', async () => {
      const mockTenant: Tenant = {
        id: 1,
        slug: 'nrna',
        name: 'NRNA',
        status: 'active'
      };

      domainService.getCurrentDomainInfo.and.returnValue({
        type: 'tenant',
        hostname: 'nrna.publicdigit.com',
        tenantSlug: 'nrna',
        isPublicDomain: false,
        isLandlordDomain: false,
        isTenantDomain: true,
        isMobileDomain: false,
        isPlatformDomain: false
      });

      domainService.getApiBaseUrl.and.returnValue('https://nrna.publicdigit.com');

      const initPromise = service.initialize();

      const req = httpMock.expectOne('https://nrna.publicdigit.com/api/v1/tenant/info');
      req.flush({ success: true, data: mockTenant });

      await initPromise;

      expect(localStorage.getItem('current_tenant_slug')).toBe('nrna');
      expect(localStorage.getItem('current_tenant')).toBeTruthy();
    });
  });

  describe('Tenant Context Management', () => {
    it('should return current tenant', async () => {
      const mockTenant: Tenant = {
        id: 1,
        slug: 'nrna',
        name: 'NRNA',
        status: 'active'
      };

      domainService.getApiBaseUrl.and.returnValue('https://nrna.publicdigit.com');

      await service.loadTenant('nrna');

      const req = httpMock.expectOne('https://nrna.publicdigit.com/api/v1/tenant/info');
      req.flush({ success: true, data: mockTenant });

      const current = service.getCurrentTenant();
      expect(current).toEqual(mockTenant);
    });

    it('should return null when no tenant loaded', () => {
      const current = service.getCurrentTenant();
      expect(current).toBeNull();
    });

    it('should check if tenant is loaded', async () => {
      expect(service.hasTenant()).toBe(false);

      const mockTenant: Tenant = {
        id: 1,
        slug: 'nrna',
        name: 'NRNA',
        status: 'active'
      };

      domainService.getApiBaseUrl.and.returnValue('https://nrna.publicdigit.com');

      const loadPromise = service.loadTenant('nrna');

      const req = httpMock.expectOne('https://nrna.publicdigit.com/api/v1/tenant/info');
      req.flush({ success: true, data: mockTenant });

      await loadPromise;

      expect(service.hasTenant()).toBe(true);
    });

    it('should get tenant slug', async () => {
      const mockTenant: Tenant = {
        id: 1,
        slug: 'nrna',
        name: 'NRNA',
        status: 'active'
      };

      domainService.getApiBaseUrl.and.returnValue('https://nrna.publicdigit.com');

      const loadPromise = service.loadTenant('nrna');

      const req = httpMock.expectOne('https://nrna.publicdigit.com/api/v1/tenant/info');
      req.flush({ success: true, data: mockTenant });

      await loadPromise;

      expect(service.getTenantSlug()).toBe('nrna');
    });
  });

  describe('Tenant Switching', () => {
    it('should clear current tenant', async () => {
      const mockTenant: Tenant = {
        id: 1,
        slug: 'nrna',
        name: 'NRNA',
        status: 'active'
      };

      domainService.getApiBaseUrl.and.returnValue('https://nrna.publicdigit.com');

      const loadPromise = service.loadTenant('nrna');

      const req = httpMock.expectOne('https://nrna.publicdigit.com/api/v1/tenant/info');
      req.flush({ success: true, data: mockTenant });

      await loadPromise;

      expect(service.hasTenant()).toBe(true);

      service.clearTenant();

      expect(service.hasTenant()).toBe(false);
      expect(service.getCurrentTenant()).toBeNull();
      expect(localStorage.getItem('current_tenant_slug')).toBeNull();
    });

    it('should switch to different tenant', async () => {
      const tenant1: Tenant = {
        id: 1,
        slug: 'tenant1',
        name: 'Tenant 1',
        status: 'active'
      };

      const tenant2: Tenant = {
        id: 2,
        slug: 'tenant2',
        name: 'Tenant 2',
        status: 'active'
      };

      domainService.getApiBaseUrl.and.returnValue('https://tenant1.publicdigit.com');

      // Load tenant1
      let loadPromise = service.loadTenant('tenant1');
      let req = httpMock.expectOne('https://tenant1.publicdigit.com/api/v1/tenant/info');
      req.flush({ success: true, data: tenant1 });
      await loadPromise;

      expect(service.getTenantSlug()).toBe('tenant1');

      // Switch to tenant2
      domainService.getApiBaseUrl.and.returnValue('https://tenant2.publicdigit.com');
      loadPromise = service.loadTenant('tenant2');
      req = httpMock.expectOne('https://tenant2.publicdigit.com/api/v1/tenant/info');
      req.flush({ success: true, data: tenant2 });
      await loadPromise;

      expect(service.getTenantSlug()).toBe('tenant2');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      domainService.getApiBaseUrl.and.returnValue('https://nrna.publicdigit.com');

      const loadPromise = service.loadTenant('nrna');

      const req = httpMock.expectOne('https://nrna.publicdigit.com/api/v1/tenant/info');
      req.error(new ErrorEvent('Network error'));

      await expectAsync(loadPromise).toBeRejected();
      expect(service.getCurrentTenant()).toBeNull();
    });

    it('should handle invalid tenant slug', async () => {
      domainService.getApiBaseUrl.and.returnValue('https://invalid.publicdigit.com');

      const loadPromise = service.loadTenant('invalid-tenant');

      const req = httpMock.expectOne('https://invalid.publicdigit.com/api/v1/tenant/info');
      req.flush(
        { success: false, message: 'Tenant not found' },
        { status: 404, statusText: 'Not Found' }
      );

      await expectAsync(loadPromise).toBeRejectedWithError('Tenant not found');
    });
  });

  describe('Caching', () => {
    it('should restore tenant from localStorage on init', async () => {
      const mockTenant: Tenant = {
        id: 1,
        slug: 'nrna',
        name: 'NRNA',
        status: 'active'
      };

      localStorage.setItem('current_tenant', JSON.stringify(mockTenant));
      localStorage.setItem('current_tenant_slug', 'nrna');

      domainService.getCurrentDomainInfo.and.returnValue({
        type: 'tenant',
        hostname: 'nrna.publicdigit.com',
        tenantSlug: 'nrna',
        isPublicDomain: false,
        isLandlordDomain: false,
        isTenantDomain: true,
        isMobileDomain: false,
        isPlatformDomain: false
      });

      // Should restore from cache, no HTTP call
      await service.initialize();

      // Verify restored from cache
      expect(service.getCurrentTenant()).toEqual(mockTenant);

      // No HTTP request should be made
      httpMock.expectNone(() => true);
    });
  });
});
