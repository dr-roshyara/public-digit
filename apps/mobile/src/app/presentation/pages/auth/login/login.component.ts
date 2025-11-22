import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { TenantContextService } from '@core/services/tenant-context.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="login-container">
      <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="login-form">
        <h2>Login to PublicDigit</h2>

        <!-- Tenant Slug Input (shown only on mobile without subdomain) -->
        @if (showTenantInput) {
          <div class="form-group">
            <label for="tenantSlug">Organization ID</label>
            <input
              type="text"
              id="tenantSlug"
              formControlName="tenantSlug"
              placeholder="Enter your organization ID (e.g., nrna)"
              class="form-input"
            />
            @if (loginForm.get('tenantSlug')?.invalid && loginForm.get('tenantSlug')?.touched) {
              <div class="error">Organization ID is required</div>
            }
            <small class="helper-text">This is provided by your organization admin</small>
          </div>
        }

        <!-- Show current tenant if detected -->
        @if (!showTenantInput && currentTenant) {
          <div class="tenant-info">
            <svg class="info-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>Logging into: <strong>{{ currentTenant }}</strong></p>
          </div>
        }

        <div class="form-group">
          <label for="email">Email</label>
          <input
            type="email"
            id="email"
            formControlName="email"
            placeholder="Enter your email"
            class="form-input"
          />
          @if (loginForm.get('email')?.invalid && loginForm.get('email')?.touched) {
            <div class="error">Valid email is required</div>
          }
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input
            type="password"
            id="password"
            formControlName="password"
            placeholder="Enter your password"
            class="form-input"
          />
          @if (loginForm.get('password')?.invalid && loginForm.get('password')?.touched) {
            <div class="error">Password is required</div>
          }
        </div>

        <button
          type="submit"
          class="login-btn"
          [disabled]="loginForm.invalid || isLoading"
        >
          {{ isLoading ? 'Logging in...' : 'Login' }}
        </button>

        @if (error) {
          <div class="error-message">{{ error }}</div>
        }
      </form>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 1rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .login-form {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      padding: 2rem;
      border-radius: 1rem;
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: white;
      width: 100%;
      max-width: 400px;
    }
    .login-form h2 {
      text-align: center;
      margin-bottom: 2rem;
      color: white;
    }
    .form-group {
      margin-bottom: 1.5rem;
    }
    label {
      display: block;
      margin-bottom: 0.5rem;
      color: rgba(255, 255, 255, 0.9);
    }
    .form-input {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 0.5rem;
      background: rgba(255, 255, 255, 0.1);
      color: white;
      font-size: 1rem;
    }
    .form-input::placeholder {
      color: rgba(255, 255, 255, 0.6);
    }
    .form-input:focus {
      outline: none;
      border-color: rgba(255, 255, 255, 0.5);
    }
    .error {
      color: #ff6b6b;
      font-size: 0.875rem;
      margin-top: 0.25rem;
    }
    .login-btn {
      width: 100%;
      padding: 0.75rem;
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 0.5rem;
      color: white;
      font-size: 1rem;
      cursor: pointer;
      transition: background 0.3s ease;
    }
    .login-btn:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.3);
    }
    .login-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .error-message {
      background: rgba(255, 107, 107, 0.2);
      border: 1px solid rgba(255, 107, 107, 0.5);
      color: #ff6b6b;
      padding: 0.75rem;
      border-radius: 0.5rem;
      margin-top: 1rem;
      text-align: center;
    }
    .tenant-info {
      background: rgba(102, 126, 234, 0.2);
      border: 1px solid rgba(102, 126, 234, 0.5);
      padding: 1rem;
      border-radius: 0.5rem;
      margin-bottom: 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .tenant-info p {
      margin: 0;
      color: white;
      font-size: 0.95rem;
    }
    .tenant-info strong {
      color: rgba(255, 255, 255, 0.95);
      font-weight: 600;
    }
    .info-icon {
      width: 24px;
      height: 24px;
      color: rgba(102, 126, 234, 1);
      flex-shrink: 0;
    }
    .helper-text {
      display: block;
      margin-top: 0.5rem;
      font-size: 0.85rem;
      color: rgba(255, 255, 255, 0.7);
      font-style: italic;
    }
  `]
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private tenantContext = inject(TenantContextService);
  private router = inject(Router);

  loginForm!: FormGroup;
  isLoading = false;
  error = '';
  showTenantInput = true;
  currentTenant = '';

  ngOnInit(): void {
    this.createForm();
    this.detectTenantContext();
  }

  private createForm(): void {
    this.loginForm = this.fb.group({
      tenantSlug: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }

  private detectTenantContext(): void {
    const currentSlug = this.tenantContext.getCurrentSlug();

    if (currentSlug) {
      // Tenant context detected via subdomain or storage
      this.showTenantInput = false;
      this.currentTenant = currentSlug;
      this.loginForm.get('tenantSlug')?.setValue(currentSlug);
      this.loginForm.get('tenantSlug')?.clearValidators();
      this.loginForm.get('tenantSlug')?.updateValueAndValidity();
      console.log(`🏢 Tenant context detected: ${currentSlug}`);
    } else {
      console.log('📱 No tenant context, showing tenant input field');
    }
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.error = '';

      const formValue = this.loginForm.getRawValue();

      // Call AuthService with tenant slug
      this.authService.login(
        {
          email: formValue.email,
          password: formValue.password
        },
        formValue.tenantSlug
      ).subscribe({
        next: (response) => {
          this.isLoading = false;
          console.log('✅ Login successful:', response);
          // AuthService handles navigation
        },
        error: (error) => {
          this.isLoading = false;
          this.error = error.error?.message || error.message || 'Login failed. Please check your credentials.';
          console.error('❌ Login error:', error);
        }
      });
    }
  }
}