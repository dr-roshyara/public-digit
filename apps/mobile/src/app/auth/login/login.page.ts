import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { LoginRequest } from '@public-digit/shared-types';

@Component({
  selector: 'pd-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <form (ngSubmit)="onSubmit()">
      <div *ngIf="error" class="error">{{ error }}</div>
      <label>
        Email
        <input type="email" name="email" [(ngModel)]="credentials.email" required />
      </label>
      <label>
        Password
        <input type="password" name="password" [(ngModel)]="credentials.password" required />
      </label>
      <button type="submit" [disabled]="loading">Login</button>
    </form>
  `
})
export class LoginPage {
  private authService = inject(AuthService);
  private router = inject(Router);

  credentials: LoginRequest = {
    email: '',
    password: '',
    device_name: 'mobile-app'
  };
  
  loading = false;
  error = '';

  onSubmit() {
    this.loading = true;
    this.error = '';

    this.authService.login(this.credentials).subscribe({
      next: (response) => {
        this.loading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (error) => {
        this.loading = false;
        this.error = error.message || 'Login failed. Please try again.';
      }
    });
  }
}