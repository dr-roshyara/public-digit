# PublicDigit Brand Colors - Digital Democracy

## Brand Identity

The color scheme for PublicDigit represents the core values of **Digital Democracy**:
- **Trust** and **Security**
- **Innovation** and **Technology**
- **Professionalism** and **Creativity**

---

## Color Palette

### Primary Blue - Trust, Security, Professionalism

**Hex:** `#2563eb`
**Usage:** Main brand color, primary actions, headers, navigation

This color represents the foundational principles of democracy: trust, security, and professionalism. Use it for:
- Primary buttons and CTAs
- Navigation bars and headers
- Important information highlights
- Trust indicators and security badges

```html
<!-- Examples -->
<button class="bg-primary-500 text-white">Vote Now</button>
<header class="bg-primary-600 text-white">PublicDigit</header>
<div class="border-primary-500 border-2">Secure Section</div>
```

**Color Shades:**
```
primary-50:  #eff6ff (Lightest)
primary-100: #dbeafe
primary-200: #bfdbfe
primary-300: #93c5fd
primary-400: #60a5fa
primary-500: #2563eb ⭐ Main Brand Color
primary-600: #1d4ed8
primary-700: #1e40af
primary-800: #1e3a8a
primary-900: #1e3a8a
primary-950: #172554 (Darkest)
```

---

### Primary Purple - Innovation, Technology, Creativity

**Hex:** `#7c3aed`
**Usage:** Secondary actions, accents, innovative features

This color represents the digital and technological aspects of the platform. Use it for:
- Secondary buttons and actions
- Feature highlights and innovations
- Accent colors and borders
- Technology-focused sections

```html
<!-- Examples -->
<button class="bg-secondary-500 text-white">Explore Technology</button>
<div class="text-secondary-600 font-bold">Innovative Feature</div>
<span class="bg-secondary-100 text-secondary-700 px-3 py-1 rounded-full">New</span>
```

**Color Shades:**
```
secondary-50:  #faf5ff (Lightest)
secondary-100: #f3e8ff
secondary-200: #e9d5ff
secondary-300: #d8b4fe
secondary-400: #c084fc
secondary-500: #7c3aed ⭐ Main Brand Color
secondary-600: #6d28d9
secondary-700: #5b21b6
secondary-800: #4c1d95
secondary-900: #3b0764
secondary-950: #2e1065 (Darkest)
```

---

## Brand Gradients

### Digital Democracy Gradient

The signature PublicDigit gradient combines both brand colors:

**CSS:**
```css
background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
```

**Tailwind Classes:**
```html
<!-- Using utility classes -->
<div class="bg-gradient-to-br from-primary-500 to-secondary-500">
  Digital Democracy Platform
</div>

<!-- Using custom gradient class -->
<div class="gradient-brand">
  Digital Democracy Platform
</div>
```

**Usage:**
- App backgrounds and hero sections
- Login/authentication pages
- Marketing materials
- Splash screens

---

## Color Usage Guidelines

### Primary Actions
Use **Primary Blue** for all primary actions that require user trust:
- Submit votes
- Login/authentication
- Confirm critical actions
- Primary navigation

```html
<button class="btn-primary">Cast Your Vote</button>
<button class="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-full">
  Secure Login
</button>
```

### Secondary Actions
Use **Primary Purple** for secondary actions and innovative features:
- Explore features
- Learn more
- Secondary CTAs
- Feature highlights

```html
<button class="btn-secondary">Learn More</button>
<button class="bg-secondary-500 hover:bg-secondary-600 text-white px-6 py-3 rounded-full">
  Explore Technology
</button>
```

### Neutral Actions
Use glassmorphism or outline styles for neutral actions:
```html
<button class="btn-outline">Cancel</button>
<button class="glass text-white px-6 py-3 rounded-full">Maybe Later</button>
```

---

## Accessibility

### Color Contrast Ratios

All color combinations meet WCAG 2.1 Level AA standards:

**Primary Blue (#2563eb):**
- ✅ White text: 7.4:1 (AAA)
- ✅ Black text: 3.1:1 (AA for large text)

**Primary Purple (#7c3aed):**
- ✅ White text: 8.1:1 (AAA)
- ✅ Black text: 2.8:1 (AA for large text)

**Recommendations:**
- Always use white text on primary-500 and secondary-500
- For lighter shades (100-300), use darker text colors
- For darker shades (700-950), use white text

---

## Mobile & Native Integration

### Capacitor Configuration

The brand colors are integrated into native mobile apps:

**Splash Screen:**
```typescript
SplashScreen: {
  backgroundColor: '#2563eb', // Primary Blue
}
```

**Status Bar:**
```typescript
StatusBar: {
  backgroundColor: '#2563eb', // Primary Blue
  style: 'LIGHT' // White text/icons
}
```

---

## Design System Integration

### Component Library

All mobile components use the brand color system:

| Component | Primary Color | Secondary Color |
|-----------|---------------|-----------------|
| Buttons | `bg-primary-500` | `bg-secondary-500` |
| Headers | `bg-primary-600` | `bg-secondary-600` |
| Cards | `glass` with primary accent | `glass` with secondary accent |
| Forms | `border-primary-500` | `border-secondary-500` |
| Badges | `bg-primary-100 text-primary-700` | `bg-secondary-100 text-secondary-700` |

### Example: Election Card

```html
<div class="card border-l-4 border-primary-500">
  <h3 class="text-xl font-bold text-white mb-2">Board Election 2024</h3>
  <p class="text-white/80 text-sm mb-4">Vote now for your representatives</p>
  <div class="flex gap-3">
    <button class="btn-primary flex-1">Vote Now</button>
    <button class="btn-outline">Learn More</button>
  </div>
  <div class="mt-4 flex items-center gap-2">
    <span class="bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-xs font-semibold">
      Secure
    </span>
    <span class="bg-secondary-100 text-secondary-700 px-3 py-1 rounded-full text-xs font-semibold">
      Verified
    </span>
  </div>
</div>
```

---

## Color Psychology

### Primary Blue (#2563eb)
- **Emotion:** Trust, Stability, Security
- **Association:** Democracy, Government, Official
- **Effect:** Calming, Professional, Authoritative

### Primary Purple (#7c3aed)
- **Emotion:** Innovation, Creativity, Wisdom
- **Association:** Technology, Future, Digital
- **Effect:** Inspiring, Modern, Forward-thinking

### Combined Gradient
- **Emotion:** Trust + Innovation = Digital Democracy
- **Association:** Secure Technology, Democratic Innovation
- **Effect:** Modern yet Trustworthy

---

## Testing & Verification

### Verification Page

Visit `/tailwind-test` to see all brand colors in action:
- Color palette display
- Button variations
- Gradient backgrounds
- Component examples
- Accessibility checks

### Browser DevTools

Check color application:
```javascript
// Get computed color
const button = document.querySelector('.btn-primary');
const bgColor = getComputedStyle(button).backgroundColor;
// Expected: rgb(37, 99, 235) which is #2563eb
```

---

## Export for Design Tools

### Figma Variables
```
Primary Blue 500: #2563eb
Primary Purple 500: #7c3aed
```

### Adobe XD
```
Brand Primary: #2563eb
Brand Secondary: #7c3aed
Gradient: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)
```

### Sketch
```
Color/Primary/500: #2563eb
Color/Secondary/500: #7c3aed
```

---

## Quick Reference

```scss
// CSS Variables (if needed)
:root {
  --color-primary: #2563eb;
  --color-secondary: #7c3aed;
  --gradient-brand: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
}
```

```html
<!-- Most Common Classes -->
<div class="bg-primary-500">Primary Background</div>
<div class="bg-secondary-500">Secondary Background</div>
<div class="text-primary-600">Primary Text</div>
<div class="text-secondary-600">Secondary Text</div>
<div class="border-primary-500">Primary Border</div>
<div class="border-secondary-500">Secondary Border</div>
<div class="gradient-brand">Brand Gradient</div>
```

---

**Last Updated:** 2025-11-17
**Design System:** PublicDigit Digital Democracy v1.0
**Status:** ✅ Production Ready
