import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TenantGuard } from './tenant.guard';
import { TenantContextService } from '../services/tenant-context.service';
import { DomainService } from '../services/domain.service';

/**
 * TenantGuard Test Suite (TDD)
 *
 * Tests tenant context requirement for route protection
 * Following TDD approach: Write tests FIRST, then implement
 *
 * Guard Purpose:
 * - Verify tenant context is set before allowing route access
 * - Redirect to tenant selection if no tenant context
 * - Allow navigation if tenant context exists
 */
describe('TenantGuard', () => {
  let guard: TenantGuard;
  let tenantContextService: jasmine.SpyObj<TenantContextService>;
  let domainService: jasmine.SpyObj<DomainService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    const tenantContextServiceSpy = jasmine.createSpyObj('TenantContextService', [
      'hasTenant',
      'getCurrentTenant',
      'getTenantSlug'
    ]);

    const domainServiceSpy = jasmine.createSpyObj('DomainService', [
      'getCurrentDomainInfo',
      'isTenantDomain'
    ]);

    const routerSpy = jasmine.createSpyObj('Router', ['navigate', 'createUrlTree']);

    TestBed.configureTestingModule({
      providers: [
        TenantGuard,
        { provide: TenantContextService, useValue: tenantContextServiceSpy },
        { provide: DomainService, useValue: domainServiceSpy },
        { provide: Router, useValue: routerSpy }
      ]
    });

    guard = TestBed.inject(TenantGuard);
    tenantContextService = TestBed.inject(TenantContextService) as jasmine.SpyObj<TenantContextService>;
    domainService = TestBed.inject(DomainService) as jasmine.SpyObj<DomainService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });

  describe('canActivate', () => {
    it('should allow navigation when tenant context exists', () => {
      // Arrange
      tenantContextService.hasTenant.and.returnValue(true);
      tenantContextService.getTenantSlug.and.returnValue('nrna');

      // Act
      const result = guard.canActivate();

      // Assert
      expect(result).toBe(true);
      expect(tenantContextService.hasTenant).toHaveBeenCalled();
    });

    it('should block navigation when no tenant context', () => {
      // Arrange
      tenantContextService.hasTenant.and.returnValue(false);
      const urlTree = router.createUrlTree(['/tenant-selection']);
      router.createUrlTree.and.returnValue(urlTree as any);

      // Act
      const result = guard.canActivate();

      // Assert
      expect(result).toBe(urlTree);
      expect(router.createUrlTree).toHaveBeenCalledWith(['/tenant-selection']);
    });

    it('should redirect to tenant selection with error message when tenant context missing', () => {
      // Arrange
      tenantContextService.hasTenant.and.returnValue(false);
      const urlTree = router.createUrlTree(['/tenant-selection']);
      router.createUrlTree.and.returnValue(urlTree as any);

      // Act
      const result = guard.canActivate();

      // Assert
      expect(router.createUrlTree).toHaveBeenCalledWith(['/tenant-selection'], jasmine.objectContaining({
        queryParams: jasmine.objectContaining({
          error: 'tenant-context-required'
        })
      }));
    });

    it('should allow navigation on tenant domain when context is set', () => {
      // Arrange
      domainService.isTenantDomain.and.returnValue(true);
      tenantContextService.hasTenant.and.returnValue(true);
      tenantContextService.getCurrentTenant.and.returnValue({
        id: 1,
        slug: 'nrna',
        name: 'NRNA',
        status: 'active'
      });

      // Act
      const result = guard.canActivate();

      // Assert
      expect(result).toBe(true);
    });

    it('should block navigation on tenant domain when context is not set', () => {
      // Arrange
      domainService.isTenantDomain.and.returnValue(true);
      tenantContextService.hasTenant.and.returnValue(false);
      const urlTree = router.createUrlTree(['/tenant-selection']);
      router.createUrlTree.and.returnValue(urlTree as any);

      // Act
      const result = guard.canActivate();

      // Assert
      expect(result).toBe(urlTree);
    });
  });

  describe('canActivateChild', () => {
    it('should delegate to canActivate for child routes', () => {
      // Arrange
      tenantContextService.hasTenant.and.returnValue(true);
      spyOn(guard, 'canActivate').and.returnValue(true);

      // Act
      const result = guard.canActivateChild();

      // Assert
      expect(guard.canActivate).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should block child routes when tenant context missing', () => {
      // Arrange
      tenantContextService.hasTenant.and.returnValue(false);
      const urlTree = router.createUrlTree(['/tenant-selection']);
      router.createUrlTree.and.returnValue(urlTree as any);
      spyOn(guard, 'canActivate').and.returnValue(urlTree);

      // Act
      const result = guard.canActivateChild();

      // Assert
      expect(result).toBe(urlTree);
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', () => {
      // Arrange
      tenantContextService.hasTenant.and.throwError('Service error');
      const urlTree = router.createUrlTree(['/tenant-selection']);
      router.createUrlTree.and.returnValue(urlTree as any);

      // Act
      const result = guard.canActivate();

      // Assert
      expect(result).toBe(urlTree);
      expect(router.createUrlTree).toHaveBeenCalled();
    });

    it('should log warning when tenant context check fails', () => {
      // Arrange
      spyOn(console, 'warn');
      tenantContextService.hasTenant.and.returnValue(false);
      const urlTree = router.createUrlTree(['/tenant-selection']);
      router.createUrlTree.and.returnValue(urlTree as any);

      // Act
      guard.canActivate();

      // Assert
      expect(console.warn).toHaveBeenCalledWith(
        jasmine.stringContaining('Tenant context required')
      );
    });
  });

  describe('Integration with Domain Service', () => {
    it('should verify tenant domain before checking context', () => {
      // Arrange
      domainService.isTenantDomain.and.returnValue(true);
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
      tenantContextService.hasTenant.and.returnValue(true);

      // Act
      const result = guard.canActivate();

      // Assert
      expect(domainService.getCurrentDomainInfo).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should skip tenant check on public domain', () => {
      // Arrange
      domainService.isTenantDomain.and.returnValue(false);
      domainService.getCurrentDomainInfo.and.returnValue({
        type: 'public',
        hostname: 'www.publicdigit.com',
        isPublicDomain: true,
        isLandlordDomain: false,
        isTenantDomain: false,
        isMobileDomain: false,
        isPlatformDomain: false
      });

      // Act
      const result = guard.canActivate();

      // Assert
      // On public domain, guard should allow navigation (tenant context not required)
      expect(result).toBe(true);
    });
  });

  describe('Tenant Context Validation', () => {
    it('should verify tenant slug matches domain', () => {
      // Arrange
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
      tenantContextService.hasTenant.and.returnValue(true);
      tenantContextService.getTenantSlug.and.returnValue('nrna');

      // Act
      const result = guard.canActivate();

      // Assert
      expect(result).toBe(true);
      expect(tenantContextService.getTenantSlug).toHaveBeenCalled();
    });

    it('should block when tenant slug mismatch', () => {
      // Arrange
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
      tenantContextService.hasTenant.and.returnValue(true);
      tenantContextService.getTenantSlug.and.returnValue('different-tenant');
      const urlTree = router.createUrlTree(['/tenant-selection']);
      router.createUrlTree.and.returnValue(urlTree as any);

      // Act
      const result = guard.canActivate();

      // Assert
      expect(result).toBe(urlTree);
      expect(router.createUrlTree).toHaveBeenCalledWith(['/tenant-selection'], jasmine.objectContaining({
        queryParams: jasmine.objectContaining({
          error: 'tenant-mismatch'
        })
      }));
    });
  });
});
