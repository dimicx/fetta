# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**fetta** is a text-splitting library for advanced text animation effects. It implements a sophisticated text-splitting utility that addresses kerning compensation and natural line wrapping with special character handling (em-dashes, en-dashes).

This is a monorepo containing:
- `packages/fetta` - The core library (published to npm as `fetta`)
- `website` - Documentation site built with Fumadocs

## Development Commands

```bash
# Start all development servers (turbo)
pnpm dev

# Build all packages
pnpm build

# Build only the fetta library
pnpm lib:build

# Start library development
pnpm lib:dev
```

### Website-specific commands

```bash
cd website

# Start dev server
pnpm dev

# Build for production
pnpm build
```

## Architecture

### Package Structure

```
packages/fetta/
├── src/
│   ├── core/
│   │   ├── index.ts       # Core exports
│   │   └── splitText.ts   # Core splitting logic with kerning compensation
│   ├── react/
│   │   ├── index.ts       # React exports
│   │   └── SplitText.tsx  # React component wrapper
│   └── index.ts           # Main entry (re-exports core)
└── dist/                  # Built output
```

### Key Architectural Features

**Kerning Compensation System**
The core innovation is measuring character positions BEFORE splitting, then applying margin adjustments AFTER splitting to maintain original typography:

1. Measure original character positions using Range API
2. Split text into span elements
3. Calculate gap differences between original and split positions
4. Apply `marginLeft` adjustments to each character

**Dash Handling**
Text can wrap naturally after em-dashes (—) and en-dashes (–):
- Words are split at these characters into separate word elements
- Continuation segments (after dashes) are marked with `noSpaceBefore` flag
- Spaces are conditionally inserted based on this flag

**AutoSplit Feature**
The implementation supports automatic re-splitting on resize:
- Uses ResizeObserver on parent element
- Debounces resize events (100ms)
- Restores original HTML and re-measures before splitting
- Optional `onResize` callback for handling re-animations

**Revert on Complete**
Text can be reverted to original HTML after animation completes:
- Return an animation (e.g., `animate(...)`) from `onSplit` callback
- Set `revertOnComplete={true}` to auto-revert when animation finishes
- Cleans up observers and timers via `dispose()`

**InView Support**
Built-in viewport detection with IntersectionObserver:
- `inView` prop enables viewport detection
- `onInView` callback fires when element enters viewport
- `onLeaveView` callback fires when element leaves viewport
- Supports `once`, `amount`, and `margin` options

### Website Structure

```
website/
├── app/
│   ├── docs/              # Fumadocs documentation
│   │   ├── [[...slug]]/   # Dynamic doc pages
│   │   └── layout.tsx     # Docs layout with sidebar
│   ├── api/search/        # Search API endpoint
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page with examples
└── content/docs/          # MDX documentation content
```

## Important Implementation Details

### Font Ligatures
The implementation **disables font ligatures** (`font-variant-ligatures: none`) because ligatures cannot span multiple span elements. This is set permanently and maintained even after revert.

### Accessibility
Split text elements automatically receive `aria-label` with the original text content for screen readers.

### Line Detection
Lines are detected by Y-position clustering after kerning compensation is applied. Words with Y-positions within 5px tolerance are grouped into the same line.

### Safari Browser Handling
Kerning compensation is disabled in Safari because its Range API returns integer values instead of sub-pixel precision. The `isSafari` constant in `splitText.ts` detects Safari/WebKit browsers. When using `revertOnComplete` with character splitting in Safari, `font-kerning: none` is applied to prevent visual shift on revert.

### State Management in React Component
The React wrapper uses:
- `useRef` to avoid re-renders from prop changes
- `useLayoutEffect` to keep refs in sync before effects run
- Guards against double-execution in React StrictMode
- Cleanup via returned functions in `useEffect`

## CSS Classes

Default classes applied to split elements:
- `.split-char` - Individual characters
- `.split-word` - Word wrappers
- `.split-line` - Line wrappers (display: block)

All can be customized via options.

## TypeScript

Project uses strict TypeScript with:
- Target: ES2017
- JSX: react-jsx
- Path alias: `@/*` maps to project root
- Bundler module resolution

## Dependencies

Key dependencies:
- `motion` - Animation library (used in examples)
- `next` 16.x
- `react` 19.x
- `tailwindcss` 4.x
- `fumadocs-*` - Documentation framework

## Working with the Code

### Testing

```bash
cd packages/fetta

# Run unit tests
pnpm test

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage

# Run E2E tests
pnpm test:e2e

# Run all tests
pnpm test:all
```

For manual testing:
1. Run `pnpm dev` from root
2. View http://localhost:3000
3. Check examples on the page
4. Test responsive behavior by resizing the browser

### Adding New Animation Examples
New examples follow this pattern:
```tsx
import { SplitText } from "fetta/react";
import { animate, stagger } from "motion";

<SplitText
  onSplit={({ chars, words, lines }) => {
    animate(elements, props, options);
  }}
  options={{ charClass, wordClass, lineClass }}
  autoSplit={boolean}
  revertOnComplete={boolean}
>
  <element>Text content</element>
</SplitText>
```

### Debugging Split Issues
If text doesn't split correctly:
1. Check that fonts are loaded (`document.fonts.ready`)
2. Verify element has actual text content
3. Check console for warnings about missing parent (autoSplit)
4. Inspect applied `data-*` attributes and margins
5. Verify ligatures are disabled
