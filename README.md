# Fetta

A text-splitting library with kerning compensation for smooth, natural text animations.

Split text into characters, words, and lines while preserving the original typography. Works with any animation library.

## Features

- **Kerning Compensation** — Measures character positions before splitting, then applies margin adjustments to maintain original spacing
- **Nested Elements** — Preserves inline HTML elements (`<a>`, `<em>`, `<strong>`, etc.) with all attributes intact
- **Line Detection** — Detects lines based on Y-position clustering, works with any container width
- **Dash Handling** — Allows text to wrap naturally after em-dashes, en-dashes, and hyphens
- **Auto Re-split** — Automatically re-splits on container resize with debouncing
- **Auto-Revert** — Restore original HTML after animations
- **Masking** — Wrap elements in clip containers for reveal animations
- **Emoji Support** — Properly handles compound emojis and complex Unicode characters
- **Accessible** — Automatic screen reader support, even when splitting text with nested links or emphasis
- **TypeScript** — Full type definitions included
- **React Component** — Declarative wrapper for React projects
- **Built-in InView** — Viewport detection for scroll-triggered animations in React
- **Library Agnostic** — Works with Motion, GSAP, or any animation library

## Installation

```bash
npm install fetta
```

## Quick Start

### Vanilla JavaScript

```js
import { splitText } from 'fetta';
import { animate, stagger } from 'motion';

const { chars, words, lines, revert } = splitText(
  document.querySelector('h1'),
  { type: 'chars,words,lines' }
);

animate(chars, { opacity: [0, 1], y: [20, 0] }, { delay: stagger(0.02) });
```

### React

```tsx
import { SplitText } from 'fetta/react';
import { animate, stagger } from 'motion';

function Hero() {
  return (
    <SplitText
      onSplit={({ words }) => {
        animate(words, { opacity: [0, 1], y: [20, 0] }, { delay: stagger(0.05) });
      }}
    >
      <h1>Hello World</h1>
    </SplitText>
  );
}
```

## API

### `splitText(element, options?)`

Splits text content into characters, words, and/or lines.

```ts
const result = splitText(element, options);
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `type` | `string` | `"chars,words,lines"` | What to split: `"chars"`, `"words"`, `"lines"`, or combinations |
| `charClass` | `string` | `"split-char"` | CSS class for character elements |
| `wordClass` | `string` | `"split-word"` | CSS class for word elements |
| `lineClass` | `string` | `"split-line"` | CSS class for line elements |
| `mask` | `"lines" \| "words" \| "chars"` | — | Wraps elements in `overflow: clip` container for reveal animations |
| `autoSplit` | `boolean` | `false` | Re-split on container resize |
| `onResize` | `function` | — | Callback after resize re-split |
| `onSplit` | `function` | — | Callback after initial split |
| `revertOnComplete` | `boolean` | `false` | Auto-revert when animation completes |
| `propIndex` | `boolean` | `false` | Add CSS custom properties: `--char-index`, `--word-index`, `--line-index` |
| `willChange` | `boolean` | `false` | Add `will-change: transform, opacity` for performance |

#### Return Value

```ts
{
  chars: HTMLSpanElement[];   // Character elements
  words: HTMLSpanElement[];   // Word elements
  lines: HTMLSpanElement[];   // Line elements
  revert: () => void;         // Restore original HTML and cleanup
}
```

### `<SplitText>` (React)

```tsx
import { SplitText } from 'fetta/react';
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactElement` | — | Single element to split |
| `onSplit` | `function` | — | Called after text is split |
| `onResize` | `function` | — | Called on autoSplit re-split |
| `options` | `object` | — | Split options (type, classes, mask, propIndex, willChange) |
| `autoSplit` | `boolean` | `false` | Re-split on container resize |
| `revertOnComplete` | `boolean` | `false` | Revert after animation completes |
| `inView` | `boolean \| InViewOptions` | `false` | Enable viewport detection |
| `onInView` | `function` | — | Called when element enters viewport |
| `onLeaveView` | `function` | — | Called when element leaves viewport |

#### InView Options

```ts
{
  amount?: number;   // How much must be visible (0-1), default: 0
  margin?: string;   // Root margin, default: "0px"
  once?: boolean;    // Only trigger once, default: false
}
```

## Examples

### Masked Line Reveal

```tsx
<SplitText
  options={{ type: 'lines', mask: 'lines' }}
  onSplit={({ lines }) => {
    animate(lines, { y: ['100%', 0] }, { delay: stagger(0.1) });
  }}
>
  <p>Each line reveals from below</p>
</SplitText>
```

### Scroll-Triggered Animation

```tsx
<SplitText
  onSplit={({ words }) => {
    words.forEach(w => (w.style.opacity = '0'));
  }}
  inView={{ amount: 0.5, once: true }}
  onInView={({ words }) => {
    animate(words, { opacity: 1, y: [20, 0] }, { delay: stagger(0.03) });
  }}
>
  <p>Animates when scrolled into view</p>
</SplitText>
```

### Auto-Revert After Animation

```tsx
<SplitText
  revertOnComplete
  onSplit={({ chars }) => {
    return animate(chars, { opacity: [0, 1] }, { delay: stagger(0.02) });
  }}
>
  <h1>Reverts to original HTML after animation</h1>
</SplitText>
```

### Responsive Re-split

```tsx
<SplitText
  autoSplit
  onSplit={({ lines }) => animateLines(lines)}
  onResize={({ lines }) => animateLines(lines)}
>
  <p>Re-animates when container resizes</p>
</SplitText>
```

### CSS-Only Animation with Index Props

```tsx
<SplitText options={{ type: 'chars', propIndex: true }}>
  <h1 className="stagger-fade">Hello</h1>
</SplitText>
```

```css
.stagger-fade .split-char {
  opacity: 0;
  animation: fade-in 0.5s forwards;
  animation-delay: calc(var(--char-index) * 0.03s);
}

@keyframes fade-in {
  to { opacity: 1; }
}
```

### With GSAP

```tsx
import { SplitText } from 'fetta/react';
import gsap from 'gsap';

<SplitText
  revertOnComplete
  onSplit={({ words }) => {
    return gsap.from(words, {
      opacity: 0,
      y: 20,
      stagger: 0.05,
      duration: 0.6,
    });
  }}
>
  <h1>Works with GSAP</h1>
</SplitText>
```

### Nested HTML Elements

Fetta preserves inline elements like links, emphasis, and other formatting. Attributes (href, class, id, data-*, etc.) are maintained.

```tsx
<SplitText
  onSplit={({ chars }) => {
    animate(chars, { opacity: [0, 1] }, { delay: stagger(0.02) });
  }}
>
  <p>Click <a href="/signup">here</a> to <em>get started</em></p>
</SplitText>
```

## CSS Classes

Default classes applied to split elements:

| Class | Element | Notes |
|-------|---------|-------|
| `.split-char` | Characters | Inline positioning |
| `.split-word` | Words | Inline positioning |
| `.split-line` | Lines | Block display |

Each element also receives a `data-index` attribute with its position.

## Notes

- **Fonts must be loaded** before splitting. The React component waits for `document.fonts.ready` automatically.
- **Ligatures are disabled** (`font-variant-ligatures: none`) because ligatures cannot span multiple elements.
- **Accessibility**: Automatic screen reader support for both simple text and text with nested elements like links.

## Browser Support

All modern browsers: Chrome, Firefox, Safari, Edge.

Requires:
- `ResizeObserver`
- `IntersectionObserver`
- `Intl.Segmenter`

### Safari

Kerning compensation is not available in Safari due to its Range API returning integer values instead of sub-pixel precision. Text splitting works normally, just without the margin adjustments.

When using `revertOnComplete` with character splitting in Safari, font kerning is automatically disabled to prevent visual shift on revert.

## License

MIT
