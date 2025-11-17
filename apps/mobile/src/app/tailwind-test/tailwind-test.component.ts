import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Tailwind CSS Verification Component
 *
 * This component demonstrates the successful integration of Tailwind CSS
 * with the Angular mobile app. It showcases:
 * - Custom theme colors (primary, secondary)
 * - Glassmorphism effects
 * - Mobile-optimized utilities
 * - Responsive design patterns
 * - Custom animations
 * - Safe area handling for mobile devices
 */
@Component({
  selector: 'pd-tailwind-test',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-primary-500 to-secondary-500 p-4 safe-area-padding">
      <!-- Header -->
      <header class="glass rounded-2xl p-6 mb-6 animate-slide-down">
        <h1 class="text-3xl font-bold text-white mb-2">
          Tailwind CSS Integration
        </h1>
        <p class="text-white/80 text-sm">
          Mobile-optimized styling for Angular app
        </p>
      </header>

      <!-- Color Palette Section -->
      <section class="card mb-6 animate-fade-in">
        <h2 class="text-xl font-bold text-white mb-4">Color Palette</h2>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="text-white/80 text-sm mb-2">Primary Colors</p>
            <div class="flex gap-2">
              <div class="w-12 h-12 rounded-lg bg-primary-400 shadow-mobile"></div>
              <div class="w-12 h-12 rounded-lg bg-primary-500 shadow-mobile"></div>
              <div class="w-12 h-12 rounded-lg bg-primary-600 shadow-mobile"></div>
            </div>
          </div>
          <div>
            <p class="text-white/80 text-sm mb-2">Secondary Colors</p>
            <div class="flex gap-2">
              <div class="w-12 h-12 rounded-lg bg-secondary-400 shadow-mobile"></div>
              <div class="w-12 h-12 rounded-lg bg-secondary-500 shadow-mobile"></div>
              <div class="w-12 h-12 rounded-lg bg-secondary-600 shadow-mobile"></div>
            </div>
          </div>
        </div>
      </section>

      <!-- Buttons Section -->
      <section class="card mb-6 animate-slide-up">
        <h2 class="text-xl font-bold text-white mb-4">Button Styles</h2>
        <div class="space-y-3">
          <button class="btn-primary w-full">
            Primary Button
          </button>
          <button class="btn-secondary w-full">
            Secondary Button
          </button>
          <button class="btn-outline w-full">
            Outline Button
          </button>
        </div>
      </section>

      <!-- Form Elements -->
      <section class="card mb-6 animate-fade-in">
        <h2 class="text-xl font-bold text-white mb-4">Form Elements</h2>
        <div class="form-group">
          <label class="form-label">Email Address</label>
          <input
            type="email"
            class="input-field"
            placeholder="Enter your email"
          />
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <input
            type="password"
            class="input-field"
            placeholder="Enter your password"
          />
        </div>
      </section>

      <!-- Glassmorphism Examples -->
      <section class="card mb-6 animate-scale-in">
        <h2 class="text-xl font-bold text-white mb-4">Glassmorphism Effects</h2>
        <div class="space-y-4">
          <div class="glass p-4 rounded-xl">
            <p class="text-white text-sm">Light Glass Effect</p>
          </div>
          <div class="glass-dark p-4 rounded-xl">
            <p class="text-white text-sm">Dark Glass Effect</p>
          </div>
        </div>
      </section>

      <!-- Responsive Grid -->
      <section class="card mb-6">
        <h2 class="text-xl font-bold text-white mb-4">Responsive Grid</h2>
        <div class="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-4">
          <div class="glass p-4 rounded-xl text-center">
            <div class="w-12 h-12 mx-auto mb-2 bg-primary-400 rounded-full"></div>
            <p class="text-white text-sm">Item 1</p>
          </div>
          <div class="glass p-4 rounded-xl text-center">
            <div class="w-12 h-12 mx-auto mb-2 bg-primary-500 rounded-full"></div>
            <p class="text-white text-sm">Item 2</p>
          </div>
          <div class="glass p-4 rounded-xl text-center">
            <div class="w-12 h-12 mx-auto mb-2 bg-primary-600 rounded-full"></div>
            <p class="text-white text-sm">Item 3</p>
          </div>
        </div>
      </section>

      <!-- Utility Classes Demo -->
      <section class="card mb-6">
        <h2 class="text-xl font-bold text-white mb-4">Custom Utilities</h2>
        <div class="space-y-3">
          <div class="p-4 gradient-primary rounded-xl">
            <p class="text-white text-sm font-semibold">Primary Gradient</p>
          </div>
          <div class="p-4 gradient-secondary rounded-xl">
            <p class="text-white text-sm font-semibold">Secondary Gradient</p>
          </div>
          <div class="p-4 bg-white/10 rounded-xl">
            <p class="text-gradient-primary text-lg font-bold">Text Gradient Primary</p>
          </div>
          <div class="p-4 bg-white/10 rounded-xl">
            <p class="text-gradient-secondary text-lg font-bold">Text Gradient Secondary</p>
          </div>
        </div>
      </section>

      <!-- Loading States -->
      <section class="card mb-6">
        <h2 class="text-xl font-bold text-white mb-4">Loading States</h2>
        <div class="flex items-center justify-center space-x-4 py-8">
          <div class="spinner"></div>
          <p class="text-white">Loading...</p>
        </div>
      </section>

      <!-- Messages -->
      <section class="card mb-6">
        <h2 class="text-xl font-bold text-white mb-4">Messages</h2>
        <div class="success-message mb-3">
          ✓ This is a success message
        </div>
        <div class="error-message">
          ✗ This is an error message
        </div>
      </section>

      <!-- Mobile Safe Areas -->
      <section class="card mb-6">
        <h2 class="text-xl font-bold text-white mb-4">Mobile Safe Areas</h2>
        <div class="space-y-3">
          <div class="safe-top bg-white/20 rounded-xl p-4">
            <p class="text-white text-sm">Safe Area Top Padding</p>
          </div>
          <div class="safe-bottom bg-white/20 rounded-xl p-4">
            <p class="text-white text-sm">Safe Area Bottom Padding</p>
          </div>
        </div>
      </section>

      <!-- Success Footer -->
      <footer class="glass rounded-2xl p-6 text-center">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-full mb-4 animate-scale-in">
          <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
        <h3 class="text-xl font-bold text-white mb-2">
          Tailwind CSS Successfully Integrated!
        </h3>
        <p class="text-white/80 text-sm">
          All custom utilities, components, and mobile optimizations are working correctly.
        </p>
      </footer>
    </div>
  `,
  styles: []
})
export class TailwindTestComponent {}
