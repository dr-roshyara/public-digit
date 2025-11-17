# Claude CLI Prompt Engineering Instructions: Color Scheme Replication

## PROMPT STRUCTURE

### 1. **CONTEXT & STYLE ANALYSIS**
```
Analyze the following Angular component's color scheme and styling approach. Extract the color palette, design system, and styling methodology to create reusable Tailwind CSS classes.
```

### 2. **COLOR PALETTE EXTRACTION COMMAND**
```
Extract and categorize the color scheme from the provided code:

PRIMARY COLORS:
- Text: rgba(55, 65, 81, 1) // gray-700
- Background: rgba(255, 255, 255, 1) // white
- Hero BG: hsla(214, 62%, 21%, 1) // dark blue
- Accent: hsla(162, 47%, 50%, 1) // teal
- Hover: hsla(162, 55%, 33%, 1) // dark teal

SECONDARY COLORS:
- Light text: rgba(107, 114, 128, 1) // gray-500
- Code background: rgba(55, 65, 81, 1) // gray-700
- Code text: rgba(229, 231, 235, 1) // gray-200
- Hover light: rgba(243, 244, 246, 1) // gray-100

BRAND COLORS:
- Nx Console: rgba(0, 122, 204, 1) // blue
- JetBrains: rgba(255, 49, 140, 1) // pink
- GitHub: rgba(24, 23, 23, 1) // black
```

### 3. **TAILWIND CONFIG GENERATION PROMPT**
```
Create a Tailwind CSS configuration that maps the extracted color palette to Tailwind classes:

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          text: 'rgba(55, 65, 81, 1)',
          bg: 'rgba(255, 255, 255, 1)',
          hero: 'hsla(214, 62%, 21%, 1)',
          accent: 'hsla(162, 47%, 50%, 1)',
          hover: 'hsla(162, 55%, 33%, 1)',
        },
        secondary: {
          light: 'rgba(107, 114, 128, 1)',
          code: {
            bg: 'rgba(55, 65, 81, 1)',
            text: 'rgba(229, 231, 235, 1)',
          },
          hover: 'rgba(243, 244, 246, 1)',
        },
        brand: {
          nx: 'rgba(0, 122, 204, 1)',
          jetbrains: 'rgba(255, 49, 140, 1)',
          github: 'rgba(24, 23, 23, 1)',
        }
      }
    }
  }
}
```
```

### 4. **COMPONENT STYLING TRANSLATION PROMPT**
```
Convert the inline CSS styles to Tailwind CSS utility classes, maintaining the same design system:

ORIGINAL → TAILWIND MAPPING:
- "color: rgba(55, 65, 81, 1)" → "text-primary-text"
- "background-color: hsla(214, 62%, 21%, 1)" → "bg-primary-hero"
- "color: rgba(255, 255, 255, 1)" → "text-white"
- "background-color: rgba(255, 255, 255, 1)" → "bg-white"
- "color: rgba(107, 114, 128, 1)" → "text-secondary-light"
- "background-color: rgba(55, 65, 81, 1)" → "bg-secondary-code-bg"
- "color: rgba(229, 231, 235, 1)" → "text-secondary-code-text"

SPACING & LAYOUT:
- "padding: 3rem 2rem" → "p-12 px-8" or "py-12 px-8"
- "margin-top: 2.5rem" → "mt-10"
- "border-radius: 1.5rem" → "rounded-3xl"
```

### 5. **CUSTOM COMPONENT CLASSES PROMPT**
```
Create reusable Tailwind component classes based on the design patterns:

```css
@layer components {
  .btn-hero {
    @apply bg-white text-primary-text rounded-xl inline-block mt-6 px-8 py-4 no-underline;
  }
  
  .card-shadow {
    @apply shadow-[0_0_#0000,0_0_#0000,0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)];
  }
  
  .list-item-hover {
    @apply hover:bg-primary-hover hover:text-white transition-all duration-150;
  }
  
  .code-block {
    @apply bg-secondary-code-bg text-secondary-code-text rounded p-2 px-3 overflow-auto font-mono;
  }
}
```
```

### 6. **RESPONSIVE DESIGN PRESERVATION PROMPT**
```
Preserve the responsive breakpoints from the original CSS:

```css
/* Original media query */
@media screen and (min-width: 768px) {
  #hero { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

/* Tailwind equivalent */
<div class="md:grid md:grid-cols-2">
```

Ensure mobile-first responsive design is maintained.
```

## SAMPLE USER PROMPT

```
Using the color scheme and design system from the provided Angular component, create:

1. A Tailwind CSS configuration with custom colors
2. Utility class mappings for all the original styles
3. Reusable component classes
4. Responsive design preservation

Maintain the exact same visual appearance but using Tailwind CSS methodology.
```

## EXPECTED OUTPUT FORMAT

```
## TAILWIND CSS COLOR SCHEME REPLICATION

### 1. CUSTOM COLOR CONFIGURATION
```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          text: 'rgba(55, 65, 81, 1)',
          // ... all extracted colors
        }
      }
    }
  }
}
```

### 2. UTILITY CLASS MAPPINGS
| Original CSS | Tailwind Classes |
|--------------|------------------|
| `color: rgba(55, 65, 81, 1)` | `text-primary-text` |
| `background-color: hsla(214, 62%, 21%, 1)` | `bg-primary-hero` |

### 3. COMPONENT CLASSES
```css
.btn-hero { /* ... */ }
.card-shadow { /* ... */ }
```

### 4. RESPONSIVE PRESERVATION
Mobile-first breakpoints maintained with `md:` and `lg:` prefixes.
```

This prompt engineering approach ensures consistent color scheme replication across your project while leveraging Tailwind CSS's utility-first methodology.