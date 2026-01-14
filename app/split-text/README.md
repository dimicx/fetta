# SplitText

A custom text splitting utility with built-in kerning compensation and responsive features. Available as both a vanilla JavaScript function and a React component.

## Overview

SplitText splits text into individual characters, words, and lines while preserving exact spacing and appearance. Perfect for creating text animations with the Motion library.

### Key Features

- ✅ **Kerning Compensation** - Maintains original character spacing
- ✅ **Responsive AutoSplit** - Re-splits on container resize
- ✅ **Auto-Revert** - Restore original HTML after animations
- ✅ **Line Detection** - Automatically groups words into lines
- ✅ **Special Characters** - Smart handling of dashes and breaks
- ✅ **TypeScript** - Full type definitions included
- ✅ **Framework Agnostic** - Use with vanilla JS or React

## Quick Start

### Vanilla JavaScript

```typescript
import { splitText } from './split-text';
import { animate, stagger } from 'motion';

const element = document.querySelector('h1');
const result = splitText(element);

animate(
  result.words,
  { opacity: [0, 1], y: [20, 0] },
  { delay: stagger(0.05) }
);
```

### React

```tsx
import { SplitText } from './split-text';
import { animate, stagger } from 'motion';

<SplitText
  onSplit={({ words }) => {
    animate(
      words,
      { opacity: [0, 1], y: [20, 0] },
      { delay: stagger(0.05) }
    );
  }}
>
  <h1>Animated Text</h1>
</SplitText>
```

## Documentation

### [Core API Documentation](./CORE_API.md)
Complete reference for vanilla JavaScript/TypeScript usage:
- Basic splitting
- AutoSplit with ResizeObserver
- RevertOnComplete with Promises
- InView and Scroll integration
- Memory management
- TypeScript types

### [React Component Documentation](./REACT_API.md)
Complete reference for React usage:
- Component props
- Lifecycle management
- AutoSplit behavior
- RevertOnComplete pattern
- useInView and useScroll integration
- Best practices

### [Scroll & InView Integration Guide](./SCROLL_INTEGRATION.md)
Complete guide for scroll-triggered and scroll-linked animations:
- Trigger animations on viewport enter
- Scroll-linked parallax effects
- Colocated patterns (no state needed!)
- React and vanilla examples
- Common pitfalls and solutions

## Installation

```bash
# Copy the files to your project
cp -r app/split-text /your-project/
```

Dependencies:
- Motion (for animations)
- React 19+ (for React component only)

## Usage Patterns

### Pattern 1: Simple Animation (Vanilla)

```typescript
const result = splitText(element);
animate(result.chars, { opacity: [0, 1] });
```

### Pattern 2: Simple Animation (React)

```tsx
<SplitText onSplit={({ chars }) => {
  animate(chars, { opacity: [0, 1] });
}}>
  <h1>Text</h1>
</SplitText>
```

### Pattern 3: Responsive Text (Vanilla)

```typescript
const result = splitText(element, {
  autoSplit: true,
  onResize: ({ lines }) => {
    animate(lines, { opacity: [0, 1] });
  }
});

// Remember to cleanup!
window.addEventListener('beforeunload', () => {
  result.dispose();
});
```

### Pattern 4: Responsive Text (React)

```tsx
<SplitText
  autoSplit
  onSplit={({ lines }) => {
    animate(lines, { opacity: [0, 1] });
  }}
>
  <p>Responsive paragraph</p>
</SplitText>
```

### Pattern 5: Auto-Revert (Vanilla)

```typescript
const animation = animate(words, { opacity: [0, 1] });

const result = splitText(element, {
  revertOnComplete: animation.finished
});
```

### Pattern 6: Auto-Revert (React)

```tsx
<SplitText
  revertOnComplete
  onSplit={({ words }) => {
    return animate(words, { opacity: [0, 1] }).finished;
  }}
>
  <h1>Text</h1>
</SplitText>
```

## Choosing Between Vanilla and React

### Use Vanilla JS/TS When:
- Building with vanilla JS, Vue, Svelte, or other frameworks
- Need full control over initialization timing
- Want access to `onResize` callback
- Integrating with custom animation systems

### Use React Component When:
- Building React applications
- Want automatic font loading and visibility management
- Prefer declarative JSX syntax
- Need React lifecycle integration

## How It Works

1. **Measures** original character positions using Range API
2. **Splits** text into nested spans (lines > words > chars)
3. **Compensates** for kerning by applying CSS margins
4. **Detects** lines based on Y-position clustering
5. **Observes** (optional) for responsive re-splitting
6. **Reverts** (optional) after animations complete

## Performance

- Single-pass measurement for kerning compensation
- Debounced resize observer (100ms)
- Minimal DOM manipulation
- Automatic cleanup of observers and timers

## Browser Support

Requires modern browser features:
- `ResizeObserver` (for autoSplit)
- `Promise` support
- `Range.getBoundingClientRect()`
- `TreeWalker` API

All evergreen browsers are supported (Chrome, Firefox, Safari, Edge).

## Examples in This Project

See working examples in:
- `/app/page.tsx` - Multiple animation patterns with React
- `/app/example.tsx` - Vanilla JS usage
- `/app/comparison/page.tsx` - Side-by-side comparison

## API Surface

### Core Function

```typescript
function splitText(
  element: HTMLElement,
  options?: SplitTextOptions
): SplitResult
```

### React Component

```tsx
<SplitText
  onSplit={(result) => void | Promise}
  options?: SplitTextOptions
  autoSplit?: boolean
  revertOnComplete?: boolean
>
  {children}
</SplitText>
```

## License

MIT (adjust as needed)

## Credits

Based on the splitText implementation from [motion-plus](https://motion.dev/docs/motion-plus#split-text).
