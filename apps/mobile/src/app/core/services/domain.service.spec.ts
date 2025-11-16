import { TestBed } from '@angular/core/testing';
import { DomainService, DomainType, DomainInfo } from './domain.service';

/**
 * DomainService Test Suite
 *
 * Tests domain detection, tenant slug extraction, and navigation utilities
 */
describe('DomainService', () => {
  let service: DomainService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DomainService]
    });
    service = TestBed.inject(DomainService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Domain Type Detection', () => {
    it('should detect public domain (www.publicdigit.com)', () => {
      spyOnProperty(window.location, 'hostname', 'get').and.returnValue('www.publicdigit.com');

      const domainType = service.detectDomainType();

      expect(domainType).toBe('public');
    });

    it('should detect public domain (publicdigit.com)', () => {
      spyOnProperty(window.location, 'hostname', 'get').and.returnValue('publicdigit.com');

      const domainType = service.detectDomainType();

      expect(domainType).toBe('public');
    });

    it('should detect landlord domain (admin.publicdigit.com)', () => {
      spyOnProperty(window.location, 'hostname', 'get').and.returnValue('admin.publicdigit.com');

      const domainType = service.detectDomainType();

      expect(domainType).toBe('landlord');
    });

    it('should detect mobile domain (app.publicdigit.com)', () => {
      spyOnProperty(window.location, 'hostname', 'get').and.returnValue('app.publicdigit.com');

      const domainType = service.detectDomainType();

      expect(domainType).toBe('mobile');
    });

    it('should detect platform domain (api.publicdigit.com)', () => {
      spyOnProperty(window.location, 'hostname', 'get').and.returnValue('api.publicdigit.com');

      const domainType = service.detectDomainType();

      expect(domainType).toBe('platform');
    });

    it('should detect tenant domain (nrna.publicdigit.com)', () => {
      spyOnProperty(window.location, 'hostname', 'get').and.returnValue('nrna.publicdigit.com');

      const domainType = service.detectDomainType();

      expect(domainType).toBe('tenant');
    });

    it('should detect tenant domain (tenant.localhost)', () => {
      spyOnProperty(window.location, 'hostname', 'get').and.returnValue('tenant.localhost');

      const domainType = service.detectDomainType();

      expect(domainType).toBe('tenant');
    });

    it('should return unknown for unrecognized domain', () => {
      spyOnProperty(window.location, 'hostname', 'get').and.returnValue('unknown.domain.com');

      const domainType = service.detectDomainType();

      expect(domainType).toBe('unknown');
    });
  });

  describe('Tenant Slug Extraction', () => {
    it('should extract tenant slug from production domain', () => {
      spyOnProperty(window.location, 'hostname', 'get').and.returnValue('nrna.publicdigit.com');

      const slug = service.extractTenantSlug();

      expect(slug).toBe('nrna');
    });

    it('should extract tenant slug from development domain', () => {
      spyOnProperty(window.location, 'hostname', 'get').and.returnValue('nrna.localhost');

      const slug = service.extractTenantSlug();

      expect(slug).toBe('nrna');
    });

    it('should return null for public domain', () => {
      spyOnProperty(window.location, 'hostname', 'get').and.returnValue('www.publicdigit.com');

      const slug = service.extractTenantSlug();

      expect(slug).toBeNull();
    });

    it('should return null for admin domain', () => {
      spyOnProperty(window.location, 'hostname', 'get').and.returnValue('admin.publicdigit.com');

      const slug = service.extractTenantSlug();

      expect(slug).toBeNull();
    });

    it('should return null for reserved subdomain (admin)', () => {
      spyOnProperty(window.location, 'hostname', 'get').and.returnValue('admin.publicdigit.com');

      const slug = service.extractTenantSlug();

      expect(slug).toBeNull();
    });

    it('should return null for reserved subdomain (api)', () => {
      spyOnProperty(window.location, 'hostname', 'get').and.returnValue('api.publicdigit.com');

      const slug = service.extractTenantSlug();

      expect(slug).toBeNull();
    });

    it('should validate tenant slug format (valid)', () => {
      spyOnProperty(window.location, 'hostname', 'get').and.returnValue('valid-tenant.publicdigit.com');

      const slug = service.extractTenantSlug();

      expect(slug).toBe('valid-tenant');
    });

    it('should reject invalid tenant slug (too short)', () => {
      spyOnProperty(window.location, 'hostname', 'get').and.returnValue('a.publicdigit.com');

      const slug = service.extractTenantSlug();

      expect(slug).toBeNull();
    });
  });

  describe('Domain Information', () => {
    it('should return complete domain info for public domain', () => {
      spyOnProperty(window.location, 'hostname', 'get').and.returnValue('www.publicdigit.com');

      const info = service.getCurrentDomainInfo();

      expect(info.type).toBe('public');
      expect(info.hostname).toBe('www.publicdigit.com');
      expect(info.isPublicDomain).toBe(true);
      expect(info.isLandlordDomain).toBe(false);
      expect(info.isTenantDomain).toBe(false);
      expect(info.isMobileDomain).toBe(false);
      expect(info.isPlatformDomain).toBe(false);
      expect(info.tenantSlug).toBeUndefined();
    });

    it('should return complete domain info for tenant domain', () => {
      spyOnProperty(window.location, 'hostname', 'get').and.returnValue('nrna.publicdigit.com');

      const info = service.getCurrentDomainInfo();

      expect(info.type).toBe('tenant');
      expect(info.hostname).toBe('nrna.publicdigit.com');
      expect(info.isPublicDomain).toBe(false);
      expect(info.isLandlordDomain).toBe(false);
      expect(info.isTenantDomain).toBe(true);
      expect(info.isMobileDomain).toBe(false);
      expect(info.isPlatformDomain).toBe(false);
      expect(info.tenantSlug).toBe('nrna');
    });

    it('should emit domain info via observable', (done) => {
      spyOnProperty(window.location, 'hostname', 'get').and.returnValue('nrna.publicdigit.com');

      service.domainInfo$.subscribe(info => {
        expect(info.type).toBe('tenant');
        expect(info.tenantSlug).toBe('nrna');
        done();
      });
    });
  });

  describe('URL Building', () => {
    it('should build correct URL for public domain', () => {
      spyOnProperty(window.location, 'protocol', 'get').and.returnValue('https:');

      const url = service.buildDomainUrl('public', '/pricing');

      expect(url).toBe('https://www.publicdigit.com/pricing');
    });

    it('should build correct URL for landlord domain', () => {
      spyOnProperty(window.location, 'protocol', 'get').and.returnValue('https:');

      const url = service.buildDomainUrl('landlord', '/admin/dashboard');

      expect(url).toBe('https://admin.publicdigit.com/admin/dashboard');
    });

    it('should build correct URL for mobile domain', () => {
      spyOnProperty(window.location, 'protocol', 'get').and.returnValue('https:');

      const url = service.buildDomainUrl('mobile', '/elections');

      expect(url).toBe('https://app.publicdigit.com/elections');
    });

    it('should build correct tenant URL', () => {
      spyOnProperty(window.location, 'protocol', 'get').and.returnValue('https:');

      const url = service.buildTenantUrl('nrna', '/elections');

      expect(url).toBe('https://nrna.publicdigit.com/elections');
    });

    it('should use default path when not provided', () => {
      spyOnProperty(window.location, 'protocol', 'get').and.returnValue('https:');

      const url = service.buildTenantUrl('nrna');

      expect(url).toBe('https://nrna.publicdigit.com/');
    });
  });

  describe('Environment Detection', () => {
    it('should detect development environment (localhost)', () => {
      spyOnProperty(window.location, 'hostname', 'get').and.returnValue('localhost');

      const isDev = service.isDevelopment();

      expect(isDev).toBe(true);
    });

    it('should detect development environment (*.localhost)', () => {
      spyOnProperty(window.location, 'hostname', 'get').and.returnValue('nrna.localhost');

      const isDev = service.isDevelopment();

      expect(isDev).toBe(true);
    });

    it('should detect production environment', () => {
      spyOnProperty(window.location, 'hostname', 'get').and.returnValue('nrna.publicdigit.com');

      const isDev = service.isDevelopment();
      const isProd = service.isProduction();

      expect(isDev).toBe(false);
      expect(isProd).toBe(true);
    });
  });

  describe('API Base URL', () => {
    it('should return localhost URL in development', () => {
      spyOnProperty(window.location, 'hostname', 'get').and.returnValue('localhost');

      const apiUrl = service.getApiBaseUrl();

      expect(apiUrl).toBe('http://localhost:8000');
    });

    it('should return current origin in production', () => {
      spyOnProperty(window.location, 'hostname', 'get').and.returnValue('nrna.publicdigit.com');
      spyOnProperty(window.location, 'origin', 'get').and.returnValue('https://nrna.publicdigit.com');

      const apiUrl = service.getApiBaseUrl();

      expect(apiUrl).toBe('https://nrna.publicdigit.com');
    });
  });

  describe('Reserved Subdomains', () => {
    it('should have reserved subdomains list', () => {
      const reflection = (service as any);

      expect(reflection.reservedSubdomains).toContain('admin');
      expect(reflection.reservedSubdomains).toContain('api');
      expect(reflection.reservedSubdomains).toContain('www');
      expect(reflection.reservedSubdomains).toContain('app');
    });

    it('should not extract reserved subdomain as tenant slug', () => {
      spyOnProperty(window.location, 'hostname', 'get').and.returnValue('admin.publicdigit.com');

      const slug = service.extractTenantSlug();

      expect(slug).toBeNull();
    });
  });
});
