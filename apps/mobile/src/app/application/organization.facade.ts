/**
 * Organization Facade
 *
 * Application service that orchestrates organization use cases and bridges
 * between the new DDD domain model and existing services.
 *
 * Follows the Strangler Pattern: Gradually migrate from existing services
 * to new domain model while maintaining backward compatibility.
 */

import { Injectable, inject } from '@angular/core';
import { Observable, map, switchMap, catchError, of, throwError, from } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { TenantContextService, Tenant } from '../core/services/tenant-context.service';
import { Organization, OrganizationId, OrganizationType } from '@domain/organization/organization.model';
import { OrganizationRepository } from '@domain/organization/organization.repository';

/**
 * Organization Facade
 *
 * Provides a unified interface for organization operations:
 * - Bridge between new domain model and existing services
 * - Fallback mechanisms during migration
 * - Business logic orchestration
 * - Error handling and validation
 */
@Injectable({
  providedIn: 'root'
})
export class OrganizationFacade {
  private authService = inject(AuthService);
  private tenantContext = inject(TenantContextService);
  private organizationRepository = inject(OrganizationRepository);

  /**
   * Get all organizations the user has access to
   *
   * Uses existing AuthService during migration, with fallback to new domain model
   */
  getOrganizations(): Observable<Organization[]> {
    return this.authService.loadUserTenants().pipe(
      map(tenants => tenants.map(tenant => this.convertToDomain(tenant))),
      catchError(error => {
        console.warn('⚠️ Failed to load organizations from existing service, falling back to repository:', error);
        return this.organizationRepository.findAll();
      })
    );
  }

  /**
   * Get current organization context
   *
   * Uses existing TenantContextService with fallback to repository
   */
  getCurrentOrganization(): Observable<Organization | null> {
    const currentTenant = this.tenantContext.getCurrentTenant();

    if (currentTenant) {
      return of(this.convertToDomain(currentTenant));
    }

    const currentSlug = this.tenantContext.getCurrentSlug();
    if (currentSlug) {
      return this.organizationRepository.findBySlug(currentSlug).pipe(
        catchError(error => {
          console.warn('⚠️ Failed to load organization from repository:', error);
          return of(null);
        })
      );
    }

    return of(null);
  }

  /**
   * Set current organization context
   *
   * Uses existing TenantContextService with domain validation
   */
  setCurrentOrganization(organization: Organization): Observable<void> {
    return from(this.tenantContext.setTenantSlug(organization.id.toString())).pipe(
      catchError(error => {
        console.error('❌ Failed to set organization context:', error);
        return throwError(() => new Error('Failed to set organization context'));
      })
    );
  }

  /**
   * Create a new organization
   *
   * Uses new domain model for business validation and creation
   */
  createOrganization(name: string, type: string, description?: string): Observable<Organization> {
    try {
      // Use domain model for business validation
      const organization = Organization.create(name, type, description);

      return this.organizationRepository.save(organization).pipe(
        map(() => organization),
        catchError(error => {
          console.error('❌ Failed to save organization:', error);
          return throwError(() => new Error('Failed to create organization'));
        })
      );
    } catch (domainError) {
      // Domain validation failed
      console.error('❌ Domain validation failed:', domainError);
      return throwError(() => domainError);
    }
  }

  /**
   * Update organization information
   *
   * Uses domain model for business logic
   */
  updateOrganization(organization: Organization, name: string, description?: string): Observable<void> {
    try {
      // Use domain model for business logic
      organization.updateInfo(name, description);

      return this.organizationRepository.save(organization).pipe(
        catchError(error => {
          console.error('❌ Failed to update organization:', error);
          return throwError(() => new Error('Failed to update organization'));
        })
      );
    } catch (domainError) {
      // Domain validation failed
      console.error('❌ Domain validation failed:', domainError);
      return throwError(() => domainError);
    }
  }

  /**
   * Add member to organization
   *
   * Uses domain model for business logic
   */
  addMember(organization: Organization): Observable<void> {
    try {
      // Use domain model for business logic
      organization.addMember();

      return this.organizationRepository.save(organization).pipe(
        catchError(error => {
          console.error('❌ Failed to add member to organization:', error);
          return throwError(() => new Error('Failed to add member'));
        })
      );
    } catch (domainError) {
      // Domain validation failed
      console.error('❌ Domain validation failed:', domainError);
      return throwError(() => domainError);
    }
  }

  /**
   * Remove member from organization
   *
   * Uses domain model for business logic
   */
  removeMember(organization: Organization): Observable<void> {
    try {
      // Use domain model for business logic
      organization.removeMember();

      return this.organizationRepository.save(organization).pipe(
        catchError(error => {
          console.error('❌ Failed to remove member from organization:', error);
          return throwError(() => new Error('Failed to remove member'));
        })
      );
    } catch (domainError) {
      // Domain validation failed
      console.error('❌ Domain validation failed:', domainError);
      return throwError(() => domainError);
    }
  }

  /**
   * Get organization statistics
   *
   * Uses domain model for business logic
   */
  getOrganizationStatistics(organization: Organization) {
    return organization.getStatistics();
  }

  /**
   * Check if organization can accept new members
   *
   * Uses domain model for business logic
   */
  canAcceptMembers(organization: Organization): boolean {
    return organization.canAcceptMembers();
  }

  /**
   * Convert existing Tenant to Organization domain model
   *
   * Bridge method for migration from existing data structure
   */
  private convertToDomain(tenant: Tenant): Organization {
    try {
      return Organization.fromExisting({
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        status: tenant.status,
        logo_url: tenant.logo_url,
        description: tenant.description
      });
    } catch (error) {
      console.error('❌ Failed to convert tenant to organization domain:', error);
      throw error;
    }
  }

  /**
   * Convert Organization domain model to Tenant interface
   *
   * Bridge method for backward compatibility
   */
  private convertToTenant(organization: Organization): Tenant {
    return {
      id: organization.id.toNumber(),
      slug: organization.id.toString(),
      name: organization.name,
      status: organization.status,
      logo_url: organization.logoUrl,
      description: organization.description
    };
  }

  /**
   * Get organizations as Observable stream
   *
   * Reactive version that emits when organizations change
   */
  get organizations$(): Observable<Organization[]> {
    return this.authService.userTenants$.pipe(
      map(tenants => tenants.map(tenant => this.convertToDomain(tenant)))
    );
  }

  /**
   * Get current organization as Observable stream
   *
   * Reactive version that emits when current organization changes
   */
  get currentOrganization$(): Observable<Organization | null> {
    return this.tenantContext.tenant$.pipe(
      map(tenant => tenant ? this.convertToDomain(tenant) : null)
    );
  }
}