# React SplitText Component Documentation

A declarative React wrapper for the `splitText` function that handles text splitting with automatic font loading, visibility management, and lifecycle cleanup.

## Installation

```tsx
import { SplitText } from './split-text';
```

## Basic Usage

```tsx
<SplitText
  onSplit={({ words }) => {
    animate(words, { opacity: [0, 1], y: [20, 0] });
  }}
>
  <h1>Hello World</h1>
</SplitText>
```

## API Reference

### SplitText Component

#### Props

```typescript
interface SplitTextProps {
  children: ReactElement;
  onSplit: (result: Omit<SplitResult, "revert" | "dispose">) => void | Promise<unknown>;
  options?: SplitTextOptions;
  autoSplit?: boolean;
  revertOnComplete?: boolean;
}
```

- **children**: Single React element containing the text to split
- **onSplit**: Callback invoked after text is split. Receives split elements. Can return a Promise for use with `revertOnComplete`
- **options**: Configuration object (see Core API docs)
- **autoSplit**: Enable responsive re-splitting on resize (default: `false`)
- **revertOnComplete**: When `true`, reverts to original HTML after `onSplit`'s returned Promise resolves (default: `false`)

## Features

### 1. Basic Text Animation

```tsx
<SplitText
  onSplit={({ words }) => {
    animate(words, { opacity: [0, 1] });
  }}
>
  <h1>Animated Text</h1>
</SplitText>
```

### 2. Character-Level Animation

```tsx
<SplitText
  onSplit={({ chars }) => {
    animate(
      chars,
      { opacity: [0, 1], rotateY: [90, 0] },
      { delay: stagger(0.02) }
    );
  }}
>
  <h1>Character by Character</h1>
</SplitText>
```

### 3. Line-Based Animation

```tsx
<SplitText
  onSplit={({ lines }) => {
    animate(
      lines,
      { opacity: [0, 1], y: [50, 0] },
      { delay: stagger(0.1) }
    );
  }}
>
  <p>
    Multiple lines of text will be detected automatically
    and each line can be animated independently.
  </p>
</SplitText>
```

### 4. Responsive AutoSplit

Text automatically re-splits when the container resizes:

```tsx
<SplitText
  autoSplit
  onSplit={({ words }) => {
    animate(words, { opacity: [0, 1] });
  }}
>
  <p>This text will re-split when the window resizes</p>
</SplitText>
```

**Important notes:**
- `onSplit` only fires once (on initial split)
- Text re-splits on resize, but animations do NOT re-trigger
- Component automatically cleans up observers on unmount

### 5. Revert After Animation

Automatically restore original HTML when animation completes:

```tsx
<SplitText
  revertOnComplete
  onSplit={({ words }) => {
    // Must return a Promise!
    return animate(words, { opacity: [0, 1] }).finished;
  }}
>
  <h1>This will revert after animation</h1>
</SplitText>
```

**Requirements:**
- `revertOnComplete` must be `true`
- `onSplit` must return a Promise (e.g., `animation.finished`)
- Component will warn if Promise is missing or prop is mismatched

### 6. Custom Options

```tsx
<SplitText
  options={{
    charClass: 'char',
    wordClass: 'word',
    lineClass: 'line'
  }}
  onSplit={({ words }) => {
    animate(words, { opacity: [0, 1] });
  }}
>
  <h1>Custom Classes</h1>
</SplitText>
```

## Complete Examples

### Example 1: Staggered Word Animation

```tsx
import { SplitText } from './split-text';
import { animate, stagger } from 'motion';

export default function Page() {
  return (
    <SplitText
      onSplit={({ words }) => {
        animate(
          words,
          { opacity: [0, 1], y: [20, 0] },
          { delay: stagger(0.05), easing: spring() }
        );
      }}
    >
      <h1>Words appear one by one</h1>
    </SplitText>
  );
}
```

### Example 2: Character Reveal with Rotation

```tsx
<SplitText
  onSplit={({ chars }) => {
    animate(
      chars,
      {
        opacity: [0, 1],
        rotateY: [90, 0],
        filter: ['blur(4px)', 'blur(0px)']
      },
      { delay: stagger(0.02) }
    );
  }}
>
  <h1>Spinning Characters</h1>
</SplitText>
```

### Example 3: Responsive Lines with AutoSplit

```tsx
<SplitText
  autoSplit
  onSplit={({ lines }) => {
    animate(
      lines,
      { opacity: [0, 1], x: [-50, 0] },
      { delay: stagger(0.1) }
    );
  }}
>
  <p className="text-lg">
    This paragraph will automatically re-split into lines
    when you resize your browser window. The line breaks
    will adjust based on the container width.
  </p>
</SplitText>
```

### Example 4: Animation that Reverts

```tsx
<SplitText
  revertOnComplete
  onSplit={({ words }) => {
    const animation = animate(
      words,
      {
        opacity: [0, 1, 1, 0],
        filter: ['blur(10px)', 'blur(0px)', 'blur(0px)', 'blur(10px)']
      },
      { duration: 2 }
    );

    // Must return the promise!
    return animation.finished;
  }}
>
  <h1>This text will revert after 2 seconds</h1>
</SplitText>
```

### Example 5: Multiple Animation Layers

```tsx
<SplitText
  onSplit={({ chars, words, lines }) => {
    // Animate at multiple levels
    animate(lines, { opacity: [0, 1] }, { duration: 0.5 });
    animate(
      words,
      { y: [20, 0] },
      { delay: stagger(0.05), duration: 0.6 }
    );
    animate(
      chars,
      { rotateZ: [-5, 0] },
      { delay: stagger(0.01), duration: 0.4 }
    );
  }}
>
  <h1>Complex Multi-Layer Animation</h1>
</SplitText>
```

## Important Notes

### Font Loading

The component automatically waits for `document.fonts.ready` before splitting. This ensures accurate measurements.

### Container Visibility

The wrapper container is initially hidden (`visibility: hidden`) and revealed after splitting completes. This prevents Flash of Unsplit Content (FOUC).

### Automatic Cleanup

The component automatically:
- Disposes observers when unmounted
- Cleans up timers and resources
- Handles React Strict Mode double-execution

### Children Requirements

- Must be a single React element (not a fragment or array)
- Must accept a `ref` prop (forwarded for DOM access)
- Cannot be a string or number

```tsx
// ✅ Valid
<SplitText onSplit={...}>
  <h1>Text</h1>
</SplitText>

// ❌ Invalid - multiple children
<SplitText onSplit={...}>
  <h1>Text</h1>
  <p>More text</p>
</SplitText>

// ❌ Invalid - not an element
<SplitText onSplit={...}>
  Just text
</SplitText>
```

### AutoSplit Behavior

When `autoSplit` is enabled:
- Observes the parent container for size changes
- Only re-splits if width changed
- Debounced to 100ms to prevent excessive re-splitting
- **Does NOT** re-trigger `onSplit` callback or animations

If you want animations on resize, use the core function with `onResize` callback instead.

### RevertOnComplete Requirements

For `revertOnComplete` to work:
1. Set `revertOnComplete={true}` on component
2. Return a Promise from `onSplit` callback
3. Typically use `animation.finished` from Motion animations

```tsx
// ✅ Correct usage
<SplitText
  revertOnComplete
  onSplit={({ words }) => {
    return animate(words, { opacity: [0, 1] }).finished;
  }}
>
  <h1>Text</h1>
</SplitText>

// ⚠️ Will warn - Promise returned but prop not set
<SplitText
  onSplit={({ words }) => {
    return animate(words, { opacity: [0, 1] }).finished;
  }}
>
  <h1>Text</h1>
</SplitText>

// ⚠️ Will warn - Prop set but no Promise returned
<SplitText
  revertOnComplete
  onSplit={({ words }) => {
    animate(words, { opacity: [0, 1] });  // No return!
  }}
>
  <h1>Text</h1>
</SplitText>
```

## TypeScript Support

The component is fully typed:

```typescript
import type { SplitResult, SplitTextOptions } from './split-text';

// onSplit receives result without revert/dispose
type OnSplitResult = Omit<SplitResult, "revert" | "dispose">;

// Can return void or Promise
type OnSplitCallback = (result: OnSplitResult) => void | Promise<unknown>;
```

## Differences from Core Function

| Feature | React Component | Core Function |
|---------|----------------|---------------|
| Font loading | Automatic | Manual (`document.fonts.ready`) |
| Initial visibility | Managed (prevents FOUC) | Manual |
| Cleanup | Automatic on unmount | Manual (`dispose()`) |
| AutoSplit | Delegated to core | Built-in |
| RevertOnComplete | Callback-based | Promise-based |
| Usage | Declarative (JSX) | Imperative (JS) |

## When to Use Each

**Use React Component when:**
- Building React applications
- Want automatic font loading and visibility management
- Prefer declarative JSX syntax
- Need lifecycle integration with React

**Use Core Function when:**
- Building vanilla JS/TS applications
- Using other frameworks (Vue, Svelte, etc.)
- Need more control over the lifecycle
- Want to integrate with custom animation libraries
- Need the `onResize` callback for autoSplit

## Integration with Motion Scroll & InView

### Using useInView - Colocated Pattern (Recommended)

Trigger animations when elements enter viewport:

```tsx
import { SplitText } from './split-text';
import { animate, stagger } from 'motion';
import { useInView } from 'motion/react';
import { useRef } from 'react';

function ScrollReveal() {
  const ref = useRef(null);
  const isInView = useInView(ref, {
    once: true,  // Only trigger once
    amount: 0.5  // Trigger when 50% visible
  });

  return (
    <div ref={ref}>
      <SplitText
        onSplit={({ words }) => {
          // Logic colocated - check isInView right here!
          if (isInView) {
            animate(
              words,
              { opacity: [0, 1], y: [20, 0] },
              { delay: stagger(0.05) }
            );
          }
        }}
      >
        <h1>Animates when scrolled into view</h1>
      </SplitText>
    </div>
  );
}
```

### Re-animate on Visibility Changes

Only use refs/effects if you need to re-animate:

```tsx
function ReanimateOnView() {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef);
  const wordsRef = useRef(null); // Use ref, NOT state!

  useEffect(() => {
    if (isInView && wordsRef.current) {
      animate(
        wordsRef.current,
        { opacity: [0, 1], y: [20, 0] },
        { delay: stagger(0.05) }
      );
    }
  }, [isInView]);

  return (
    <div ref={containerRef}>
      <SplitText
        onSplit={({ words }) => {
          wordsRef.current = words; // Store in ref
        }}
      >
        <h1>Re-animates each time it enters view</h1>
      </SplitText>
    </div>
  );
}
```

### Character Reveal on Scroll

```tsx
function CharacterReveal() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <div ref={ref}>
      <SplitText
        onSplit={({ chars }) => {
          if (isInView) {
            animate(
              chars,
              {
                opacity: [0, 1],
                rotateY: [90, 0],
                filter: ['blur(4px)', 'blur(0px)']
              },
              { delay: stagger(0.02) }
            );
          }
        }}
      >
        <h1>Character by character reveal</h1>
      </SplitText>
    </div>
  );
}
```

### Scroll-Linked Animation with useScroll

Link text opacity/position to scroll progress:

```tsx
import { useScroll } from 'motion/react';

function ScrollLinked() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });
  const wordsRef = useRef(null);

  useEffect(() => {
    if (!wordsRef.current) return;

    // Update on scroll
    return scrollYProgress.on("change", (progress) => {
      wordsRef.current.forEach((word, i) => {
        const wordProgress = Math.max(0, progress - (i * 0.05));
        word.style.opacity = wordProgress;
        word.style.transform = `translateY(${(1 - wordProgress) * 20}px)`;
      });
    });
  }, [scrollYProgress]);

  return (
    <div ref={ref}>
      <SplitText
        onSplit={({ words }) => {
          wordsRef.current = words;
        }}
      >
        <h1>Opacity tied to scroll position</h1>
      </SplitText>
    </div>
  );
}
```

### Best Practices for Scroll/InView Integration

**✅ DO: Colocate when possible**
```tsx
// Simple trigger - check isInView in onSplit
<SplitText
  onSplit={({ words }) => {
    if (isInView) animate(words, { opacity: [0, 1] });
  }}
>
  <h1>Text</h1>
</SplitText>
```

**✅ DO: Use refs (not state) for re-animation**
```tsx
const wordsRef = useRef(null); // No re-renders!
useEffect(() => {
  if (isInView && wordsRef.current) {
    animate(wordsRef.current, { opacity: [0, 1] });
  }
}, [isInView]);
```

**❌ DON'T: Store in state unnecessarily**
```tsx
// Causes unnecessary re-renders
const [words, setWords] = useState(null);
```

## See Also

- [Core API Documentation](./CORE_API.md) - Vanilla JS/TS usage with scroll/inView examples
- [Motion Documentation](https://motion.dev) - Animation library
- [useInView Documentation](https://motion.dev/docs/react-use-in-view) - React scroll-triggered state
- [useScroll Documentation](https://motion.dev/docs/react-use-scroll) - React scroll-linked animations
