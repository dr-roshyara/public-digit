import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

/**
 * Header Component
 * Mobile-optimized navigation with hamburger menu
 * Responsive design with touch-friendly interactions
 */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <header class="mobile-header">
      <div class="container">
        <div class="header-content">
          <div class="logo">Public Digit</div>

          <!-- Mobile menu button -->
          <button class="menu-toggle" (click)="toggleMenu()"
                  [attr.aria-expanded]="menuOpen" aria-label="Toggle menu">
            <span></span>
            <span></span>
            <span></span>
          </button>

          <!-- Navigation -->
          <nav class="nav" [class.nav-open]="menuOpen">
            <a class="nav-item" routerLink="/" (click)="closeMenu()">Home</a>
            <a class="nav-item" routerLink="/parties" (click)="closeMenu()">Parties</a>
            <a class="nav-item" routerLink="/ngos" (click)="closeMenu()">NGOs</a>
            <a class="nav-item" routerLink="/elections" (click)="closeMenu()">Elections</a>
            <a class="nav-item" routerLink="/transparency" (click)="closeMenu()">Transparency</a>

            <div class="nav-actions">
              <button class="btn btn-outline" (click)="closeMenu()">Login</button>
              <button class="btn btn-primary" (click)="closeMenu()">Join</button>
            </div>
          </nav>
        </div>
      </div>
    </header>
  `,
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
  menuOpen = false;

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
    document.body.style.overflow = this.menuOpen ? 'hidden' : '';
  }

  closeMenu(): void {
    this.menuOpen = false;
    document.body.style.overflow = '';
  }
}