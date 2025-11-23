import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LanguageSelectorComponent } from '../language-selector/language-selector.component';
import { TranslatePipe } from '@presentation/pipes/translate.pipe';

/**
 * Header Component
 * Mobile-optimized navigation with hamburger menu
 * Responsive design with touch-friendly interactions
 */
@Component({
  selector: 'pd-header',
  standalone: true,
  imports: [CommonModule, RouterModule, LanguageSelectorComponent, TranslatePipe],
  template: `
    <header class="mobile-header">
      <div class="container">
        <div class="header-content">
          <div class="logo">{{ 'common.app_name' | translate }}</div>

          <!-- Mobile menu button -->
          <button class="menu-toggle" (click)="toggleMenu()"
                  [attr.aria-expanded]="menuOpen" aria-label="Toggle menu">
            <span></span>
            <span></span>
            <span></span>
          </button>

          <!-- Navigation -->
          <nav class="nav" [class.nav-open]="menuOpen">
            <a class="nav-item" routerLink="/" (click)="closeMenu()">{{ 'navigation.home' | translate }}</a>
            <a class="nav-item" routerLink="/parties" (click)="closeMenu()">{{ 'navigation.parties' | translate }}</a>
            <a class="nav-item" routerLink="/ngos" (click)="closeMenu()">{{ 'navigation.ngos' | translate }}</a>
            <a class="nav-item" routerLink="/elections" (click)="closeMenu()">{{ 'navigation.elections' | translate }}</a>
            <a class="nav-item" routerLink="/transparency" (click)="closeMenu()">{{ 'navigation.transparency' | translate }}</a>

            <div class="nav-actions">
              <!-- Language Selector -->
              <pd-language-selector></pd-language-selector>

              <!-- Auth Buttons -->
              <button class="btn btn-outline" (click)="closeMenu()">{{ 'common.buttons.login' | translate }}</button>
              <button class="btn btn-primary" (click)="closeMenu()">{{ 'common.buttons.join' | translate }}</button>
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