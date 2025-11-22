/**
 * Organization Repository Interface
 *
 * Abstraction for organization data access.
 * Will be implemented in infrastructure layer.
 *
 * Uses abstract class instead of interface so it can be used
 * as dependency injection token in Angular.
 */

import { Observable } from 'rxjs';
import { Organization, OrganizationId } from './organization.model';

export abstract class OrganizationRepository {
  /**
   * Find all organizations
   */
  abstract findAll(): Observable<Organization[]>;

  /**
   * Find organization by ID
   */
  abstract findById(id: OrganizationId): Observable<Organization | null>;

  /**
   * Find organization by slug
   */
  abstract findBySlug(slug: string): Observable<Organization | null>;

  /**
   * Save organization (create or update)
   */
  abstract save(organization: Organization): Observable<void>;
}