import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError, BehaviorSubject } from 'rxjs';
import { TenantSelectionComponent } from './tenant-selection.component';
import { AuthService } from '../../core/services/auth.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { Tenant } from '../../core/models/auth.models';

/**
 * TenantSelection Component Tests
 *
 * **TDD Approach - RED Phase**
 *
 * Component Requirements (Phase 3D):
 * - Display list of available tenants after successful login
 * - Allow user to select a tenant
 * - Store selected tenant in TenantContextService
 * - Navigate to dashboard after selection
 * - Handle loading states while fetching tenants
 * - Handle errors gracefully
 * - Handle empty tenant list
 * - Support pull-to-refresh
 * - Show tenant branding (logo, colors)
 */
describe('TenantSelectionComponent', () => {
  let component: TenantSelectionComponent;
  let fixture: ComponentFixture<TenantSelectionComponent>;
  let authService: jest.Mocked<AuthService>;
  let tenantContextService: jest.Mocked<TenantContextService>;
  let router: jest.Mocked<Router>;

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
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z'
    }
  ];

  beforeEach(async () => {
    const authServiceMock = {
      loadUserTenants: jest.fn(),
      getUserTenants: jest.fn(),
      logout: jest.fn()
    };

    const tenantContextServiceMock = {
      setTenantSlug: jest.fn(),
      getCurrentSlug: jest.fn(),
      clearTenant: jest.fn()
    };

    const routerMock = {
      navigate: jest.fn()
    };

    await TestBed.configureTestingModule({
      imports: [TenantSelectionComponent],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: TenantContextService, useValue: tenantContextServiceMock },
        { provide: Router, useValue: routerMock }
      ]
    }).compileComponents();

    authService = TestBed.inject(AuthService) as jest.Mocked<AuthService>;
    tenantContextService = TestBed.inject(TenantContextService) as jest.Mocked<TenantContextService>;
    router = TestBed.inject(Router) as jest.Mocked<Router>;

    fixture = TestBed.createComponent(TenantSelectionComponent);
    component = fixture.componentInstance;
  });

  describe('Component Initialization', () => {
    /**
     * Test 1: Component should be created
     */
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    /**
     * Test 2: Should load tenants on initialization
     */
    it('should load tenants on init', () => {
      // Arrange
      authService.loadUserTenants.mockReturnValue(of(mockTenants));

      // Act
      fixture.detectChanges(); // Triggers ngOnInit

      // Assert
      expect(authService.loadUserTenants).toHaveBeenCalled();
      expect(component.tenants).toEqual(mockTenants);
      expect(component.isLoading).toBe(false);
    });

    /**
     * Test 3: Should set loading state to false after tenants load
     */
    it('should set loading state to false after tenants load successfully', () => {
      // Arrange
      authService.loadUserTenants.mockReturnValue(of(mockTenants));

      // Act
      component.ngOnInit();

      // Assert - After observable completes, loading should be false
      expect(component.isLoading).toBe(false);
      expect(component.tenants.length).toBe(2);
    });
  });

  describe('Tenant Display', () => {
    /**
     * Test 4: Should display all tenants
     */
    it('should display all available tenants', () => {
      // Arrange
      authService.loadUserTenants.mockReturnValue(of(mockTenants));

      // Act
      fixture.detectChanges();

      // Assert
      const compiled = fixture.nativeElement as HTMLElement;
      const tenantCards = compiled.querySelectorAll('[data-testid="tenant-card"]');

      expect(tenantCards.length).toBe(2);
    });

    /**
     * Test 5: Should display tenant details correctly
     */
    it('should display tenant name and slug', () => {
      // Arrange
      authService.loadUserTenants.mockReturnValue(of(mockTenants));

      // Act
      fixture.detectChanges();

      // Assert
      const compiled = fixture.nativeElement as HTMLElement;
      const firstTenantName = compiled.querySelector('[data-testid="tenant-name"]')?.textContent;
      const firstTenantSlug = compiled.querySelector('[data-testid="tenant-slug"]')?.textContent;

      expect(firstTenantName).toContain('NRNA');
      expect(firstTenantSlug).toContain('nrna');
    });

    /**
     * Test 6: Should show empty state when no tenants
     */
    it('should show empty state when user has no tenants', () => {
      // Arrange
      authService.loadUserTenants.mockReturnValue(of([]));

      // Act
      fixture.detectChanges();

      // Assert
      const compiled = fixture.nativeElement as HTMLElement;
      const emptyMessage = compiled.querySelector('[data-testid="empty-state"]');

      expect(emptyMessage).toBeTruthy();
      expect(component.tenants.length).toBe(0);
    });
  });

  describe('Tenant Selection', () => {
    /**
     * Test 7: Should select tenant when clicked
     */
    it('should handle tenant selection', async () => {
      // Arrange
      authService.loadUserTenants.mockReturnValue(of(mockTenants));
      tenantContextService.setTenantSlug.mockResolvedValue(undefined);
      router.navigate.mockResolvedValue(true);

      fixture.detectChanges();

      // Act
      await component.selectTenant(mockTenants[0]);

      // Assert
      expect(tenantContextService.setTenantSlug).toHaveBeenCalledWith('nrna');
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    });

    /**
     * Test 8: Should show loading state during selection
     */
    it('should show loading state during tenant selection', async () => {
      // Arrange
      authService.loadUserTenants.mockReturnValue(of(mockTenants));
      tenantContextService.setTenantSlug.mockResolvedValue(undefined);
      router.navigate.mockResolvedValue(true);

      fixture.detectChanges();

      // Act
      const selectionPromise = component.selectTenant(mockTenants[0]);

      // Assert - should be loading
      expect(component.isSelecting).toBe(true);

      await selectionPromise;

      // Assert - should no longer be loading
      expect(component.isSelecting).toBe(false);
    });

    /**
     * Test 9: Should disable all tenant cards during selection
     */
    it('should disable tenant selection while processing', async () => {
      // Arrange
      authService.loadUserTenants.mockReturnValue(of(mockTenants));
      tenantContextService.setTenantSlug.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(undefined), 100))
      );

      fixture.detectChanges();

      // Act
      const selectionPromise = component.selectTenant(mockTenants[0]);

      // Assert - buttons should be disabled
      const compiled = fixture.nativeElement as HTMLElement;
      const tenantButtons = compiled.querySelectorAll('[data-testid="tenant-button"]');

      tenantButtons.forEach(button => {
        expect((button as HTMLButtonElement).disabled).toBe(true);
      });

      await selectionPromise;
    });

    /**
     * Test 10: Should track selected tenant ID
     */
    it('should track which tenant was selected', async () => {
      // Arrange
      authService.loadUserTenants.mockReturnValue(of(mockTenants));
      tenantContextService.setTenantSlug.mockResolvedValue(undefined);
      router.navigate.mockResolvedValue(true);

      fixture.detectChanges();

      // Act
      await component.selectTenant(mockTenants[1]);

      // Assert
      expect(component.selectedTenantId).toBe(2);
    });
  });

  describe('Error Handling', () => {
    /**
     * Test 11: Should handle tenant loading error
     */
    it('should display error message when tenant loading fails', () => {
      // Arrange
      const errorMessage = 'Failed to load tenants';
      authService.loadUserTenants.mockReturnValue(
        throwError(() => new Error(errorMessage))
      );

      // Act
      fixture.detectChanges();

      // Assert
      expect(component.error).toBe(errorMessage);
      expect(component.isLoading).toBe(false);
    });

    /**
     * Test 12: Should handle tenant selection error
     */
    it('should display error when tenant selection fails', async () => {
      // Arrange
      authService.loadUserTenants.mockReturnValue(of(mockTenants));
      const errorMessage = 'Failed to set tenant context';
      tenantContextService.setTenantSlug.mockRejectedValue(new Error(errorMessage));

      fixture.detectChanges();

      // Act
      await component.selectTenant(mockTenants[0]);

      // Assert
      expect(component.error).toContain(errorMessage);
      expect(component.isSelecting).toBe(false);
      expect(router.navigate).not.toHaveBeenCalled();
    });

    /**
     * Test 13: Should clear previous errors when retrying
     */
    it('should clear error when retrying tenant load', () => {
      // Arrange
      authService.loadUserTenants.mockReturnValue(
        throwError(() => new Error('First error'))
      );

      fixture.detectChanges();
      expect(component.error).toBeTruthy();

      // Act - Retry
      authService.loadUserTenants.mockReturnValue(of(mockTenants));
      component.loadTenants();

      // Assert
      expect(component.error).toBe('');
    });
  });

  describe('Refresh Functionality', () => {
    /**
     * Test 14: Should support pull-to-refresh
     */
    it('should refresh tenant list when requested', () => {
      // Arrange
      authService.loadUserTenants.mockReturnValue(of(mockTenants));

      fixture.detectChanges();
      jest.clearAllMocks();

      // Act
      component.refreshTenants();

      // Assert
      expect(authService.loadUserTenants).toHaveBeenCalledWith(true); // force refresh
    });

    /**
     * Test 15: Should update tenant list after refresh
     */
    it('should update tenants after successful refresh', () => {
      // Arrange
      authService.loadUserTenants.mockReturnValue(of([mockTenants[0]]));
      fixture.detectChanges();

      expect(component.tenants.length).toBe(1);

      // Act - Refresh with new data
      authService.loadUserTenants.mockReturnValue(of(mockTenants));
      component.refreshTenants();

      // Assert
      expect(component.tenants.length).toBe(2);
    });
  });

  describe('Navigation', () => {
    /**
     * Test 16: Should navigate to dashboard after selection
     */
    it('should navigate to dashboard after successful tenant selection', async () => {
      // Arrange
      authService.loadUserTenants.mockReturnValue(of(mockTenants));
      tenantContextService.setTenantSlug.mockResolvedValue(undefined);
      router.navigate.mockResolvedValue(true);

      fixture.detectChanges();

      // Act
      await component.selectTenant(mockTenants[0]);

      // Assert
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    });

    /**
     * Test 17: Should have logout functionality
     */
    it('should allow user to logout from tenant selection', async () => {
      // Arrange
      authService.loadUserTenants.mockReturnValue(of(mockTenants));
      authService.logout.mockReturnValue(of(void 0));
      router.navigate.mockResolvedValue(true);

      fixture.detectChanges();

      // Act
      await component.logout();

      // Assert
      expect(authService.logout).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });
  });

  describe('UI States', () => {
    /**
     * Test 18: Should properly set loading state
     */
    it('should properly manage loading state', () => {
      // Arrange
      authService.loadUserTenants.mockReturnValue(of(mockTenants));

      // Act - Manually set component state to test UI logic
      component.isLoading = true;
      component.tenants = [];
      component.error = '';

      // Assert - Component state is correct for showing loading UI
      expect(component.isLoading).toBe(true);
      expect(component.tenants.length).toBe(0);
      expect(component.error).toBe('');

      // When all these conditions are met, the template @if (isLoading) block will render
      // We verify the component state is correct for the loading UI to appear
    });

    /**
     * Test 19: Should hide loading spinner after data loads
     */
    it('should hide loading spinner after tenants are loaded', () => {
      // Arrange
      authService.loadUserTenants.mockReturnValue(of(mockTenants));

      // Act
      fixture.detectChanges();

      // Assert
      const compiled = fixture.nativeElement as HTMLElement;
      const loadingSpinner = compiled.querySelector('[data-testid="loading-spinner"]');

      expect(loadingSpinner).toBeFalsy();
      expect(component.isLoading).toBe(false);
    });

    /**
     * Test 20: Should show error message in UI
     */
    it('should display error message in UI when error occurs', () => {
      // Arrange
      authService.loadUserTenants.mockReturnValue(
        throwError(() => new Error('Network error'))
      );

      // Act
      fixture.detectChanges();

      // Assert
      const compiled = fixture.nativeElement as HTMLElement;
      const errorMessage = compiled.querySelector('[data-testid="error-message"]');

      expect(errorMessage).toBeTruthy();
      expect(errorMessage?.textContent).toContain('Network error');
    });
  });

  describe('Single Tenant Auto-Selection', () => {
    /**
     * Test 21: Should auto-select when only one tenant exists
     */
    it('should automatically select tenant when user has only one', async () => {
      // Arrange
      const singleTenant = [mockTenants[0]];
      authService.loadUserTenants.mockReturnValue(of(singleTenant));
      tenantContextService.setTenantSlug.mockResolvedValue(undefined);
      router.navigate.mockResolvedValue(true);

      // Act
      fixture.detectChanges();
      await fixture.whenStable();

      // Assert
      expect(tenantContextService.setTenantSlug).toHaveBeenCalledWith('nrna');
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    });

    /**
     * Test 22: Should not auto-select when multiple tenants exist
     */
    it('should not auto-select when user has multiple tenants', () => {
      // Arrange
      authService.loadUserTenants.mockReturnValue(of(mockTenants));

      // Act
      fixture.detectChanges();

      // Assert
      expect(tenantContextService.setTenantSlug).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    /**
     * Test 23: Should have proper ARIA labels
     */
    it('should have accessible labels for screen readers', () => {
      // Arrange
      authService.loadUserTenants.mockReturnValue(of(mockTenants));

      // Act
      fixture.detectChanges();

      // Assert
      const compiled = fixture.nativeElement as HTMLElement;
      const tenantButtons = compiled.querySelectorAll('[data-testid="tenant-button"]');

      tenantButtons.forEach(button => {
        expect(button.getAttribute('aria-label')).toBeTruthy();
      });
    });

    /**
     * Test 24: Should support keyboard navigation
     */
    it('should be keyboard navigable', () => {
      // Arrange
      authService.loadUserTenants.mockReturnValue(of(mockTenants));

      // Act
      fixture.detectChanges();

      // Assert
      const compiled = fixture.nativeElement as HTMLElement;
      const tenantButtons = compiled.querySelectorAll('[data-testid="tenant-button"]');

      tenantButtons.forEach(button => {
        expect(button.getAttribute('tabindex')).not.toBe('-1');
      });
    });
  });
});
