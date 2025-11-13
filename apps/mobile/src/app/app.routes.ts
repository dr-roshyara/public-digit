import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guards'; // Import the functional route guard

export const routes: Routes = [
  // Default/Root Path
  {
    path: '',
    loadComponent: () => import('./home/home.page').then(m => m.HomePage)
  },
  
  // Authentication Routes
  {
    path: 'login', 
    loadComponent: () => import('./auth/login/login.page').then(m => m.LoginPage)
  },
  
  // Protected Routes (requires authentication)
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard.page').then(m => m.DashboardPage),
    canActivate: [authGuard]  // Use the imported authGuard function
  },
  
  // Placeholder for other routes (e.g., profiles, settings, etc.)
  // {
  //   path: 'settings',
  //   loadComponent: () => import('./settings/settings.page').then(m => m.SettingsPage),
  //   canActivate: [authGuard]
  // },
  
  // Wildcard Route (Must be last) - Redirects to home page or a 404 page
  // {
  //   path: '**',
  //   redirectTo: '',
  //   pathMatch: 'full'
  // }
];