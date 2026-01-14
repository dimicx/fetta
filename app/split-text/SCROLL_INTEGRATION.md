# Scroll & InView Integration Guide

Complete guide for integrating SplitText with Motion's scroll and viewport detection features.

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [React Patterns](#react-patterns)
3. [Vanilla JS Patterns](#vanilla-js-patterns)
4. [Best Practices](#best-practices)
5. [Common Pitfalls](#common-pitfalls)

## Quick Reference

### When to Use What

| Use Case | React | Vanilla JS |
|----------|-------|------------|
| Trigger once when visible | `useInView` + colocate in `onSplit` | `inView` callback |
| Re-animate on visibility | `useInView` + `useEffect` + ref | `inView` with cleanup |
| Scroll-linked (parallax) | `useScroll` + `useEffect` + ref | `scroll` callback |
| With responsive text | Store in ref, re-setup on resize | Use `onResize` callback |

### Storage Strategy

**✅ Colocate** - No storage needed:
```tsx
// React
<SplitText onSplit={({ words }) => {
  if (isInView) animate(words, { opacity: [0, 1] });
}}>
```

**📦 Use Ref** - Only when needed:
```tsx
// React - for re-animation or scroll-linked
const wordsRef = useRef(null);
```

**❌ Avoid State** - Causes unnecessary re-renders:
```tsx
// DON'T DO THIS
const [words, setWords] = useState(null);
```

## React Patterns

### Pattern 1: Animate Once When Visible (Colocated)

**Best for:** Simple "reveal on scroll" animations that trigger once.

```tsx
import { SplitText } from './split-text';
import { animate, stagger } from 'motion';
import { useInView } from 'motion/react';
import { useRef } from 'react';

function AnimateOnView() {
  const ref = useRef(null);
  const isInView = useInView(ref, {
    once: true,    // Only trigger once
    amount: 0.5    // 50% visible
  });

  return (
    <div ref={ref}>
      <SplitText
        onSplit={({ words }) => {
          // Logic colocated - no storage needed!
          if (isInView) {
            animate(
              words,
              { opacity: [0, 1], y: [20, 0] },
              { delay: stagger(0.05) }
            );
          }
        }}
      >
        <h1>Reveals when scrolled into view</h1>
      </SplitText>
    </div>
  );
}
```

**Why this works:**
- `onSplit` runs after text is split
- By that time, `isInView` is already set correctly
- No storage needed - all logic in one place!

### Pattern 2: Re-animate on Each View

**Best for:** Animations that should replay when element enters viewport multiple times.

```tsx
function ReanimateOnView() {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef); // No "once" - tracks visibility
  const wordsRef = useRef(null); // Store elements in ref

  useEffect(() => {
    if (isInView && wordsRef.current) {
      animate(
        wordsRef.current,
        { opacity: [0, 1], y: [20, 0] },
        { delay: stagger(0.05) }
      );
    }
  }, [isInView]); // Re-run when visibility changes

  return (
    <div ref={containerRef}>
      <SplitText
        onSplit={({ words }) => {
          wordsRef.current = words; // Store in ref, not state!
        }}
      >
        <h1>Re-animates each time visible</h1>
      </SplitText>
    </div>
  );
}
```

**Why use ref instead of state:**
- Refs don't cause re-renders
- Split only happens once, no need to react to changes
- Cleaner and more performant

### Pattern 3: Scroll-Linked Animation

**Best for:** Parallax effects, scroll-driven reveals, progress-based animations.

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

    // Subscribe to scroll progress changes
    return scrollYProgress.on("change", (progress) => {
      wordsRef.current.forEach((word, i) => {
        // Stagger based on index
        const wordProgress = Math.max(0, progress - (i * 0.05));
        word.style.opacity = wordProgress;
        word.style.transform = `translateY(${(1 - wordProgress) * 20}px)`;
      });
    });
  }, [scrollYProgress]);

  return (
    <div ref={ref} style={{ height: '200vh' }}>
      <SplitText
        onSplit={({ words }) => {
          wordsRef.current = words;
        }}
      >
        <h1>Animates as you scroll</h1>
      </SplitText>
    </div>
  );
}
```

### Pattern 4: With AutoSplit

**Best for:** Responsive layouts where text reflows.

```tsx
function ResponsiveScrollReveal() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <div ref={ref}>
      <SplitText
        autoSplit // Re-splits on resize
        onSplit={({ lines }) => {
          // Animates on initial split only
          if (isInView) {
            animate(
              lines,
              { opacity: [0, 1], x: [-50, 0] },
              { delay: stagger(0.1) }
            );
          }
        }}
      >
        <p className="text-lg">
          This text re-splits responsively but only animates
          once when it first enters the viewport.
        </p>
      </SplitText>
    </div>
  );
}
```

## Vanilla JS Patterns

### Pattern 1: Basic InView Trigger

```typescript
import { splitText } from './splitText';
import { inView } from 'motion';
import { animate, stagger } from 'motion';

const element = document.querySelector('[data-animate]');
const result = splitText(element);

// Fires once when element enters viewport
inView(
  element,
  () => {
    animate(
      result.words,
      { opacity: [0, 1], y: [20, 0] },
      { delay: stagger(0.05) }
    );
  },
  { amount: 0.5 }
);
```

### Pattern 2: Enter/Leave Animations

```typescript
const element = document.querySelector('[data-animate]');
const result = splitText(element);

inView(
  element,
  () => {
    // Enter animation
    animate(
      result.words,
      { opacity: [0, 1], scale: [0.8, 1] },
      { delay: stagger(0.05) }
    );

    // Return cleanup for leave animation
    return () => {
      animate(
        result.words,
        { opacity: 0, scale: 0.8 },
        { duration: 0.3 }
      );
    };
  },
  { amount: 0.3 }
);
```

### Pattern 3: Scroll-Linked

```typescript
import { scroll } from 'motion';

const element = document.querySelector('[data-scroll]');
const result = splitText(element);

scroll(
  ({ y }) => {
    result.words.forEach((word, i) => {
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

### Pattern 4: AutoSplit with InView Re-setup

```typescript
const element = document.querySelector('[data-split]');

function setupInView(words: HTMLSpanElement[]) {
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

// Cleanup
window.addEventListener('beforeunload', () => {
  result.dispose();
});
```

## Best Practices

### ✅ DO: Colocate Logic When Possible

```tsx
// React - colocate in onSplit
<SplitText
  onSplit={({ words }) => {
    if (isInView) animate(words, { opacity: [0, 1] });
  }}
>
  <h1>Text</h1>
</SplitText>

// Vanilla - all in one callback
inView(element, () => {
  const result = splitText(element);
  animate(result.words, { opacity: [0, 1] });
});
```

### ✅ DO: Use Refs for Storage (React)

```tsx
const wordsRef = useRef(null); // No re-renders

useEffect(() => {
  if (wordsRef.current) {
    animate(wordsRef.current, { opacity: [0, 1] });
  }
}, [isInView]);
```

### ✅ DO: Cleanup AutoSplit Resources

```tsx
// React - automatic cleanup on unmount
useEffect(() => {
  return () => result.dispose();
}, []);

// Vanilla - manual cleanup
window.addEventListener('beforeunload', () => {
  result.dispose();
});
```

### ❌ DON'T: Store in State (React)

```tsx
// Causes unnecessary re-renders
const [words, setWords] = useState(null);
```

### ❌ DON'T: Split Before Fonts Load

```tsx
// ❌ BAD - fonts may not be loaded
const result = splitText(element);

// ✅ GOOD - wait for fonts
document.fonts.ready.then(() => {
  const result = splitText(element);
});

// ✅ GOOD - React component handles this automatically
<SplitText onSplit={...}>
```

### ❌ DON'T: Forget to Dispose AutoSplit

```tsx
// ❌ BAD - memory leak!
const result = splitText(element, { autoSplit: true });

// ✅ GOOD - cleanup
const result = splitText(element, { autoSplit: true });
window.addEventListener('beforeunload', () => {
  result.dispose();
});
```

## Common Pitfalls

### Pitfall 1: Animation Doesn't Trigger

**Problem:**
```tsx
// isInView is false when onSplit runs
const isInView = useInView(ref);

<div ref={ref}>
  <SplitText onSplit={({ words }) => {
    if (isInView) animate(words, { opacity: [0, 1] });
  }}>
```

**Solution:** Use `once: true` or check timing:
```tsx
const isInView = useInView(ref, { once: true });
// OR use useEffect pattern for re-animation
```

### Pitfall 2: Scroll Animation Stutters

**Problem:**
```tsx
// Creating new animations on every scroll update
scroll(({ y }) => {
  animate(words, { opacity: y.progress }); // BAD!
});
```

**Solution:** Update styles directly:
```tsx
scroll(({ y }) => {
  words.forEach(word => {
    word.style.opacity = y.progress; // GOOD!
  });
});
```

### Pitfall 3: AutoSplit Breaking InView

**Problem:**
```typescript
// inView only set up once, but words array changes on resize
inView(element, () => {
  animate(result.words, { opacity: [0, 1] });
});

const result = splitText(element, { autoSplit: true });
```

**Solution:** Re-setup in onResize:
```typescript
const result = splitText(element, {
  autoSplit: true,
  onResize: ({ words }) => {
    setupInView(words); // Re-setup!
  }
});
```

### Pitfall 4: Unnecessary Re-renders (React)

**Problem:**
```tsx
const [words, setWords] = useState(null); // Re-renders on set!
```

**Solution:**
```tsx
const wordsRef = useRef(null); // No re-renders!
```

## InView Options Reference

```typescript
inView(element, callback, {
  // How much of element must be visible
  amount: 0.5,           // 0-1 or "some" | "all"

  // Root element for intersection
  root: document.querySelector('#container'),

  // Margin around viewport
  margin: "0px 0px -100px 0px"
});

// React
useInView(ref, {
  once: true,            // Only fire callback once
  amount: 0.5,
  root: containerRef,
  margin: "0px"
});
```

## Scroll Options Reference

```typescript
scroll(callback, {
  // Target element to track
  target: element,

  // Offset points [start, end]
  offset: ["start end", "end start"],
  // "start end" = target start hits viewport end
  // "end start" = target end hits viewport start

  // Axis to track
  axis: "y" // or "x"
});

// React
useScroll({
  target: ref,
  offset: ["start end", "end start"],
  axis: "y"
});
```

## Resources

- [Motion InView Docs](https://motion.dev/docs/inview)
- [Motion Scroll Docs](https://motion.dev/docs/scroll)
- [React useInView Docs](https://motion.dev/docs/react-use-in-view)
- [React useScroll Docs](https://motion.dev/docs/react-use-scroll)
- [Core API Documentation](./CORE_API.md)
- [React API Documentation](./REACT_API.md)
