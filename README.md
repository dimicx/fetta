# Fetta

A text-splitting library with kerning compensation for smooth, natural text animations.

Split text into characters, words, and lines while preserving the original typography. Works with any animation library.

## Features

- **Kerning Compensation** — Maintains original character spacing when splitting by chars
- **Nested Elements** — Preserves `<a>`, `<em>`, `<strong>` and other inline elements with all attributes
- **Line Detection** — Automatically groups words into lines
- **Dash Handling** — Allows text to wrap naturally after em-dashes, en-dashes, hyphens, and slashes
- **Auto Re-split** — Re-splits on container resize
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

**Bundle size**: ~3.9 kB (`fetta/core`) / ~4.8 kB (`fetta/react`) — minified + compressed

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
| `mask` | `string` | — | Wrap elements in `overflow: clip` container: `"chars"`, `"words"`, or `"lines"` |
| `autoSplit` | `boolean` | `false` | Re-split on container resize |
| `onResize` | `function` | — | Callback after resize re-split |
| `onSplit` | `function` | — | Callback after initial split |
| `revertOnComplete` | `boolean` | `false` | Auto-revert when animation completes |
| `propIndex` | `boolean` | `false` | Add CSS custom properties: `--char-index`, `--word-index`, `--line-index` |
| `disableKerning` | `boolean` | `false` | Skip kerning compensation (no margin adjustments) |
| `initialStyles` | `object` | — | Apply initial inline styles to chars/words/lines after split. Values can be objects or `(el, index) => object` functions |
| `initialClasses` | `object` | — | Apply initial CSS classes to chars/words/lines after split. Values can be strings or `(el, index) => string` functions |

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
| `children` | `ReactElement` | — | Single React element to split |
| `as` | `keyof JSX.IntrinsicElements` | `"div"` | Wrapper element type |
| `className` | `string` | — | Class name for wrapper element |
| `style` | `CSSProperties` | — | Additional styles for wrapper element |
| `ref` | `Ref<HTMLElement>` | — | Ref to container element |
| `onSplit` | `(result) => void` | — | Called after text is split |
| `onResize` | `(result) => void` | — | Called on autoSplit re-split |
| `options` | `SplitOptions` | — | Split options (type, classes, mask, propIndex, disableKerning) |
| `autoSplit` | `boolean` | `false` | Re-split on container resize |
| `revertOnComplete` | `boolean` | `false` | Revert after animation completes |
| `inView` | `boolean \| InViewOptions` | `false` | Enable viewport detection |
| `onInView` | `(result) => void` | — | Called when element enters viewport |
| `onLeaveView` | `(result) => void` | — | Called when element leaves viewport |
| `initialStyles` | `object` | — | Apply initial inline styles to chars/words/lines. Values can be objects or `(el, index) => object` functions |
| `initialClasses` | `object` | — | Apply initial CSS classes to chars/words/lines. Values can be strings or `(el, index) => string` functions |
| `resetOnViewportLeave` | `boolean` | `false` | Re-apply initialStyles/initialClasses when leaving viewport |

#### Callback Signature

All callbacks (`onSplit`, `onResize`, `onInView`, `onLeaveView`) receive the same result object:

```ts
{
  chars: HTMLSpanElement[];
  words: HTMLSpanElement[];
  lines: HTMLSpanElement[];
  revert: () => void;
}
```

#### InView Options

```ts
{
  amount?: number;   // How much must be visible (0-1), default: 0
  margin?: string;   // Root margin, default: "0px"
  once?: boolean;    // Only trigger once, default: false
}
```

## Examples

### Vanilla JavaScript

#### Basic

```js
import { splitText } from 'fetta';
import { animate, stagger } from 'motion';

const { words } = splitText(document.querySelector('h1'));

animate(words, { opacity: [0, 1], y: [20, 0] }, { delay: stagger(0.05) });
```

#### Masked Line Reveal

```js
splitText(element, {
  type: 'lines',
  mask: 'lines',
  onSplit: ({ lines }) => {
    animate(lines, { y: ['100%', '0%'] }, { delay: stagger(0.1) });
  }
});
```

#### With GSAP

```js
import { splitText } from 'fetta';
import gsap from 'gsap';

splitText(element, {
  revertOnComplete: true,
  onSplit: ({ words }) => {
    return gsap.from(words, {
      opacity: 0,
      y: 20,
      stagger: 0.05,
      duration: 0.6,
    });
  }
});
```

#### CSS-Only with Index Props

```js
splitText(element, { type: 'chars', propIndex: true });
```

```css
.split-char {
  opacity: 0;
  animation: fade-in 0.5s forwards;
  animation-delay: calc(var(--char-index) * 0.03s);
}

@keyframes fade-in {
  to { opacity: 1; }
}
```

### React

#### Basic

```tsx
<SplitText
  onSplit={({ words }) => {
    animate(words, { opacity: [0, 1], y: [20, 0] }, { delay: stagger(0.05) });
  }}
>
  <h1>Hello World</h1>
</SplitText>
```

#### Masked Line Reveal

```tsx
<SplitText
  options={{ type: 'lines', mask: 'lines' }}
  onSplit={({ lines }) => {
    animate(lines, { y: ['100%', '0%'] }, { delay: stagger(0.1) });
  }}
>
  <p>Each line reveals from below</p>
</SplitText>
```

#### Scroll-Triggered with InView

```tsx
<SplitText
  options={{ type: 'words' }}
  initialStyles={{
    words: { opacity: '0', transform: 'translateY(20px)' }
  }}
  inView={{ amount: 0.5 }}
  onInView={({ words }) => {
    animate(words, { opacity: 1, y: 0 }, { delay: stagger(0.03) });
  }}
  resetOnViewportLeave
>
  <p>Animates when scrolled into view</p>
</SplitText>
```

#### Auto-Revert After Animation

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

## CSS Classes

Default classes applied to split elements:

| Class | Element | Notes |
|-------|---------|-------|
| `.split-char` | Characters | Inline positioning |
| `.split-word` | Words | Inline positioning |
| `.split-line` | Lines | Block display |

Each element also receives a `data-index` attribute with its position.

## Font Loading

For accurate kerning measurements, fonts must be fully loaded before splitting. When using custom fonts in vanilla JS, wait for `document.fonts.ready`:

```ts
document.fonts.ready.then(() => {
  const { words } = splitText(element);
  animate(words, { opacity: [0, 1] });
});
```

The React component handles this automatically — no additional setup required.

## Accessibility

Fetta automatically handles accessibility to ensure split text remains readable by screen readers.

**Headings and landmarks** — For elements that support `aria-label` natively (headings, `<section>`, `<nav>`, etc.), Fetta adds `aria-hidden="true"` to each split span and an `aria-label` on the parent:

```html
<!-- After splitting <h1>Hello World</h1> -->
<h1 aria-label="Hello World">
  <span class="split-word" aria-hidden="true">Hello</span>
  <span class="split-word" aria-hidden="true">World</span>
</h1>
```

**Generic elements and nested content** — For `<span>`, `<div>`, `<p>`, or text containing inline elements like links, Fetta wraps the visual content with `aria-hidden="true"` and adds a screen-reader-only copy that preserves the semantic structure:

```html
<!-- After splitting <p>Click <a href="/signup">here</a> to start</p> -->
<p>
  <span aria-hidden="true" data-fetta-visual="true">
    <!-- Split visual content -->
  </span>
  <span class="fetta-sr-only" data-fetta-sr-copy="true">
    Click <a href="/signup">here</a> to start
  </span>
</p>
```

Pre-existing `aria-label` attributes are always preserved.

## Notes

- **Ligatures are disabled** (`font-variant-ligatures: none`) because ligatures cannot span multiple elements.

## Browser Support

All modern browsers: Chrome, Firefox, Safari, Edge.

Requires:
- `ResizeObserver`
- `IntersectionObserver`
- `Intl.Segmenter`

**Safari note** — Kerning compensation works but may be slightly less accurate due to Safari's unique font rendering. Differences are typically imperceptible and vary by font, but if you're using `revert()` and notice a subtle shift in some characters, you can bypass compensation with `disableKerning: true`.

## License

MIT
