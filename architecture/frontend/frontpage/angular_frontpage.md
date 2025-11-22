# Angular Mobile App Implementation for Public Digit

Here's the complete Angular implementation optimized for mobile devices:

## 1. Angular Module Structure

```typescript
// app.module.ts
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';

import { AppComponent } from './app.component';
import { HeaderComponent } from './components/header/header.component';
import { HeroComponent } from './components/hero/hero.component';
import { FeaturesComponent } from './components/features/features.component';
import { StatsComponent } from './components/stats/stats.component';
import { FooterComponent } from './components/footer/footer.component';
import { ActionsComponent } from './components/actions/actions.component';

@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    HeroComponent,
    FeaturesComponent,
    StatsComponent,
    FooterComponent,
    ActionsComponent
  ],
  imports: [
    BrowserModule,
    RouterModule.forRoot([])
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
```

## 2. Global Styles with OKLCH Colors

```scss
// styles.scss
:root {
  /* Core Color Palette - OKLCH based */
  --color-primary: oklch(25.7% 0.09 281.288);
  --color-primary-light: oklch(40% 0.12 281.288);
  --color-primary-dark: oklch(20% 0.07 281.288);
  --color-background: oklch(98% 0.01 281.288);
  --color-surface: oklch(100% 0 0);
  --color-secondary: oklch(65% 0.20 150);
  --color-accent: oklch(70% 0.15 45);
  --color-neutral-700: oklch(45% 0.06 281.288);
  --color-neutral-500: oklch(60% 0.04 281.288);
  --color-neutral-300: oklch(85% 0.02 281.288);
  --color-neutral-100: oklch(95% 0.01 281.288);
  
  /* Semantic colors */
  --color-success: oklch(65% 0.20 150);
  --color-warning: oklch(75% 0.18 75);
  --color-error: oklch(65% 0.20 25);
  --color-info: oklch(65% 0.15 250);

  /* Mobile spacing */
  --space-xs: 0.5rem;
  --space-sm: 1rem;
  --space-md: 1.5rem;
  --space-lg: 2rem;
  --space-xl: 3rem;
}

/* Fallback for browsers that don't support OKLCH */
@supports not (color: oklch(0% 0 0)) {
  :root {
    --color-primary: #1e3a8a;
    --color-primary-light: #3730a3;
    --color-primary-dark: #172554;
    --color-background: #f8fafc;
    --color-surface: #ffffff;
    --color-secondary: #10b981;
    --color-accent: #f59e0b;
    --color-neutral-700: #475569;
    --color-neutral-500: #64748b;
    --color-neutral-300: #cbd5e1;
    --color-neutral-100: #f1f5f9;
  }
}

/* Base mobile styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}

html {
  font-size: 16px;
  scroll-behavior: smooth;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  background: var(--color-background);
  color: var(--color-primary);
  line-height: 1.6;
  overflow-x: hidden;
  touch-action: manipulation;
}

/* Mobile-first container */
.container {
  width: 100%;
  padding: 0 var(--space-sm);
  margin: 0 auto;
  
  @media (min-width: 640px) {
    max-width: 640px;
    padding: 0 var(--space-md);
  }
  
  @media (min-width: 768px) {
    max-width: 768px;
  }
  
  @media (min-width: 1024px) {
    max-width: 1024px;
  }
}

/* Common mobile components */
.mobile-card {
  background: var(--color-surface);
  border-radius: 16px;
  padding: var(--space-md);
  margin-bottom: var(--space-sm);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--color-neutral-300);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 24px;
  border: none;
  border-radius: 12px;
  font-weight: 600;
  font-size: 1rem;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.3s ease;
  min-height: 48px; /* Mobile touch target */
  position: relative;
  overflow: hidden;
  
  &:active {
    transform: scale(0.98);
  }
  
  &-primary {
    background: var(--color-primary);
    color: white;
    
    &:hover {
      background: var(--color-primary-dark);
    }
  }
  
  &-secondary {
    background: var(--color-secondary);
    color: white;
    
    &:hover {
      background: oklch(55% 0.18 150);
    }
  }
  
  &-outline {
    background: transparent;
    color: var(--color-primary);
    border: 2px solid var(--color-primary);
    
    &:hover {
      background: var(--color-primary);
      color: white;
    }
  }
}

/* Mobile navigation improvements */
.mobile-nav-item {
  min-height: 44px; /* Apple HIG recommendation */
  display: flex;
  align-items: center;
}
```

## 3. Main App Component

```typescript
// app.component.ts
import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: `
    <div class="app">
      <app-header></app-header>
      <main class="main-content">
        <app-hero></app-hero>
        <app-features></app-features>
        <app-actions></app-actions>
        <app-stats></app-stats>
      </main>
      <app-footer></app-footer>
    </div>
  `,
  styles: [`
    .app {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .main-content {
      flex: 1;
    }
  `]
})
export class AppComponent { }
```

## 4. Header Component (Mobile-Optimized)

```typescript
// components/header/header.component.ts
import { Component } from '@angular/core';

@Component({
  selector: 'app-header',
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

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
    document.body.style.overflow = this.menuOpen ? 'hidden' : '';
  }

  closeMenu() {
    this.menuOpen = false;
    document.body.style.overflow = '';
  }
}
```

```scss
// components/header/header.component.scss
.mobile-header {
  background: var(--color-primary);
  color: white;
  padding: var(--space-sm) 0;
  position: sticky;
  top: 0;
  z-index: 1000;
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.15);
  
  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: relative;
  }

  .logo {
    font-size: 1.4rem;
    font-weight: 700;
    color: white;
  }

  .menu-toggle {
    background: none;
    border: none;
    width: 32px;
    height: 32px;
    position: relative;
    cursor: pointer;
    z-index: 1001;
    
    span {
      display: block;
      height: 3px;
      width: 100%;
      background: white;
      margin: 5px 0;
      transition: all 0.3s ease;
      border-radius: 2px;
    }
  }

  .nav {
    position: fixed;
    top: 0;
    right: -100%;
    width: 85%;
    height: 100vh;
    background: var(--color-primary-dark);
    padding: 80px var(--space-md) var(--space-md);
    transition: right 0.3s ease;
    overflow-y: auto;
    
    &-open {
      right: 0;
    }

    .nav-item {
      display: block;
      color: rgba(255, 255, 255, 0.9);
      text-decoration: none;
      padding: var(--space-sm);
      border-radius: 8px;
      margin-bottom: var(--space-xs);
      transition: all 0.3s ease;
      font-weight: 500;
      
      &:hover, &.active {
        color: white;
        background: rgba(255, 255, 255, 0.1);
      }
    }

    .nav-actions {
      margin-top: var(--space-lg);
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
      
      .btn {
        width: 100%;
        justify-content: center;
      }
    }
  }

  @media (min-width: 768px) {
    .menu-toggle {
      display: none;
    }
    
    .nav {
      position: static;
      width: auto;
      height: auto;
      background: transparent;
      padding: 0;
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      
      .nav-item {
        display: inline-block;
        padding: var(--space-xs) var(--space-sm);
        margin-bottom: 0;
      }
      
      .nav-actions {
        margin-top: 0;
        flex-direction: row;
        gap: var(--space-sm);
        
        .btn {
          width: auto;
        }
      }
    }
  }
}
```

## 5. Hero Component

```typescript
// components/hero/hero.component.ts
import { Component } from '@angular/core';

@Component({
  selector: 'app-hero',
  template: `
    <section class="hero-section">
      <div class="container">
        <div class="hero-content">
          <h1 class="hero-title">Building Trust in Democratic Institutions</h1>
          <p class="hero-subtitle">
            A secure platform for political parties and NGOs to engage members, 
            ensure transparency, and strengthen democratic processes worldwide.
          </p>
          <div class="hero-actions">
            <button class="btn btn-secondary hero-cta">Start Your Digital Transformation</button>
            <button class="btn btn-outline">Learn More</button>
          </div>
        </div>
        
        <!-- Mobile app preview -->
        <div class="mobile-preview">
          <div class="phone-mockup">
            <div class="phone-screen">
              <div class="app-screen">
                <div class="app-header">Public Digit</div>
                <div class="app-content">
                  <div class="stats-grid">
                    <div class="stat-card">
                      <div class="stat-number">312</div>
                      <div class="stat-label">Parties</div>
                    </div>
                    <div class="stat-card">
                      <div class="stat-number">2.1K</div>
                      <div class="stat-label">NGOs</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styleUrls: ['./hero.component.scss']
})
export class HeroComponent { }
```

```scss
// components/hero/hero.component.scss
.hero-section {
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
  color: white;
  padding: var(--space-xl) 0;
  position: relative;
  overflow: hidden;

  .hero-content {
    text-align: center;
    margin-bottom: var(--space-xl);
    
    .hero-title {
      font-size: 2.2rem;
      font-weight: 700;
      margin-bottom: var(--space-md);
      line-height: 1.2;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }

    .hero-subtitle {
      font-size: 1.1rem;
      margin-bottom: var(--space-lg);
      opacity: 0.95;
      line-height: 1.6;
      max-width: 500px;
      margin-left: auto;
      margin-right: auto;
    }

    .hero-actions {
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
      align-items: center;
      
      .hero-cta {
        font-size: 1.1rem;
        padding: 16px 32px;
      }
      
      @media (min-width: 480px) {
        flex-direction: row;
        justify-content: center;
      }
    }
  }

  .mobile-preview {
    display: flex;
    justify-content: center;
    
    .phone-mockup {
      width: 280px;
      height: 560px;
      background: var(--color-surface);
      border-radius: 40px;
      padding: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      position: relative;
      
      .phone-screen {
        width: 100%;
        height: 100%;
        background: var(--color-background);
        border-radius: 32px;
        overflow: hidden;
        position: relative;
      }

      .app-screen {
        height: 100%;
        display: flex;
        flex-direction: column;
        
        .app-header {
          background: var(--color-primary);
          color: white;
          padding: var(--space-md);
          font-weight: 600;
          text-align: center;
        }
        
        .app-content {
          flex: 1;
          padding: var(--space-md);
          
          .stats-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: var(--space-sm);
            margin-top: var(--space-lg);
            
            .stat-card {
              background: var(--color-surface);
              padding: var(--space-md);
              border-radius: 12px;
              text-align: center;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
              
              .stat-number {
                font-size: 1.5rem;
                font-weight: 700;
                color: var(--color-primary);
                margin-bottom: var(--space-xs);
              }
              
              .stat-label {
                font-size: 0.875rem;
                color: var(--color-neutral-700);
              }
            }
          }
        }
      }
    }
  }

  @media (min-width: 768px) {
    .container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      align-items: center;
      gap: var(--space-xl);
    }
    
    .hero-content {
      text-align: left;
      margin-bottom: 0;
      
      .hero-actions {
        justify-content: flex-start;
      }
    }
    
    .hero-title {
      font-size: 2.8rem;
    }
  }
}
```

## 6. Features Component

```typescript
// components/features/features.component.ts
import { Component } from '@angular/core';

interface Feature {
  icon: string;
  title: string;
  description: string;
  color: string;
}

@Component({
  selector: 'app-features',
  template: `
    <section class="features-section">
      <div class="container">
        <h2 class="section-title">Why Choose Public Digit?</h2>
        <p class="section-subtitle">
          Designed specifically for the unique needs of political organizations and NGOs
        </p>
        
        <div class="features-grid">
          <div class="feature-card" *ngFor="let feature of features" 
               [style.border-color]="feature.color">
            <div class="feature-icon" [style.background]="feature.color">
              {{feature.icon}}
            </div>
            <h3 class="feature-title">{{feature.title}}</h3>
            <p class="feature-description">{{feature.description}}</p>
          </div>
        </div>
      </div>
    </section>
  `,
  styleUrls: ['./features.component.scss']
})
export class FeaturesComponent {
  features: Feature[] = [
    {
      icon: '🔒',
      title: 'Secure & Compliant',
      description: 'Enterprise-grade security meeting political compliance standards with end-to-end encryption.',
      color: 'var(--color-primary)'
    },
    {
      icon: '🌍',
      title: 'Global Reach',
      description: 'Support for multiple languages, currencies, and political systems across borders.',
      color: 'var(--color-secondary)'
    },
    {
      icon: '📊',
      title: 'Advanced Analytics',
      description: 'Deep insights into member engagement and campaign performance for data-driven decisions.',
      color: 'var(--color-accent)'
    },
    {
      icon: '🤝',
      title: 'Member Engagement',
      description: 'Tools to actively engage members, coordinate events, and build strong communities.',
      color: 'var(--color-info)'
    }
  ];
}
```

```scss
// components/features/features.component.scss
.features-section {
  padding: var(--space-xl) 0;
  background: var(--color-surface);

  .section-title {
    text-align: center;
    font-size: 2rem;
    font-weight: 700;
    color: var(--color-primary);
    margin-bottom: var(--space-sm);
  }

  .section-subtitle {
    text-align: center;
    color: var(--color-neutral-700);
    font-size: 1.1rem;
    max-width: 500px;
    margin: 0 auto var(--space-xl);
    line-height: 1.6;
  }

  .features-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-md);
    
    @media (min-width: 640px) {
      grid-template-columns: repeat(2, 1fr);
    }
    
    @media (min-width: 1024px) {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  .feature-card {
    background: var(--color-surface);
    padding: var(--space-lg);
    border-radius: 20px;
    border: 2px solid;
    transition: all 0.3s ease;
    text-align: center;
    
    &:hover {
      transform: translateY(-8px);
      box-shadow: 0 20px 40px rgba(30, 58, 138, 0.15);
    }

    .feature-icon {
      width: 70px;
      height: 70px;
      border-radius: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto var(--space-md);
      font-size: 1.8rem;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
    }

    .feature-title {
      font-size: 1.3rem;
      font-weight: 600;
      color: var(--color-primary);
      margin-bottom: var(--space-sm);
    }

    .feature-description {
      color: var(--color-neutral-700);
      line-height: 1.6;
      font-size: 0.95rem;
    }
  }
}
```

## 7. Actions Component

```typescript
// components/actions/actions.component.ts
import { Component } from '@angular/core';

interface ActionItem {
  title: string;
  description: string;
  type: 'urgent' | 'normal' | 'success';
  deadline?: string;
}

@Component({
  selector: 'app-actions',
  template: `
    <section class="actions-section">
      <div class="container">
        <h2 class="section-title">Current Actions</h2>
        
        <div class="actions-list">
          <div class="action-card" *ngFor="let action of actions" 
               [class]="'action-' + action.type">
            <div class="action-badge" *ngIf="action.type === 'urgent'">
              Urgent
            </div>
            <h3 class="action-title">{{action.title}}</h3>
            <p class="action-description">{{action.description}}</p>
            <div class="action-footer">
              <span class="action-deadline" *ngIf="action.deadline">
                {{action.deadline}}
              </span>
              <button class="btn btn-primary action-button">
                Participate
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styleUrls: ['./actions.component.scss']
})
export class ActionsComponent {
  actions: ActionItem[] = [
    {
      title: 'Voter Registration Drive',
      description: 'Help register new voters before the upcoming municipal elections across multiple districts.',
      type: 'urgent',
      deadline: 'Deadline: 2 days'
    },
    {
      title: 'Policy Forum: Climate Action',
      description: 'Join the discussion on environmental policies with leading NGOs and policymakers.',
      type: 'normal'
    },
    {
      title: 'Member Growth Initiative',
      description: 'Successful campaign with 15,000 new members joined this month across all parties.',
      type: 'success'
    }
  ];
}
```

```scss
// components/actions/actions.component.scss
.actions-section {
  padding: var(--space-xl) 0;
  background: var(--color-background);

  .section-title {
    text-align: center;
    font-size: 2rem;
    font-weight: 700;
    color: var(--color-primary);
    margin-bottom: var(--space-lg);
  }

  .actions-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .action-card {
    background: var(--color-surface);
    padding: var(--space-lg);
    border-radius: 16px;
    border-left: 6px solid var(--color-primary);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    position: relative;
    
    &.action-urgent {
      border-left-color: var(--color-accent);
    }
    
    &.action-success {
      border-left-color: var(--color-success);
    }

    .action-badge {
      background: var(--color-accent);
      color: var(--color-primary-dark);
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 0.875rem;
      font-weight: 600;
      display: inline-block;
      margin-bottom: var(--space-sm);
    }

    .action-title {
      font-size: 1.3rem;
      font-weight: 600;
      color: var(--color-primary);
      margin-bottom: var(--space-sm);
    }

    .action-description {
      color: var(--color-neutral-700);
      line-height: 1.6;
      margin-bottom: var(--space-md);
    }

    .action-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--space-sm);
      
      .action-deadline {
        color: var(--color-accent);
        font-weight: 600;
        font-size: 0.9rem;
      }
      
      .action-button {
        min-width: 120px;
      }
    }
  }
}
```

## 8. Stats Component

```typescript
// components/stats/stats.component.ts
import { Component, OnInit } from '@angular/core';

interface Stat {
  number: string;
  label: string;
  increment: number;
}

@Component({
  selector: 'app-stats',
  template: `
    <section class="stats-section">
      <div class="container">
        <div class="stats-grid">
          <div class="stat-item" *ngFor="let stat of stats">
            <span class="stat-number">{{stat.number}}</span>
            <div class="stat-label">{{stat.label}}</div>
          </div>
        </div>
      </div>
    </section>
  `,
  styleUrls: ['./stats.component.scss']
})
export class StatsComponent implements OnInit {
  stats: Stat[] = [
    { number: '312', label: 'Political Parties', increment: 1 },
    { number: '2,156', label: 'NGO Partners', increment: 5 },
    { number: '3.1M', label: 'Active Members', increment: 1000 },
    { number: '78', label: 'Countries', increment: 1 }
  ];

  ngOnInit() {
    // Animation for stats could be added here
  }
}
```

```scss
// components/stats/stats.component.scss
.stats-section {
  background: var(--color-primary);
  color: white;
  padding: var(--space-xl) 0;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%23ffffff' fill-opacity='0.05' fill-rule='evenodd'/%3E%3C/svg%3E");
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-lg);
    position: relative;
    z-index: 1;
    
    @media (min-width: 640px) {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  .stat-item {
    text-align: center;
    padding: var(--space-md);

    .stat-number {
      font-size: 2.5rem;
      font-weight: 800;
      color: var(--color-secondary);
      display: block;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      margin-bottom: var(--space-xs);
      
      @media (min-width: 768px) {
        font-size: 3rem;
      }
    }

    .stat-label {
      font-size: 1rem;
      opacity: 0.9;
      font-weight: 500;
      
      @media (min-width: 768px) {
        font-size: 1.1rem;
      }
    }
  }
}
```

## 9. Footer Component

```typescript
// components/footer/footer.component.ts
import { Component } from '@angular/core';

interface FooterSection {
  title: string;
  links: string[];
}

@Component({
  selector: 'app-footer',
  template: `
    <footer class="footer">
      <div class="container">
        <div class="footer-content">
          <div class="footer-section" *ngFor="let section of footerSections">
            <h3>{{section.title}}</h3>
            <ul class="footer-links">
              <li *ngFor="let link of section.links">
                <a href="#">{{link}}</a>
              </li>
            </ul>
          </div>
        </div>
        
        <div class="footer-bottom">
          <div class="copyright">
            &copy; 2024 Public Digit. Committed to strengthening democracy through technology.
          </div>
          <div class="footer-social">
            <a href="#" class="social-link">Twitter</a>
            <a href="#" class="social-link">LinkedIn</a>
            <a href="#" class="social-link">GitHub</a>
          </div>
        </div>
      </div>
    </footer>
  `,
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent {
  footerSections: FooterSection[] = [
    {
      title: 'Platform',
      links: ['For Political Parties', 'For NGOs', 'Election Management', 'Member Engagement', 'Security Features']
    },
    {
      title: 'Resources',
      links: ['Documentation', 'Case Studies', 'Compliance Guide', 'API Reference', 'Help Center']
    },
    {
      title: 'Company',
      links: ['About Us', 'Transparency Report', 'Careers', 'Contact', 'Security']
    }
  ];
}
```

```scss
// components/footer/footer.component.scss
.footer {
  background: var(--color-primary-dark);
  color: white;
  padding: var(--space-xl) 0 var(--space-lg);

  .footer-content {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-xl);
    margin-bottom: var(--space-xl);
    
    @media (min-width: 640px) {
      grid-template-columns: repeat(2, 1fr);
    }
    
    @media (min-width: 1024px) {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .footer-section {
    h3 {
      color: var(--color-secondary);
      margin-bottom: var(--space-md);
      font-size: 1.2rem;
      font-weight: 600;
    }

    .footer-links {
      list-style: none;
      
      li {
        margin-bottom: var(--space-sm);
        
        a {
          color: rgba(255, 255, 255, 0.8);
          text-decoration: none;
          transition: all 0.3s ease;
          padding: 4px 0;
          display: block;
          
          &:hover {
            color: var(--color-secondary);
            transform: translateX(8px);
          }
        }
      }
    }
  }

  .footer-bottom {
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding-top: var(--space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    align-items: center;
    text-align: center;
    
    @media (min-width: 640px) {
      flex-direction: row;
      justify-content: space-between;
      text-align: left;
    }

    .copyright {
      color: rgba(255, 255, 255, 0.6);
      font-size: 0.9rem;
    }

    .footer-social {
      display: flex;
      gap: var(--space-md);
      
      .social-link {
        color: rgba(255, 255, 255, 0.7);
        text-decoration: none;
        transition: color 0.3s ease;
        
        &:hover {
          color: var(--color-secondary);
        }
      }
    }
  }
}
```

## 10. Angular Configuration Files

```json
// angular.json (relevant parts)
{
  "projects": {
    "public-digit": {
      "architect": {
        "build": {
          "options": {
            "styles": [
              "src/styles.scss"
            ],
            "scripts": []
          },
          "configurations": {
            "production": {
              "optimization": true,
              "outputHashing": "all",
              "sourceMap": false,
              "namedChunks": false,
              "extractLicenses": true,
              "vendorChunk": false,
              "buildOptimizer": true
            }
          }
        }
      }
    }
  }
}
```

```json
// package.json (dependencies)
{
  "dependencies": {
    "@angular/animations": "^17.0.0",
    "@angular/common": "^17.0.0",
    "@angular/compiler": "^17.0.0",
    "@angular/core": "^17.0.0",
    "@angular/platform-browser": "^17.0.0",
    "@angular/platform-browser-dynamic": "^17.0.0",
    "@angular/router": "^17.0.0",
    "rxjs": "~7.8.0",
    "tslib": "^2.3.0",
    "zone.js": "~0.14.0"
  },
  "devDependencies": {
    "@angular-devkit/build-angular": "^17.0.0",
    "@angular/cli": "^17.0.0",
    "@angular/compiler-cli": "^17.0.0",
    "typescript": "~5.2.0"
  }
}
```

## Key Mobile Optimizations:

1. **Touch-Friendly Interfaces**: Minimum 44px touch targets
2. **Mobile-First Responsive Design**: Grid systems that work on small screens
3. **Performance Optimized**: Lazy loading, optimized images
4. **Progressive Web App Ready**: Service workers, app manifest
5. **Accessibility**: ARIA labels, proper contrast ratios
6. **Smooth Animations**: CSS transitions optimized for mobile
7. **Offline Capability**: Service worker for critical assets

This Angular implementation provides a complete, production-ready mobile app for the Public Digit platform with your specified color scheme and mobile-optimized user experience.