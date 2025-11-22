# Claude CLI Prompt Engineering Instructions: Angular Mobile App Implementation

## SYSTEM PROMPT
```
You are a Senior Angular Developer & UI/UX Architect specializing in mobile-first applications, modern CSS systems, and enterprise-grade Angular development. Your expertise includes:
- Angular 17+ with standalone components and signals
- Mobile-optimized responsive design
- OKLCH color systems and design tokens
- Performance optimization for mobile devices
- Accessibility (WCAG 2.1 AA) and touch interfaces
- Progressive Web App (PWA) implementation
```

## PROJECT CONTEXT
```
Building "Public Digit" - A mobile-first Angular application for political parties and NGOs featuring:
- Primary color: oklch(25.7% 0.09 281.288) (Deep Trust Blue)
- Target: Mobile devices with desktop progressive enhancement
- Requirements: Touch-optimized, accessible, performant
- Tech stack: Angular 17+, SCSS, TypeScript, PWA capabilities
```

## 1. PROJECT SETUP & ARCHITECTURE PROMPT
```
Create comprehensive Angular project setup with mobile-first architecture:

1. **PROJECT INITIALIZATION**
   - Angular 17+ with standalone components configuration
   - SCSS preprocessing with design token system
   - Mobile-optimized build configuration
   - PWA setup with service worker

2. **DESIGN TOKEN SYSTEM**
   - OKLCH color variables with fallbacks
   - Mobile spacing scale (xs, sm, md, lg, xl)
   - Typography scale for mobile readability
   - Breakpoint system for responsive design

3. **COMPONENT ARCHITECTURE**
   - Standalone component structure
   - Mobile-first responsive utilities
   - Touch-optimized interaction patterns
   - Accessibility foundation

Output: Complete project structure with configuration files and design system foundation.
```

## 2. MOBILE-OPTIMIZED COMPONENT IMPLEMENTATION PROMPT
```
Implement mobile-optimized Angular components with these specifications:

1. **HEADER COMPONENT**
   - Sticky mobile navigation with hamburger menu
   - Touch-friendly menu items (min 44px height)
   - Smooth animations and transitions
   - Progressive enhancement for desktop

2. **HERO COMPONENT**
   - Mobile-first responsive typography
   - Touch-optimized CTA buttons
   - Performance-optimized background
   - Phone mockup visualization

3. **FEATURES GRID**
   - CSS Grid with mobile fallback
   - Touch-friendly card interactions
   - Loading optimization for mobile networks
   - Accessibility labels and roles

4. **ACTIONS FEED**
   - Swipe-friendly card layout
   - Status indicators with color coding
   - Actionable touch targets
   - Offline capability consideration

Provide: Complete component files (.ts, .html, .scss) with mobile optimization comments.
```

## 3. RESPONSIVE DESIGN & LAYOUT PROMPT
```
Implement responsive design system with mobile-first approach:

1. **BREAKPOINT STRATEGY**
   - Mobile-first media queries
   - Container query implementation where beneficial
   - Flexible grid systems
   - Touch vs mouse interaction detection

2. **TOUCH OPTIMIZATION**
   - Minimum 44px touch targets
   - Touch-friendly form controls
   - Swipe and gesture considerations
   - Hover state alternatives for touch

3. **PERFORMANCE OPTIMIZATION**
   - Lazy loading implementation
   - Image optimization for mobile
   - CSS containment for performance
   - Bundle size optimization

4. **ACCESSIBILITY MOBILE PATTERNS**
   - Mobile screen reader optimization
   - Touch target accessibility
   - Dynamic type support
   - Reduced motion preferences

Deliver: Responsive utilities, layout components, and performance optimizations.
```

## 4. DESIGN SYSTEM & STYLING PROMPT
```
Create comprehensive design system implementation:

1. **OKLCH COLOR SYSTEM**
   - Semantic color tokens
   - Contrast ratio validation
   - Dark mode preparation
   - Color manipulation utilities

2. **TYPOGRAPHY SCALE**
   - Mobile-optimized font sizes
   - Line height ratios for readability
   - Responsive type scaling
   - Accessibility-focused typography

3. **SPACING SYSTEM**
   - 8px base unit system
   - Mobile-optimized padding/margins
   - Consistent spacing scale
   - Responsive spacing utilities

4. **COMPONENT VARIABLES**
   - Border radii consistency
   - Shadow hierarchy
   - Animation timing functions
   - Z-index management

Output: Complete SCSS architecture with design tokens and utility classes.
```

## 5. INTERACTION & ANIMATION PROMPT
```
Implement mobile-optimized interactions and animations:

1. **TOUCH INTERACTIONS**
   - Ripple effects for touch feedback
   - Swipe gestures for navigation
   - Pull-to-refresh patterns
   - Touch-optimized form interactions

2. **PERFORMANT ANIMATIONS**
   - CSS transforms and opacity
   - Will-change property optimization
   - Reduced motion preferences
   - Loading state animations

3. **MICROINTERACTIONS**
   - Button press states
   - Loading indicators
   - Success/error states
   - Progressive disclosure

4. **PAGE TRANSITIONS**
   - Route transition animations
   - Loading state management
   - Error boundary animations
   - Offline state indicators

Provide: Animation utilities, interaction directives, and state management.
```

## 6. PERFORMANCE & PWA PROMPT
```
Implement performance optimizations and PWA features:

1. **BUNDLE OPTIMIZATION**
   - Lazy loading route configuration
   - Tree-shakable component architecture
   - Asset optimization strategies
   - Code splitting implementation

2. **PWA IMPLEMENTATION**
   - Service worker configuration
   - App manifest with mobile metadata
   - Offline fallback strategies
   - Push notification setup

3. **MOBILE PERFORMANCE**
   - Critical CSS inlining
   - Image lazy loading
   - Virtual scrolling for large lists
   - Memory leak prevention

4. **ANALYTICS & MONITORING**
   - Performance metrics tracking
   - Error reporting setup
   - User interaction analytics
   - Core Web Vitals optimization

Deliver: Performance configurations, PWA setup, and monitoring implementation.
```

## 7. TESTING & QUALITY ASSURANCE PROMPT
```
Create comprehensive testing strategy for mobile Angular app:

1. **UNIT TESTING**
   - Component testing with TestBed
   - Service testing with mocking
   - Mobile-specific test cases
   - Accessibility testing integration

2. **E2E TESTING**
   - Mobile viewport testing
   - Touch interaction testing
   - Cross-browser mobile testing
   - Performance testing scenarios

3. **ACCESSIBILITY TESTING**
   - Screen reader compatibility
   - Keyboard navigation testing
   - Color contrast validation
   - Touch target verification

4. **MOBILE DEVICE TESTING**
   - Real device testing checklist
   - Network condition testing
   - Battery usage optimization
   - Memory usage profiling

Output: Complete test suites, testing utilities, and quality assurance protocols.
```

## 8. DEPLOYMENT & MAINTENANCE PROMPT
```
Implement deployment and maintenance procedures:

1. **BUILD OPTIMIZATION**
   - Production build configuration
   - Asset compression strategies
   - Cache optimization
   - CDN configuration

2. **DEPLOYMENT PIPELINE**
   - CI/CD mobile testing integration
   - App store preparation (if needed)
   - Progressive deployment strategy
   - Rollback procedures

3. **MONITORING & ANALYTICS**
   - Real User Monitoring (RUM) setup
   - Error tracking implementation
   - Performance monitoring
   - User behavior analytics

4. **MAINTENANCE PROCEDURES**
   - Dependency update strategy
   - Breaking change management
   - Performance regression testing
   - Security update procedures

Provide: Deployment configurations, monitoring setup, and maintenance documentation.
```

## EXECUTION WORKFLOW
```
Execute prompts in this sequence for complete implementation:

PHASE 1: FOUNDATION
1. PROJECT SETUP & ARCHITECTURE
2. DESIGN SYSTEM & STYLING

PHASE 2: COMPONENTS
3. MOBILE-OPTIMIZED COMPONENT IMPLEMENTATION
4. RESPONSIVE DESIGN & LAYOUT

PHASE 3: INTERACTIONS
5. INTERACTION & ANIMATION
6. PERFORMANCE & PWA

PHASE 4: QUALITY
7. TESTING & QUALITY ASSURANCE
8. DEPLOYMENT & MAINTENANCE

Between phases, provide:
- Implementation review
- Performance metrics
- Accessibility audit results
- Mobile compatibility report
```

## EXPECTED DELIVERABLES
```
For each prompt, provide:

1. **SOURCE CODE**: Complete Angular components, services, and utilities
2. **CONFIGURATION**: Build, test, and deployment configurations
3. **DOCUMENTATION**: Implementation guides and usage examples
4. **TESTING**: Comprehensive test suites and quality checks
5. **PERFORMANCE**: Optimization reports and metrics
6. **ACCESSIBILITY**: Compliance reports and improvements

All code should follow Angular best practices, mobile optimization standards, and accessibility guidelines.
```

## SUCCESS CRITERIA
```
The implementation should achieve:

- **95+ Lighthouse Mobile Score**
- **WCAG 2.1 AA Compliance**
- **Sub-3s First Contentful Paint on 4G**
- **Smooth 60fps animations**
- **Touch-optimized interactions**
- **Offline functionality**
- **Cross-browser mobile compatibility**
- **Accessible to screen readers and keyboard navigation**
```

This prompt engineering framework ensures professional, production-ready Angular mobile app implementation with comprehensive mobile optimization and enterprise-grade architecture.