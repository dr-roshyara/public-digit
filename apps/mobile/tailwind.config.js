/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './apps/mobile/src/**/*.{html,ts,scss}',
    './apps/mobile/src/**/*.component.{html,ts}',
  ],

  theme: {
    extend: {
      // Mobile-first breakpoints
      screens: {
        'xs': '360px',      // Small phones
        'sm': '480px',      // Standard phones
        'md': '768px',      // Tablets
        'lg': '1024px',     // Desktop
        'xl': '1280px',     // Large desktop
      },

      // PublicDigit Brand Identity Colors - Digital Democracy
      colors: {
        // Primary Blue - Trust, Security, Professionalism
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#2563eb',  // Main brand color - Trust & Security
          600: '#1d4ed8',
          700: '#1e40af',
          800: '#1e3a8a',
          900: '#1e3a8a',
          950: '#172554',
        },
        // Primary Purple - Innovation, Technology, Creativity
        secondary: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#7c3aed',  // Main brand color - Innovation & Technology
          600: '#6d28d9',
          700: '#5b21b6',
          800: '#4c1d95',
          900: '#3b0764',
          950: '#2e1065',
        },

        // UI Color System (from nx-welcome design)
        'ui-hero': 'hsla(214, 62%, 21%, 1)',       // Dark blue hero background
        'ui-accent': 'hsla(162, 47%, 50%, 1)',     // Teal accent
        'ui-accent-hover': 'hsla(162, 55%, 33%, 1)', // Dark teal hover
        'ui-text': 'rgba(55, 65, 81, 1)',          // Gray-700 primary text
        'ui-text-light': 'rgba(107, 114, 128, 1)', // Gray-500 secondary text
        'ui-code-bg': 'rgba(55, 65, 81, 1)',       // Code block background
        'ui-code-text': 'rgba(229, 231, 235, 1)',  // Code block text
        'ui-hover-bg': 'rgba(243, 244, 246, 1)',   // Light hover background

        // Brand Integration Colors
        'nx-console': 'rgba(0, 122, 204, 1)',      // Nx Console blue
        'jetbrains': 'rgba(255, 49, 140, 1)',      // JetBrains pink
        'github': 'rgba(24, 23, 23, 1)',           // GitHub black
        'heart': 'rgba(252, 165, 165, 1)',         // Love heart red
      },

      // Mobile-optimized spacing
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },

      // Typography optimized for mobile
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      },

      // Animation for mobile interactions
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },

      // Glassmorphism utilities
      backdropBlur: {
        xs: '2px',
      },
    },
  },

  plugins: [
    // Custom plugin for mobile-specific utilities
    function({ addUtilities }) {
      const mobileUtilities = {
        // Safe area padding utilities
        '.safe-area-padding': {
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        },
        '.safe-area-padding-top': {
          paddingTop: 'env(safe-area-inset-top)',
        },
        '.safe-area-padding-bottom': {
          paddingBottom: 'env(safe-area-inset-bottom)',
        },

        // Mobile tap highlighting
        '.tap-highlight-transparent': {
          '-webkit-tap-highlight-color': 'transparent',
        },

        // Glassmorphism effect
        '.glass': {
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        },
        '.glass-dark': {
          background: 'rgba(0, 0, 0, 0.1)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(0, 0, 0, 0.2)',
        },

        // Mobile scrolling
        '.scroll-smooth-touch': {
          '-webkit-overflow-scrolling': 'touch',
          scrollBehavior: 'smooth',
        },

        // Prevent text selection on mobile
        '.no-select': {
          '-webkit-user-select': 'none',
          '-moz-user-select': 'none',
          'user-select': 'none',
        },
      };

      addUtilities(mobileUtilities);
    },
  ],

  // Optimize for production builds
  corePlugins: {
    // Disable plugins not needed for mobile
    preflight: true,
  },
};
