import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AppInitService } from './app-init.service';
import { DomainService } from './domain.service';
import { ArchitectureService } from './architecture.service';

/**
 * AppInitService Test Suite
 *
 * Tests application initialization and bootstrap orchestration
 */
describe('AppInitService', () => {
  let service: AppInitService;
  let domainService: jasmine.SpyObj<DomainService>;
  let architectureService: jasmine.SpyObj<ArchitectureService>;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    const domainServiceSpy = jasmine.createSpyObj('DomainService', [
      'getCurrentDomainInfo',
      'getApiBaseUrl'
    ]);

    const architectureServiceSpy = jasmine.createSpyObj('ArchitectureService', [
      'loadBoundaries',
      'getCurrentBoundaries',
      'canAccessRoute'
    ]);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AppInitService,
        { provide: DomainService, useValue: domainServiceSpy },
        { provide: ArchitectureService, useValue: architectureServiceSpy }
      ]
    });

    service = TestBed.inject(AppInitService);
    domainService = TestBed.inject(DomainService) as jasmine.SpyObj<DomainService>;
    architectureService = TestBed.inject(ArchitectureService) as jasmine.SpyObj<ArchitectureService>;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      domainService.getCurrentDomainInfo.and.returnValue({
        type: 'public',
        hostname: 'www.publicdigit.com',
        isPublicDomain: true,
        isLandlordDomain: false,
        isTenantDomain: false,
        isMobileDomain: false,
        isPlatformDomain: false
      });

      architectureService.loadBoundaries.and.returnValue(Promise.resolve());

      const result = await service.initialize();

      expect(result).toBe(true);
      expect(architectureService.loadBoundaries).toHaveBeenCalled();
    });

    it('should handle initialization failure gracefully', async () => {
      domainService.getCurrentDomainInfo.and.returnValue({
        type: 'unknown',
        hostname: 'invalid.domain.com',
        isPublicDomain: false,
        isLandlordDomain: false,
        isTenantDomain: false,
        isMobileDomain: false,
        isPlatformDomain: false
      });

      architectureService.loadBoundaries.and.returnValue(Promise.reject('Failed to load'));

      const result = await service.initialize();

      // Should fail gracefully and return false
      expect(result).toBe(false);
    });

    it('should detect domain type during initialization', async () => {
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
      architectureService.loadBoundaries.and.returnValue(Promise.resolve());

      await service.initialize();

      const config = service.getInitConfig();

      expect(config.domainType).toBe('tenant');
      expect(config.tenantSlug).toBe('nrna');
    });
  });

  describe('Domain Detection Step', () => {
    it('should detect public domain', async () => {
      domainService.getCurrentDomainInfo.and.returnValue({
        type: 'public',
        hostname: 'www.publicdigit.com',
        isPublicDomain: true,
        isLandlordDomain: false,
        isTenantDomain: false,
        isMobileDomain: false,
        isPlatformDomain: false
      });

      architectureService.loadBoundaries.and.returnValue(Promise.resolve());

      await service.initialize();

      expect(service.getDomainType()).toBe('public');
    });

    it('should detect tenant domain and extract slug', async () => {
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
      architectureService.loadBoundaries.and.returnValue(Promise.resolve());

      await service.initialize();

      expect(service.getDomainType()).toBe('tenant');
      expect(service.getTenantSlug()).toBe('nrna');
    });
  });

  describe('Architecture Boundaries Loading', () => {
    it('should load architecture boundaries', async () => {
      domainService.getCurrentDomainInfo.and.returnValue({
        type: 'public',
        hostname: 'www.publicdigit.com',
        isPublicDomain: true,
        isLandlordDomain: false,
        isTenantDomain: false,
        isMobileDomain: false,
        isPlatformDomain: false
      });

      architectureService.loadBoundaries.and.returnValue(Promise.resolve());

      await service.initialize();

      const config = service.getInitConfig();

      expect(config.architectureBoundariesLoaded).toBe(true);
    });

    it('should continue if boundaries fail to load', async () => {
      domainService.getCurrentDomainInfo.and.returnValue({
        type: 'public',
        hostname: 'www.publicdigit.com',
        isPublicDomain: true,
        isLandlordDomain: false,
        isTenantDomain: false,
        isMobileDomain: false,
        isPlatformDomain: false
      });

      architectureService.loadBoundaries.and.returnValue(Promise.reject('Network error'));

      const result = await service.initialize();

      // Should continue despite boundaries failure
      expect(result).toBe(false);

      const config = service.getInitConfig();
      expect(config.architectureBoundariesLoaded).toBe(false);
    });
  });

  describe('Authentication Initialization', () => {
    it('should detect stored auth token', async () => {
      localStorage.setItem('auth_token', 'test-token-123');

      domainService.getCurrentDomainInfo.and.returnValue({
        type: 'public',
        hostname: 'www.publicdigit.com',
        isPublicDomain: true,
        isLandlordDomain: false,
        isTenantDomain: false,
        isMobileDomain: false,
        isPlatformDomain: false
      });

      domainService.getApiBaseUrl.and.returnValue('http://localhost:8000');
      architectureService.loadBoundaries.and.returnValue(Promise.resolve());

      const initPromise = service.initialize();

      // Mock token validation request
      const req = httpMock.expectOne('http://localhost:8000/api/v1/auth/me');
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token-123');

      req.flush({ id: 1, name: 'Test User' });

      await initPromise;

      expect(service.isAuthenticationInitialized()).toBe(true);
    });

    it('should clear invalid auth token', async () => {
      localStorage.setItem('auth_token', 'invalid-token');

      domainService.getCurrentDomainInfo.and.returnValue({
        type: 'public',
        hostname: 'www.publicdigit.com',
        isPublicDomain: true,
        isLandlordDomain: false,
        isTenantDomain: false,
        isMobileDomain: false,
        isPlatformDomain: false
      });

      domainService.getApiBaseUrl.and.returnValue('http://localhost:8000');
      architectureService.loadBoundaries.and.returnValue(Promise.resolve());

      const initPromise = service.initialize();

      // Mock token validation failure
      const req = httpMock.expectOne('http://localhost:8000/api/v1/auth/me');
      req.flush({ error: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

      await initPromise;

      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(service.isAuthenticationInitialized()).toBe(false);
    });

    it('should handle no auth token', async () => {
      domainService.getCurrentDomainInfo.and.returnValue({
        type: 'public',
        hostname: 'www.publicdigit.com',
        isPublicDomain: true,
        isLandlordDomain: false,
        isTenantDomain: false,
        isMobileDomain: false,
        isPlatformDomain: false
      });

      architectureService.loadBoundaries.and.returnValue(Promise.resolve());

      await service.initialize();

      expect(service.isAuthenticationInitialized()).toBe(false);
    });
  });

  describe('Tenant Context Setup', () => {
    it('should set tenant context for tenant domain', async () => {
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
      architectureService.loadBoundaries.and.returnValue(Promise.resolve());

      const initPromise = service.initialize();

      // Mock tenant info request
      const req = httpMock.expectOne('https://nrna.publicdigit.com/api/v1/tenants/nrna');
      req.flush({
        id: 1,
        slug: 'nrna',
        name: 'NRNA',
        status: 'active'
      });

      await initPromise;

      const config = service.getInitConfig();
      expect(config.tenantContextSet).toBe(true);
      expect(localStorage.getItem('current_tenant_slug')).toBe('nrna');
    });

    it('should not set tenant context for public domain', async () => {
      domainService.getCurrentDomainInfo.and.returnValue({
        type: 'public',
        hostname: 'www.publicdigit.com',
        isPublicDomain: true,
        isLandlordDomain: false,
        isTenantDomain: false,
        isMobileDomain: false,
        isPlatformDomain: false
      });

      architectureService.loadBoundaries.and.returnValue(Promise.resolve());

      await service.initialize();

      const config = service.getInitConfig();
      expect(config.tenantContextSet).toBe(false);
    });
  });

  describe('Re-initialization', () => {
    it('should reset config and re-initialize', async () => {
      domainService.getCurrentDomainInfo.and.returnValue({
        type: 'public',
        hostname: 'www.publicdigit.com',
        isPublicDomain: true,
        isLandlordDomain: false,
        isTenantDomain: false,
        isMobileDomain: false,
        isPlatformDomain: false
      });

      architectureService.loadBoundaries.and.returnValue(Promise.resolve());

      // Initial initialization
      await service.initialize();
      expect(service.isInitialized()).toBe(true);

      // Re-initialize
      const result = await service.reinitialize();

      expect(result).toBe(true);
      expect(service.isInitialized()).toBe(true);
    });
  });

  describe('Configuration Getters', () => {
    it('should return initialization config', async () => {
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
      architectureService.loadBoundaries.and.returnValue(Promise.resolve());

      const initPromise = service.initialize();

      const req = httpMock.expectOne('https://nrna.publicdigit.com/api/v1/tenants/nrna');
      req.flush({ id: 1, slug: 'nrna', name: 'NRNA' });

      await initPromise;

      const config = service.getInitConfig();

      expect(config.domainType).toBe('tenant');
      expect(config.tenantSlug).toBe('nrna');
      expect(config.initialized).toBe(true);
      expect(config.tenantContextSet).toBe(true);
    });

    it('should check if on tenant domain', async () => {
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
      architectureService.loadBoundaries.and.returnValue(Promise.resolve());

      const initPromise = service.initialize();

      const req = httpMock.expectOne('https://nrna.publicdigit.com/api/v1/tenants/nrna');
      req.flush({ id: 1, slug: 'nrna' });

      await initPromise;

      expect(service.isTenantDomain()).toBe(true);
    });
  });
});
