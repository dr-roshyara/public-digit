import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="login-container">
      <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="login-form">
        <h2>Login to PublicDigit</h2>
        
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
      min-height: 50vh;
      padding: 1rem;
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
  `]
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  isLoading = false;
  error = '';

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.error = '';

      // The AuthService now uses the corrected API routes
      this.authService.login(this.loginForm.value as any).subscribe({
        next: (response) => {
          this.isLoading = false;
          console.log('Login successful:', response);
          this.router.navigate(['/dashboard']); // Make sure this route exists
        },
        error: (error) => {
          this.isLoading = false;
          this.error = error.message || 'Login failed. Please check your credentials.';
          console.error('Login error:', error);
        }
      });
    }
  }
}