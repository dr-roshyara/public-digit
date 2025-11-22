import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guards'; // Import the functional route guard
import { architectureGuard, blockAdminGuard } from './core/guards/architecture.guard';
import { LoginComponent } from '@presentation/pages/auth/login/login.component';
import { LandingComponent } from './landing/landing.component';
import { TailwindTestComponent } from './tailwind-test/tailwind-test.component';

export const routes: Routes = [
  // Landing Page (Public)
  { path: '', component: LandingComponent },

  // Authentication Routes (Public)
  { path: 'login', component: LoginComponent },

  // Tailwind CSS Verification Page (Public - Development Only)
  { path: 'tailwind-test', component: TailwindTestComponent },

  // Protected Routes (requires authentication)
  {
    path: 'dashboard',
    loadComponent: () => import('@presentation/pages/dashboard/dashboard.page').then(m => m.DashboardPage),
    canActivate: [authGuard, architectureGuard]  // Auth + Architecture validation
  },

  // Admin Routes - BLOCKED for Angular app
  {
    path: 'admin',
    canActivate: [blockAdminGuard],
    children: []  // Will always be blocked
  },

  // Tenant Member Routes - Protected by architecture guard
  // These routes are allowed for Angular app per architectural boundaries

  // {
  //   path: 'profile',
  //   canActivate: [authGuard, architectureGuard],
  //   loadChildren: () => import('./features/membership/membership.routes').then(m => m.membershipRoutes)
  // },

  // {
  //   path: 'elections',
  //   canActivate: [authGuard, architectureGuard],
  //   loadChildren: () => import('./features/elections/elections.routes').then(m => m.electionRoutes)
  // },

  // {
  //   path: 'finance',
  //   canActivate: [authGuard, architectureGuard],
  //   loadChildren: () => import('./features/finance/finance.routes').then(m => m.financeRoutes)
  // },

  // {
  //   path: 'forum',
  //   canActivate: [authGuard, architectureGuard],
  //   loadChildren: () => import('./features/communication/communication.routes').then(m => m.communicationRoutes)
  // },

  // Wildcard Route (Must be last) - Redirects to landing page
  {
    path: '**',
    redirectTo: '',
    pathMatch: 'full'
  }
];
