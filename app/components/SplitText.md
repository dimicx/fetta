# SplitText Component

A declarative React wrapper around Motion+'s `splitText` utility that handles all the boilerplate (refs, font loading, visibility management) while giving you full control over animations.

## Installation

Requires `motion` and `motion-plus` packages:

```bash
pnpm add motion
pnpm add "https://api.motion.dev/registry.tgz?package=motion-plus&version=2.0.2&token=YOUR_TOKEN"
```

## Basic Usage

```tsx
import { animate, stagger } from "motion";
import { SplitText } from "./components/SplitText";

function Example() {
  return (
    <SplitText
      onSplit={({ words }) => {
        animate(
          words,
          { opacity: [0, 1], y: [20, 0] },
          { type: "spring", duration: 1.5, delay: stagger(0.05) }
        );
      }}
    >
      <h1>Your animated text here</h1>
    </SplitText>
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `children` | `ReactElement` | Yes | A single React element containing text (e.g., `<h1>`, `<p>`, `<span>`) |
| `onSplit` | `(result: SplitResult) => void` | Yes | Callback invoked after text is split, receives arrays of DOM elements |
| `options` | `SplitTextOptions` | No | Configuration options passed to `splitText` |

### SplitResult

The `onSplit` callback receives an object with three arrays:

```ts
interface SplitResult {
  chars: Element[];  // Individual character <span> elements
  words: Element[];  // Individual word <span> elements
  lines: Element[];  // Individual line <span> elements
}
```

### SplitTextOptions

Optional configuration for the underlying `splitText` function:

```ts
interface SplitTextOptions {
  charClass?: string;   // CSS class for character spans (default: "split-char")
  wordClass?: string;   // CSS class for word spans (default: "split-word")
  lineClass?: string;   // CSS class for line spans (default: "split-line")
  splitBy?: string;     // Custom delimiter (default: " " space)
}
```

## Examples

### Staggered Word Animation

```tsx
<SplitText
  onSplit={({ words }) => {
    animate(
      words,
      { opacity: [0, 1], y: [20, 0] },
      { type: "spring", duration: 1.5, bounce: 0.3, delay: stagger(0.05) }
    );
  }}
>
  <h1>Level up your animations</h1>
</SplitText>
```

### Character-by-Character Reveal

```tsx
<SplitText
  onSplit={({ chars }) => {
    animate(
      chars,
      { opacity: [0, 1], y: [30, 0], rotate: [-10, 0] },
      { type: "spring", duration: 0.8, bounce: 0.4, delay: stagger(0.02) }
    );
  }}
>
  <p>Motion makes animation simple.</p>
</SplitText>
```

### Line-by-Line with Scale

```tsx
<SplitText
  onSplit={({ lines }) => {
    animate(
      lines,
      { opacity: [0, 1], x: [-30, 0], scale: [0.95, 1] },
      { type: "spring", duration: 1.2, delay: stagger(0.15) }
    );
  }}
>
  <p>
    Create beautiful animations with just a few lines of code.
    Motion handles the complexity for you.
  </p>
</SplitText>
```

### Blur Effect on Words

```tsx
<SplitText
  onSplit={({ words }) => {
    animate(
      words,
      {
        opacity: [0, 1],
        y: [15, 0],
        filter: ["blur(8px)", "blur(0px)"],
      },
      { duration: 0.6, delay: stagger(0.04) }
    );
  }}
>
  <h2>Smooth, performant animations</h2>
</SplitText>
```

### Scroll-Driven Animation

```tsx
import { animate, scroll } from "motion";

<SplitText
  onSplit={({ words }) => {
    scroll(
      animate(words, { opacity: [0, 1], y: [20, 0] }),
      { target: containerRef.current }
    );
  }}
>
  <p>This text animates as you scroll</p>
</SplitText>
```

### Hover Effects on Characters

```tsx
import { animate, hover } from "motion";

<SplitText
  onSplit={({ chars }) => {
    // Initial animation
    animate(chars, { opacity: 1 }, { delay: stagger(0.02) });

    // Add hover to each character
    hover(chars, (el) => {
      animate(el, { scale: 1.3, color: "#ff0000" }, { type: "spring" });
      return () => animate(el, { scale: 1, color: "#ffffff" });
    });
  }}
>
  <span>Hover over me</span>
</SplitText>
```

### Custom CSS Classes

```tsx
<SplitText
  options={{
    charClass: "my-char",
    wordClass: "my-word",
    lineClass: "my-line",
  }}
  onSplit={({ words }) => {
    animate(words, { opacity: [0, 1] });
  }}
>
  <h1>Custom classes applied</h1>
</SplitText>
```

```css
.my-word {
  will-change: transform, opacity;
  display: inline-block;
}
```

## How It Works

### Component Architecture

```
┌─────────────────────────────────────────────────────────┐
│ SplitText Component                                     │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Container div (containerRef)                      │  │
│  │ - Starts with visibility: hidden                  │  │
│  │ - Prevents flash of unstyled content (FOUC)       │  │
│  │                                                   │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │ Cloned Child (childRefCallback)             │  │  │
│  │  │ - Original element with injected ref        │  │  │
│  │  │ - Text gets replaced with <span> elements   │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Execution Flow

1. **Render Phase**
   - Validate that `children` is a valid React element
   - Clone the child element using `cloneElement`, injecting a callback ref
   - Render the cloned child inside a hidden container

2. **Mount Phase**
   - React calls `childRefCallback` with the DOM node
   - `setChildElement(node)` stores the reference in state
   - This triggers the `useEffect`

3. **Effect Phase**
   - Wait for `document.fonts.ready` to ensure accurate text measurements
   - Call `splitText(childElement, options)` which:
     - Replaces text content with nested `<span>` elements
     - Returns arrays of `chars`, `words`, and `lines`
   - Set container to `visibility: visible`
   - Invoke `onSplit` callback with the split elements

4. **Animation Phase**
   - Your `onSplit` callback runs with DOM element arrays
   - You animate them however you want using Motion or any other library

### Why Callback Ref Instead of useRef?

React 19 introduced stricter ref handling. Passing a ref object via `cloneElement` is flagged as "reading ref during render" because React can't guarantee you won't access `.current`.

A callback ref is a function, so it's safe to pass through `cloneElement`. When the DOM node mounts, React calls the function with the node, and we store it in state.

```tsx
// ❌ React 19 error: "Cannot access refs during render"
const childRef = useRef(null);
cloneElement(children, { ref: childRef });

// ✅ Safe: callback ref stored in state
const [childElement, setChildElement] = useState(null);
const childRefCallback = useCallback((node) => setChildElement(node), []);
cloneElement(children, { ref: childRefCallback });
```

### Why Wait for Fonts?

`splitText` measures text dimensions to determine line breaks. If custom fonts haven't loaded yet:
- Text may be rendered with fallback fonts
- Measurements will be incorrect
- Lines may wrap differently after fonts load

`document.fonts.ready` returns a Promise that resolves when all fonts in the document are loaded and laid out.

## Styling Tips

### Prevent Layout Shift

Add `will-change` to split elements for smoother animations:

```css
.split-word,
.split-char {
  will-change: transform, opacity;
}
```

### Inline Display

Split elements are `<span>` tags, which are inline by default. For transforms to work properly, you may need:

```css
.split-word {
  display: inline-block;
}
```

### Preserve Whitespace

If words appear squished together, ensure whitespace is preserved:

```css
.split-word {
  white-space: pre;
}
```

## Caveats

1. **Single Child Only**: The component expects exactly one React element as children. Fragments or multiple children are not supported.

2. **Text Content Only**: The child element should contain text. Complex nested HTML may not split correctly.

3. **No SSR**: The component requires DOM access and should only run on the client (hence `"use client"`).

4. **One-Time Split**: Text is split once on mount. If the text content changes, you'll need to remount the component.

5. **Font Loading**: Ensure custom fonts are properly loaded. The component waits for `document.fonts.ready`, but fonts must be declared in CSS.

## TypeScript

The component is fully typed. Import types if needed:

```tsx
import { SplitText } from "./components/SplitText";

// Types are inferred from the component
<SplitText
  onSplit={({ chars, words, lines }) => {
    // chars: Element[]
    // words: Element[]
    // lines: Element[]
  }}
>
  <h1>Hello</h1>
</SplitText>
```
