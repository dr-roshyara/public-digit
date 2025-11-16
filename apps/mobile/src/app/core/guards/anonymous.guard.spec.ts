import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AnonymousGuard } from './anonymous.guard';
import { AuthService } from '../services/auth.service';

/**
 * AnonymousGuard Test Suite (TDD)
 *
 * Tests anonymous-only route protection (login, register pages)
 * Following TDD approach: Write tests FIRST, then implement
 *
 * Guard Purpose:
 * - Allow unauthenticated users to access login/register
 * - Redirect authenticated users to dashboard
 */
describe('AnonymousGuard', () => {
  let guard: AnonymousGuard;
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    const authServiceSpy = jasmine.createSpyObj('AuthService', [
      'isAuthenticated'
    ]);

    const routerSpy = jasmine.createSpyObj('Router', ['navigate', 'createUrlTree']);

    TestBed.configureTestingModule({
      providers: [
        AnonymousGuard,
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy }
      ]
    });

    guard = TestBed.inject(AnonymousGuard);
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });

  describe('canActivate', () => {
    it('should allow navigation when user is not authenticated', () => {
      // Arrange
      authService.isAuthenticated.and.returnValue(false);

      // Act
      const result = guard.canActivate();

      // Assert
      expect(result).toBe(true);
      expect(authService.isAuthenticated).toHaveBeenCalled();
    });

    it('should redirect to dashboard when user is authenticated', () => {
      // Arrange
      authService.isAuthenticated.and.returnValue(true);
      const urlTree = router.createUrlTree(['/dashboard']);
      router.createUrlTree.and.returnValue(urlTree as any);

      // Act
      const result = guard.canActivate();

      // Assert
      expect(result).toBe(urlTree);
      expect(router.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
    });

    it('should prevent authenticated users from accessing login page', () => {
      // Arrange
      authService.isAuthenticated.and.returnValue(true);
      const urlTree = router.createUrlTree(['/dashboard']);
      router.createUrlTree.and.returnValue(urlTree as any);

      // Act
      const result = guard.canActivate();

      // Assert
      expect(result).not.toBe(true);
      expect(result).toBe(urlTree);
    });
  });
});
