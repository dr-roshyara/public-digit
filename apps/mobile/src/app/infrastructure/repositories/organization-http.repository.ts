/**
 * Organization HTTP Repository
 *
 * Infrastructure implementation of OrganizationRepository interface.
 * Handles HTTP communication with backend API.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, throwError } from 'rxjs';
import { Organization, OrganizationId } from '@domain/organization/organization.model';
import { OrganizationRepository } from '@domain/organization/organization.repository';

/**
 * Organization Data Transfer Object
 *
 * API response structure for organization data
 */
export interface OrganizationDto {
  id: number;
  slug: string;
  name: string;
  type: string;
  status: string;
  member_count?: number;
  logo_url?: string;
  description?: string;
  created_at?: string;
}

/**
 * Organization HTTP Repository
 *
 * Implements the repository interface using HTTP client.
 * Handles mapping between DTOs and domain models.
 */
@Injectable({
  providedIn: 'root'
})
export class OrganizationHttpRepository implements OrganizationRepository {
  private http = inject(HttpClient);

  /**
   * Find all organizations
   */
  findAll(): Observable<Organization[]> {
    return this.http.get<{ success: boolean; data: OrganizationDto[] }>('/api/v1/tenants').pipe(
      map(response => {
        if (!response.success || !response.data) {
          throw new Error('Failed to load organizations');
        }
        return response.data.map(dto => OrganizationMapper.toDomain(dto));
      }),
      catchError(error => {
        console.error('❌ Failed to load organizations:', error);
        return throwError(() => new Error('Failed to load organizations'));
      })
    );
  }

  /**
   * Find organization by ID
   */
  findById(id: OrganizationId): Observable<Organization | null> {
    return this.http.get<{ success: boolean; data: OrganizationDto }>(`/api/v1/tenants/${id.toNumber()}`).pipe(
      map(response => {
        if (!response.success || !response.data) {
          return null;
        }
        return OrganizationMapper.toDomain(response.data);
      }),
      catchError(error => {
        console.error('❌ Failed to load organization by ID:', error);
        return throwError(() => new Error('Failed to load organization'));
      })
    );
  }

  /**
   * Find organization by slug
   */
  findBySlug(slug: string): Observable<Organization | null> {
    return this.http.get<{ success: boolean; data: OrganizationDto }>(`/api/v1/tenants/slug/${slug}`).pipe(
      map(response => {
        if (!response.success || !response.data) {
          return null;
        }
        return OrganizationMapper.toDomain(response.data);
      }),
      catchError(error => {
        console.error('❌ Failed to load organization by slug:', error);
        return throwError(() => new Error('Failed to load organization'));
      })
    );
  }

  /**
   * Save organization
   */
  save(organization: Organization): Observable<void> {
    const dto = OrganizationMapper.toDto(organization);

    if (organization.id.toNumber() === 0) {
      // Create new organization
      return this.http.post<{ success: boolean; data: OrganizationDto }>('/api/v1/tenants', dto).pipe(
        map(response => {
          if (!response.success) {
            throw new Error('Failed to create organization');
          }
        }),
        catchError(error => {
          console.error('❌ Failed to create organization:', error);
          return throwError(() => new Error('Failed to create organization'));
        })
      );
    } else {
      // Update existing organization
      return this.http.put<{ success: boolean }>(`/api/v1/tenants/${organization.id.toNumber()}`, dto).pipe(
        map(response => {
          if (!response.success) {
            throw new Error('Failed to update organization');
          }
        }),
        catchError(error => {
          console.error('❌ Failed to update organization:', error);
          return throwError(() => new Error('Failed to update organization'));
        })
      );
    }
  }
}

/**
 * Organization Mapper
 *
 * Handles mapping between domain models and DTOs
 */
export class OrganizationMapper {
  /**
   * Convert DTO to domain model
   */
  static toDomain(dto: OrganizationDto): Organization {
    try {
      // Use existing data to create domain model
      return Organization.fromExisting({
        id: dto.id,
        slug: dto.slug,
        name: dto.name,
        status: dto.status,
        logo_url: dto.logo_url,
        description: dto.description
      });
    } catch (error) {
      console.error('❌ Failed to map DTO to domain:', error);
      throw error;
    }
  }

  /**
   * Convert domain model to DTO
   */
  static toDto(organization: Organization): OrganizationDto {
    return {
      id: organization.id.toNumber(),
      slug: organization.id.toString(),
      name: organization.name,
      type: organization.type.toString(),
      status: organization.status,
      member_count: organization.getStatistics().memberCount,
      logo_url: organization.logoUrl,
      description: organization.description,
      created_at: new Date().toISOString() // This would come from domain in real implementation
    };
  }
}