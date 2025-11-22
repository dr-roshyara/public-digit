import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { TenantContextService } from '@core/services/tenant-context.service';
import { Tenant } from '@core/models/auth.models';

/**
 * TenantSelection Component
 *
 * Displays available tenants and allows user to select which organization
 * they want to access. Supports:
 * - Multi-tenant selection
 * - Auto-selection for single tenant
 * - Pull-to-refresh
 * - Error handling
 * - Loading states
 */
@Component({
  selector: 'app-tenant-selection',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tenant-selection-container">
      <div class="header">
        <h1>Select Organization</h1>
        <p class="subtitle">Choose which organization you want to access</p>
        <button
          type="button"
          class="logout-btn"
          (click)="logout()"
          [disabled]="isSelecting"
          aria-label="Logout"
        >
          Logout
        </button>
      </div>

      <!-- Loading State -->
      @if (isLoading) {
        <div class="loading-container" data-testid="loading-spinner">
          <div class="spinner"></div>
          <p>Loading your organizations...</p>
        </div>
      }

      <!-- Error State -->
      @if (error && !isLoading) {
        <div class="error-container" data-testid="error-message">
          <svg class="error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="error-text">{{ error }}</p>
          <button
            type="button"
            class="retry-btn"
            (click)="loadTenants()"
          >
            Try Again
          </button>
        </div>
      }

      <!-- Empty State -->
      @if (!isLoading && !error && tenants.length === 0) {
        <div class="empty-container" data-testid="empty-state">
          <svg class="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h2>No Organizations Found</h2>
          <p>You don't have access to any organizations yet.</p>
          <p class="contact-admin">Please contact your administrator for access.</p>
        </div>
      }

      <!-- Tenant List -->
      @if (!isLoading && !error && tenants.length > 0) {
        <div class="tenant-grid">
          @for (tenant of tenants; track tenant.id) {
            <button
              type="button"
              class="tenant-card"
              [class.selecting]="isSelecting && selectedTenantId === tenant.id"
              [disabled]="isSelecting"
              (click)="selectTenant(tenant)"
              [attr.data-testid]="'tenant-card'"
              [attr.data-tenant-id]="tenant.id"
              [attr.aria-label]="'Select ' + tenant.name + ' organization'"
              data-testid="tenant-button"
            >
              <!-- Tenant Icon/Logo Placeholder -->
              <div class="tenant-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>

              <!-- Tenant Details -->
              <div class="tenant-details">
                <h3 class="tenant-name" data-testid="tenant-name">{{ tenant.name }}</h3>
                <p class="tenant-slug" data-testid="tenant-slug">{{ tenant.slug }}</p>
                @if (tenant.domain) {
                  <p class="tenant-domain">{{ tenant.domain }}</p>
                }
              </div>

              <!-- Selection Indicator -->
              @if (isSelecting && selectedTenantId === tenant.id) {
                <div class="selecting-indicator">
                  <div class="mini-spinner"></div>
                </div>
              } @else {
                <div class="arrow-icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              }
            </button>
          }
        </div>
      }

      <!-- Refresh Button -->
      @if (!isLoading && tenants.length > 0) {
        <button
          type="button"
          class="refresh-btn"
          (click)="refreshTenants()"
          [disabled]="isSelecting"
          aria-label="Refresh tenant list"
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      }
    </div>
  `,
  styles: [`
    .tenant-selection-container {
      min-height: 100vh;
      padding: 2rem 1rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .header {
      text-align: center;
      margin-bottom: 2rem;
      position: relative;
    }

    .header h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
      color: white;
    }

    .subtitle {
      color: rgba(255, 255, 255, 0.8);
      margin-bottom: 1rem;
    }

    .logout-btn {
      position: absolute;
      top: 0;
      right: 0;
      padding: 0.5rem 1rem;
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 0.5rem;
      color: white;
      cursor: pointer;
      font-size: 0.9rem;
      transition: background 0.3s ease;
    }

    .logout-btn:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.3);
    }

    .logout-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Loading State */
    .loading-container {
      text-align: center;
      padding: 3rem 1rem;
    }

    .spinner {
      width: 60px;
      height: 60px;
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .loading-container p {
      color: rgba(255, 255, 255, 0.9);
      font-size: 1.1rem;
    }

    /* Error State */
    .error-container {
      background: rgba(255, 107, 107, 0.2);
      border: 1px solid rgba(255, 107, 107, 0.5);
      border-radius: 1rem;
      padding: 2rem;
      text-align: center;
      max-width: 500px;
      margin: 2rem auto;
    }

    .error-icon {
      width: 64px;
      height: 64px;
      color: #ff6b6b;
      margin: 0 auto 1rem;
    }

    .error-text {
      color: #ff6b6b;
      font-size: 1.1rem;
      margin-bottom: 1.5rem;
    }

    .retry-btn {
      padding: 0.75rem 2rem;
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 0.5rem;
      color: white;
      cursor: pointer;
      font-size: 1rem;
      transition: background 0.3s ease;
    }

    .retry-btn:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    /* Empty State */
    .empty-container {
      text-align: center;
      padding: 3rem 1rem;
      max-width: 500px;
      margin: 0 auto;
    }

    .empty-icon {
      width: 80px;
      height: 80px;
      color: rgba(255, 255, 255, 0.6);
      margin: 0 auto 1.5rem;
    }

    .empty-container h2 {
      font-size: 1.5rem;
      margin-bottom: 1rem;
      color: white;
    }

    .empty-container p {
      color: rgba(255, 255, 255, 0.8);
      font-size: 1.1rem;
      margin-bottom: 0.5rem;
    }

    .contact-admin {
      font-style: italic;
      color: rgba(255, 255, 255, 0.7);
      font-size: 0.95rem;
    }

    /* Tenant Grid */
    .tenant-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.5rem;
      max-width: 1200px;
      margin: 0 auto 2rem;
    }

    .tenant-card {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 1rem;
      padding: 1.5rem;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 1rem;
      text-align: left;
      color: white;
    }

    .tenant-card:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.2);
      transform: translateY(-2px);
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
    }

    .tenant-card:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .tenant-card.selecting {
      background: rgba(102, 126, 234, 0.3);
      border-color: rgba(102, 126, 234, 0.5);
    }

    .tenant-icon {
      width: 48px;
      height: 48px;
      flex-shrink: 0;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .tenant-icon svg {
      width: 32px;
      height: 32px;
      color: white;
    }

    .tenant-details {
      flex: 1;
    }

    .tenant-name {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 0.25rem;
      color: white;
    }

    .tenant-slug {
      font-size: 0.9rem;
      color: rgba(255, 255, 255, 0.7);
      font-family: monospace;
      margin-bottom: 0.25rem;
    }

    .tenant-domain {
      font-size: 0.85rem;
      color: rgba(255, 255, 255, 0.6);
    }

    .arrow-icon {
      width: 24px;
      height: 24px;
      flex-shrink: 0;
      color: rgba(255, 255, 255, 0.6);
    }

    .selecting-indicator {
      width: 24px;
      height: 24px;
      flex-shrink: 0;
    }

    .mini-spinner {
      width: 24px;
      height: 24px;
      border: 3px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    /* Refresh Button */
    .refresh-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0 auto;
      padding: 0.75rem 1.5rem;
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 0.5rem;
      color: white;
      cursor: pointer;
      font-size: 1rem;
      transition: background 0.3s ease;
    }

    .refresh-btn:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.3);
    }

    .refresh-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .refresh-btn svg {
      width: 20px;
      height: 20px;
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      .tenant-grid {
        grid-template-columns: 1fr;
      }

      .header h1 {
        font-size: 1.5rem;
      }

      .logout-btn {
        position: static;
        display: block;
        margin: 1rem auto 0;
      }
    }
  `]
})
export class TenantSelectionComponent implements OnInit {
  private authService = inject(AuthService);
  private tenantContext = inject(TenantContextService);
  private router = inject(Router);

  tenants: Tenant[] = [];
  isLoading = false;
  isSelecting = false;
  error = '';
  selectedTenantId: number | null = null;

  ngOnInit(): void {
    this.loadTenants();
  }

  /**
   * Load user's available tenants
   */
  loadTenants(): void {
    this.isLoading = true;
    this.error = '';

    this.authService.loadUserTenants().subscribe({
      next: (tenants) => {
        this.tenants = tenants;
        this.isLoading = false;

        // Auto-select if only one tenant
        if (tenants.length === 1) {
          this.selectTenant(tenants[0]);
        }
      },
      error: (error) => {
        this.error = error.message || 'Failed to load organizations';
        this.isLoading = false;
        console.error('❌ Failed to load tenants:', error);
      }
    });
  }

  /**
   * Refresh tenant list (force refresh from API)
   */
  refreshTenants(): void {
    this.isLoading = true;
    this.error = '';

    this.authService.loadUserTenants(true).subscribe({
      next: (tenants) => {
        this.tenants = tenants;
        this.isLoading = false;
        console.log('✅ Tenants refreshed');
      },
      error: (error) => {
        this.error = error.message || 'Failed to refresh organizations';
        this.isLoading = false;
        console.error('❌ Failed to refresh tenants:', error);
      }
    });
  }

  /**
   * Select a tenant and navigate to dashboard
   */
  async selectTenant(tenant: Tenant): Promise<void> {
    this.isSelecting = true;
    this.selectedTenantId = tenant.id;
    this.error = '';

    try {
      // Set tenant context
      await this.tenantContext.setTenantSlug(tenant.slug);

      console.log(`✅ Tenant selected: ${tenant.name} (${tenant.slug})`);

      // Navigate to dashboard
      await this.router.navigate(['/dashboard']);

      this.isSelecting = false;
    } catch (error: any) {
      this.error = error.message || 'Failed to select organization';
      this.isSelecting = false;
      this.selectedTenantId = null;
      console.error('❌ Failed to select tenant:', error);
    }
  }

  /**
   * Logout and return to login page
   */
  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.authService.logout());
      await this.router.navigate(['/login']);
    } catch (error) {
      console.error('❌ Logout error:', error);
      // Navigate to login anyway
      await this.router.navigate(['/login']);
    }
  }
}
