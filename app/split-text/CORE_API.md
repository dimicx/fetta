# Core splitText API Documentation

The `splitText` function is a vanilla JavaScript/TypeScript utility that splits text into characters, words, and lines with built-in kerning compensation.

## Installation

```typescript
import { splitText } from './splitText';
```

## Basic Usage

```typescript
const element = document.querySelector('h1');
const result = splitText(element);

// Access split elements
console.log(result.chars);  // Array of character spans
console.log(result.words);  // Array of word spans
console.log(result.lines);  // Array of line spans

// Animate them
animate(result.words, { opacity: [0, 1] });
```

## API Reference

### splitText(element, options?)

#### Parameters

- **element**: `HTMLElement` - The DOM element containing text to split
- **options**: `SplitTextOptions` (optional) - Configuration object

#### Returns

`SplitResult` object containing:
- `chars`: `HTMLSpanElement[]` - Array of character spans
- `words`: `HTMLSpanElement[]` - Array of word spans
- `lines`: `HTMLSpanElement[]` - Array of line spans
- `revert()`: Function to restore original HTML
- `dispose()`: Function to cleanup observers/timers (must call when using autoSplit)

## Options

```typescript
interface SplitTextOptions {
  // CSS class names for generated spans
  charClass?: string;      // Default: "split-char"
  wordClass?: string;      // Default: "split-word"
  lineClass?: string;      // Default: "split-line"

  // Auto-split on resize
  autoSplit?: boolean;     // Default: false

  // Callback when resize triggers re-split
  onResize?: (result: Omit<SplitResult, "revert" | "dispose">) => void;

  // Auto-revert when promise resolves
  revertOnComplete?: Promise<unknown>;
}
```

## Features

### 1. Basic Split

```typescript
const result = splitText(element);

// The element's innerHTML is now split into spans:
// <span class="split-line">
//   <span class="split-word">
//     <span class="split-char">H</span>
//     <span class="split-char">e</span>
//     ...
//   </span>
// </span>
```

### 2. Custom Class Names

```typescript
const result = splitText(element, {
  charClass: 'char',
  wordClass: 'word',
  lineClass: 'line'
});
```

### 3. AutoSplit (Responsive)

Automatically re-splits text when the parent container resizes:

```typescript
const result = splitText(element, {
  autoSplit: true
});

// IMPORTANT: Must call dispose() when done to prevent memory leaks
window.addEventListener('beforeunload', () => {
  result.dispose();
});
```

**How it works:**
- Observes the parent element for size changes
- Only re-splits if width actually changed
- Debounced (100ms) to prevent excessive re-splitting
- Does NOT re-trigger initial animations

### 4. AutoSplit with Callback

Optionally react to resize events:

```typescript
const result = splitText(element, {
  autoSplit: true,
  onResize: ({ chars, words, lines }) => {
    // Optional: animate on resize
    animate(words, { opacity: [0, 1] });
  }
});

// Don't forget to dispose!
window.addEventListener('beforeunload', () => {
  result.dispose();
});
```

### 5. RevertOnComplete

Automatically revert to original HTML after animation completes:

```typescript
const animation = animate(
  element.querySelectorAll('.word'),
  { opacity: [0, 1] }
);

const result = splitText(element, {
  revertOnComplete: animation.finished  // Pass the promise
});

// Will auto-revert and dispose when animation finishes
```

### 6. Revert Manually

```typescript
const result = splitText(element);

// Later... restore original HTML
result.revert();  // Also calls dispose() automatically
```

### 7. Dispose Resources

```typescript
const result = splitText(element, { autoSplit: true });

// When done (e.g., component unmount, page navigation)
result.dispose();  // Disconnects observers, clears timers
```

## Complete Examples

### Example 1: Simple Animation

```typescript
const element = document.querySelector('h1');
const result = splitText(element);

animate(
  result.words,
  { opacity: [0, 1], y: [20, 0] },
  { delay: stagger(0.05) }
);
```

### Example 2: Auto-Revert After Animation

```typescript
const element = document.querySelector('h1');
const animation = animate(
  element.querySelectorAll('.word'),
  { opacity: [0, 1] }
);

const result = splitText(element, {
  revertOnComplete: animation.finished
});

// Text will automatically revert when animation completes
```

### Example 3: Responsive Text Split

```typescript
const element = document.querySelector('p');
const result = splitText(element, {
  autoSplit: true,
  onResize: ({ lines }) => {
    // Re-animate when text reflows
    animate(lines, { opacity: [0, 1] });
  }
});

// Cleanup on page navigation
window.addEventListener('beforeunload', () => {
  result.dispose();
});
```

### Example 4: With Font Loading

```typescript
const element = document.querySelector('h1');

document.fonts.ready.then(() => {
  const result = splitText(element);
  animate(result.chars, { opacity: [0, 1] });
});
```

## Integration with Motion Scroll/View APIs

Trigger animations based on scroll position or viewport visibility using Motion's `inView` and `scroll` functions.

### Pattern 1: inView Trigger (Basic)

The most common pattern - animate when element enters viewport:

```typescript
import { splitText } from './splitText';
import { inView } from 'motion';
import { animate, stagger } from 'motion';

const element = document.querySelector('h1');
const result = splitText(element);

// Animate when element enters viewport
inView(
  element,
  () => {
    animate(
      result.words,
      { opacity: [0, 1], y: [20, 0] },
      { delay: stagger(0.05) }
    );
  },
  {
    amount: 0.5  // Trigger when 50% visible
  }
);
```

By default, the callback fires just once when the element first enters the viewport.

### Pattern 2: inView with Enter/Leave Animations

Return a cleanup function to animate when leaving viewport:

```typescript
import { splitText } from './splitText';
import { inView } from 'motion';
import { animate, stagger } from 'motion';

const element = document.querySelector('h1');
const result = splitText(element);

inView(
  element,
  () => {
    // Entering viewport
    animate(
      result.words,
      { opacity: [0, 1], y: [20, 0] },
      { delay: stagger(0.05) }
    );

    // Return cleanup function for leaving viewport
    return () => {
      animate(
        result.words,
        { opacity: 0 },
        { duration: 0.3 }
      );
    };
  },
  { amount: 0.3 }
);
```

### Pattern 3: Scroll-Linked Animation

Create parallax or scroll-linked effects with the `scroll` function:

```typescript
import { splitText } from './splitText';
import { scroll } from 'motion';

const element = document.querySelector('h1');
const result = splitText(element);

// Link animation to scroll position
scroll(
  ({ y }) => {
    result.words.forEach((word, i) => {
      // Stagger based on word index
      const progress = Math.max(0, Math.min(1, y.progress - (i * 0.05)));
      word.style.opacity = progress.toString();
      word.style.transform = `translateY(${(1 - progress) * 20}px)`;
    });
  },
  {
    target: element,
    offset: ["start end", "end start"]
  }
);
```

### Pattern 4: Multiple Triggers with autoSplit

When using `autoSplit`, re-setup observers in the `onResize` callback:

```typescript
import { splitText } from './splitText';
import { inView } from 'motion';
import { animate, stagger } from 'motion';

const element = document.querySelector('p');

function setupInView(words) {
  inView(
    element,
    () => {
      animate(
        words,
        { opacity: [0, 1] },
        { delay: stagger(0.03) }
      );
    },
    { amount: 0.5 }
  );
}

const result = splitText(element, {
  autoSplit: true,
  onResize: ({ words }) => {
    // Re-setup inView when text re-splits
    setupInView(words);
  }
});

// Initial setup
setupInView(result.words);

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  result.dispose();
});
```

### Pattern 5: Character Reveal on Scroll

Animate individual characters when scrolling into view:

```typescript
import { splitText } from './splitText';
import { inView } from 'motion';
import { animate, stagger } from 'motion';

const element = document.querySelector('h1');
const result = splitText(element);

inView(
  element,
  () => {
    animate(
      result.chars,
      {
        opacity: [0, 1],
        rotateY: [90, 0],
        filter: ['blur(4px)', 'blur(0px)']
      },
      { delay: stagger(0.02) }
    );
  },
  { amount: 0.3 }
);
```

### Motion API Options

#### inView Options

```typescript
{
  root?: Element;      // Viewport element (defaults to window)
  margin?: string;     // Extend/contract detection area (e.g., "0px 0px -100px 0px")
  amount?: "some" | "all" | number; // How much of element must be visible (0-1)
}
```

#### scroll Options

```typescript
{
  target?: Element;    // Element to track
  offset?: string[];   // Define start/end points (e.g., ["start end", "end start"])
  axis?: "x" | "y";    // Scroll axis to track
}
```

### Motion API Resources

- [inView — Scroll-triggered animations](https://motion.dev/docs/inview)
- [scroll() — Performant scroll-linked animations](https://motion.dev/docs/scroll)

## Important Notes

### Memory Management

- **Without autoSplit**: No cleanup needed (no resources to dispose)
- **With autoSplit**: Must call `dispose()` to disconnect ResizeObserver and prevent memory leaks
- **With revertOnComplete**: Auto-disposes after reverting

### Font Loading

The function measures text positions immediately. For accurate measurements, wait for fonts to load:

```typescript
document.fonts.ready.then(() => {
  const result = splitText(element);
});
```

### Ligatures

Font ligatures are automatically disabled (`fontVariantLigatures: "none"`) to ensure consistent appearance, as ligatures cannot span multiple elements.

### Kerning Compensation

The function measures original character positions and applies CSS margins to maintain proper spacing after splitting. This ensures the split text looks identical to the original.

### Special Characters

Em-dashes (—) and en-dashes (–) are treated as break points, allowing text to wrap naturally after these characters.

## TypeScript Types

```typescript
export interface SplitTextOptions {
  splitBy?: string;
  charClass?: string;
  wordClass?: string;
  lineClass?: string;
  autoSplit?: boolean;
  onResize?: (result: Omit<SplitResult, "revert" | "dispose">) => void;
  revertOnComplete?: Promise<unknown>;
}

export interface SplitResult {
  chars: HTMLSpanElement[];
  words: HTMLSpanElement[];
  lines: HTMLSpanElement[];
  revert: () => void;
  dispose: () => void;
}
```

## Browser Compatibility

Requires:
- `ResizeObserver` (for autoSplit)
- `Promise` support
- `Range.getBoundingClientRect()`
- `TreeWalker`

All modern browsers are supported.
