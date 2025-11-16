import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { PublicGuard } from './public.guard';
import { DomainService } from '../services/domain.service';

/**
 * PublicGuard Test Suite (TDD)
 *
 * Tests public route access control
 * Following TDD approach: Write tests FIRST, then implement
 *
 * Guard Purpose:
 * - Allow access to public routes on public domains
 * - Verify domain type before route activation
 */
describe('PublicGuard', () => {
  let guard: PublicGuard;
  let domainService: jasmine.SpyObj<DomainService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    const domainServiceSpy = jasmine.createSpyObj('DomainService', [
      'getCurrentDomainInfo',
      'isPublicDomain'
    ]);

    const routerSpy = jasmine.createSpyObj('Router', ['navigate', 'createUrlTree']);

    TestBed.configureTestingModule({
      providers: [
        PublicGuard,
        { provide: DomainService, useValue: domainServiceSpy },
        { provide: Router, useValue: routerSpy }
      ]
    });

    guard = TestBed.inject(PublicGuard);
    domainService = TestBed.inject(DomainService) as jasmine.SpyObj<DomainService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });

  describe('canActivate', () => {
    it('should allow navigation on public domain', () => {
      // Arrange
      domainService.isPublicDomain.and.returnValue(true);

      // Act
      const result = guard.canActivate();

      // Assert
      expect(result).toBe(true);
    });

    it('should allow navigation on tenant domain (public routes available everywhere)', () => {
      // Arrange
      domainService.isPublicDomain.and.returnValue(false);

      // Act
      const result = guard.canActivate();

      // Assert
      expect(result).toBe(true);
    });
  });
});
