# Fetta

Text splitting that keeps kerning intact.

Split text into characters, words, and lines while preserving the original typography. Works with any animation library.

## Features

- **Kerning Compensation** — Maintains original character spacing when splitting by chars
- **Nested Elements** — Preserves `<a>`, `<em>`, `<strong>` and other inline elements with all attributes
- **Line Detection** — Groups words into rendered lines
- **Dash Handling** — Allows text to wrap naturally after em-dashes, en-dashes, hyphens, and slashes
- **Auto Re-split** — Re-splits on container resize
- **Auto Revert** — Restores original HTML after animations
- **Masking** — Wrap elements in clip containers for reveal animations
- **Emoji Support** — Properly handles compound emojis and complex Unicode characters
- **Accessible** — Automatic screen reader support, even when splitting text with nested links or emphasis
- **TypeScript** — Full type definitions included
- **React Component** — Declarative wrapper for React projects
- **Viewport Triggers** — Scroll enter/leave callbacks with configurable thresholds in React
- **Library Agnostic** — Works with Motion, GSAP, CSS, or any animation library

## Installation

```bash
npm install fetta
```

**Bundle size** (minified + brotli)
- `fetta`: ~7.17 kB
- `fetta/react`: ~8.66 kB
- `fetta/motion`: ~15.93 kB
- `fetta/helpers`: ~765 B

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
| `onResplit` | `function` | — | Callback after autoSplit/full-resplit replaces split output elements |
| `onSplit` | `function` | — | Callback after initial split. Return animation/promise for `revertOnComplete` |
| `revertOnComplete` | `boolean` | `false` | Auto-revert when animation completes |
| `propIndex` | `boolean` | `false` | Add CSS custom properties: `--char-index`, `--word-index`, `--line-index` |
| `disableKerning` | `boolean` | `false` | Skip kerning compensation (no margin adjustments) |
| `initialStyles` | `object` | — | Apply initial inline styles to chars/words/lines after split. Values can be objects or `(el, index) => object` functions |
| `initialClasses` | `object` | — | Apply initial CSS classes to chars/words/lines. Values are strings |

#### Return Value

```ts
{
  chars: HTMLSpanElement[];   // Character elements
  words: HTMLSpanElement[];   // Word elements
  lines: HTMLSpanElement[];   // Line elements
  revert: () => void;         // Restore original HTML and cleanup
}
```

### `createSplitClones(splitResult, options)` (`fetta/helpers`)

Builds swap/reveal DOM layers (clones + optional wrappers) without coupling to any animation library.

```ts
import { splitText } from "fetta";
import { createSplitClones } from "fetta/helpers";

const split = splitText(element, { type: "chars", mask: "chars" });
const layers = createSplitClones(split, { unit: "chars", wrap: true });

// Animate with Motion, GSAP, WAAPI, or CSS
// ...

layers.cleanup(); // removes clones/wrappers, keeps split DOM
// layers.cleanup({ revertSplit: true }) // also calls split.revert()
```

#### Behavior

- Clone is always appended to the **current parent** of the original split node.
- `wrap: false` (default): clone is appended to existing parent (often the mask wrapper).
- `wrap: true`: original is first moved into a track wrapper, then clone is appended there.
- Helper never calls `splitText` and never performs animation.

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `unit` | `"chars" \| "words" \| "lines"` | — | Which split nodes to layer |
| `wrap` | `boolean` | `false` | Wrap each original in a track wrapper (`position: relative`) |
| `display` | `"auto" \| "inline-block" \| "block"` | `"auto"` | Track display when `wrap: true` (`lines` => `block`, others => `inline-block`) |
| `cloneOffset.axis` | `"x" \| "y"` | `"y"` | Axis used for initial clone offset |
| `cloneOffset.direction` | `"start" \| "end"` | `"start"` | Offset direction (`start` => negative) |
| `cloneOffset.distance` | `string` | `"100%"` | Offset distance |
| `trackClassName` / `cloneClassName` | `string \| (ctx) => string \| undefined` | — | Class names (static or per-item) |
| `trackStyle` / `cloneStyle` | `object \| (ctx) => object` | — | Inline styles (static or per-item) |

For reveal/swap effects, use matching `mask` in `splitText` (`"chars"`, `"words"`, or `"lines"`).

### `<SplitText>` (React)

```tsx
import { SplitText } from 'fetta/react';
```

`fetta/react` forwards common wrapper DOM props (`id`, `role`, `tabIndex`, `aria-*`, `data-*`, and event handlers like `onClick`) to the wrapper element.

`fetta/react` props:

#### React Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactElement` | — | Single React element to split |
| `as` | `keyof JSX.IntrinsicElements` | `"div"` | Wrapper element type |
| `className` | `string` | — | Class name for wrapper element |
| `style` | `CSSProperties` | — | Additional styles for wrapper element |
| `ref` | `Ref<HTMLElement>` | — | Ref to container element |
| `onSplit` | `(result) => CallbackReturn` | — | Called after text is split |
| `onResplit` | `(result) => void` | — | Called when autoSplit/full-resplit replaces split output elements |
| `options` | `SplitTextOptions` | — | Split options (type, classes, mask, propIndex, disableKerning) |
| `autoSplit` | `boolean` | `false` | Re-split on container resize |
| `waitForFonts` | `boolean` | `true` | Wait for `document.fonts.ready` before splitting (recommended for stable kerning). Set `false` for immediate split. |
| `revertOnComplete` | `boolean` | `false` | Revert after animation completes |
| `onRevert` | `() => void` | — | Called when split text is reverted (manual or automatic) |
| `viewport` | `ViewportOptions` | — | Configure viewport detection |
| `onViewportEnter` | `(result) => CallbackReturn` | — | Called when element enters viewport |
| `onViewportLeave` | `(result) => CallbackReturn` | — | Called when element leaves viewport |
| `initialStyles` | `object` | — | Apply initial inline styles to chars/words/lines. Values can be objects or `(el, index) => object` functions |
| `initialClasses` | `object` | — | Apply initial CSS classes to chars/words/lines. Values are strings |
| `resetOnViewportLeave` | `boolean` | `false` | Re-apply initialStyles/initialClasses when leaving viewport |

#### Shared `SplitTextOptions` (`options` prop)

| Option | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `SplitType` | `"chars,words,lines"` | What to split: `"chars"`, `"words"`, `"lines"`, or combinations |
| `charClass` | `string` | `"split-char"` | CSS class for character spans |
| `wordClass` | `string` | `"split-word"` | CSS class for word spans |
| `lineClass` | `string` | `"split-line"` | CSS class for line spans |
| `mask` | `"lines" \| "words" \| "chars"` | — | Wrap elements in `overflow: clip` mask containers |
| `propIndex` | `boolean` | `false` | Add CSS index variables (`--char-index`, `--word-index`, `--line-index`) |
| `disableKerning` | `boolean` | `false` | Skip kerning compensation (no margin adjustments) |

#### Callback Signature

All callbacks (`onSplit`, `onResplit`, `onViewportEnter`, `onViewportLeave`) receive:

```ts
{
  chars: HTMLSpanElement[];
  words: HTMLSpanElement[];
  lines: HTMLSpanElement[];
  revert: () => void;
}
```

```ts
type CallbackReturn =
  | void
  | Promise<unknown>
  | { finished: Promise<unknown> }
  | { then: (onFulfilled?: ((result: unknown) => unknown) | undefined) => unknown }
  | CallbackReturn[];
```

When using `autoSplit` with `lines` in scroll-linked or scroll-triggered animations, re-attach scroll/timeline logic inside `onResplit` so it binds to the new split element references.

`onRevert` is a separate zero-argument callback that fires when a split cycle actually reverts.

#### Viewport Options

```ts
{
  amount?: number | "some" | "all"; // Enter threshold, default: 0
  leave?: number | "some" | "all";  // Leave threshold, default: 0
  margin?: string;                  // Root margin, default: "0px"
  once?: boolean;                   // Only trigger once, default: false
  root?: RefObject<Element>;        // Optional root element
}
```

### `<SplitText>` (Motion)

```tsx
import { SplitText } from "fetta/motion";
```

`fetta/motion` includes all props from `fetta/react`, plus Motion variant props. It also forwards standard Motion/DOM wrapper props (`id`, `role`, `tabIndex`, `layout`, `drag`, `data-*`, etc.) to the wrapper.

Animate on exit with Motion's `AnimatePresence` (make `SplitText` the direct child):

```tsx
import { AnimatePresence } from "motion/react";

<AnimatePresence>
  {isVisible && (
    <SplitText
      variants={{
        enter: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 12 },
      }}
      initial="enter"
      animate="enter"
      exit="exit"
      options={{ type: "words" }}
    >
      <h1>Goodbye</h1>
    </SplitText>
  )}
</AnimatePresence>
```

#### Motion-only Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variants` | `Record<string, VariantDefinition<TCustom>>` | — | Named variant definitions |
| `initial` | `string \| VariantDefinition<TCustom> \| false` | — | Initial variant applied instantly after split |
| `animate` | `string \| VariantDefinition<TCustom>` | — | Base variant |
| `exit` | `string \| VariantDefinition<TCustom> \| false` | — | Exit variant (AnimatePresence) |
| `whileInView` | `string \| VariantDefinition<TCustom>` | — | Variant while element is in view |
| `whileOutOfView` | `string \| VariantDefinition<TCustom>` | — | Variant after element leaves view |
| `whileScroll` | `string \| VariantDefinition<TCustom>` | — | Scroll-driven variant (highest trigger priority) |
| `whileHover` | `string \| VariantDefinition<TCustom>` | — | Variant on hover |
| `whileTap` | `string \| VariantDefinition<TCustom>` | — | Variant on tap/press |
| `whileFocus` | `string \| VariantDefinition<TCustom>` | — | Variant on focus |
| `animateOnResplit` | `boolean` | `false` | Replay initial->animate on autoSplit/full-resplit |
| `scroll` | `{ offset?, axis?, container? }` | — | Scroll tracking options for `whileScroll` |
| `transition` | `AnimationOptions` | — | Global/default transition for variants |
| `custom` | `TCustom` | — | Custom data forwarded to function variants |
| `delayScope` | `"global" \| "local"` | `"global"` | Delay-function index scope (`globalIndex` vs relative `index`) |
| `reducedMotion` | `"user" \| "always" \| "never"` | — | Reduced-motion behavior for this component |
| `onHoverStart` | `() => void` | — | Called when hover starts |
| `onHoverEnd` | `() => void` | — | Called when hover ends |

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

#### Scroll-Triggered with Viewport

```tsx
<SplitText
  options={{ type: 'words' }}
  initialStyles={{
    words: { opacity: '0', transform: 'translateY(20px)' }
  }}
  viewport={{ amount: 0.5 }}
  onViewportEnter={({ words }) => {
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

### Motion (`fetta/motion`)

#### Basic Variants

```tsx
import { SplitText } from 'fetta/motion';
import { stagger } from 'motion';

<SplitText
  variants={{
    hidden: { opacity: 0, y: 20, filter: 'blur(6px)' },
    visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
  }}
  initial="hidden"
  animate="visible"
  transition={{ duration: 0.6, delay: stagger(0.04) }}
  options={{ type: 'words' }}
>
  <h1>Hello World</h1>
</SplitText>
```

#### Line-Aware Stagger

```tsx
import { SplitText } from 'fetta/motion';
import { stagger } from 'motion';

<SplitText
  delayScope="local"
  variants={{
    hidden: { chars: { opacity: 0 } },
    visible: {
      chars: ({ lineIndex }) => ({
        opacity: 1,
        transition: {
          duration: 0.3,
          delay: stagger(0.015, {
            startDelay: lineIndex * 0.2,
            from: lineIndex % 2 === 0 ? "first" : "last",
          }),
        },
      }),
    },
  }}
  initial="hidden"
  animate="visible"
  options={{ type: "chars,lines" }}
>
  <p>Line-aware per-character animation</p>
</SplitText>
```

#### Scroll-Driven Reveal

```tsx
import { SplitText } from 'fetta/motion';

<SplitText
  initialStyles={{ chars: { opacity: 0.2 } }}
  whileScroll={{
    chars: ({ globalIndex }) => ({
      opacity: 1,
      transition: {
        duration: 0.3,
        at: globalIndex * 0.025,
        ease: "linear",
      },
    }),
  }}
  scroll={{ offset: ["start 90%", "start 10%"] }}
  options={{ type: "chars" }}
>
  <p>Characters fade in with scroll progress</p>
</SplitText>
```

#### Hover Interaction

```tsx
import { SplitText } from 'fetta/motion';
import { stagger } from 'motion';

<SplitText
  variants={{
    rest: { chars: { opacity: 0.85, y: 0 } },
    hover: { chars: { opacity: 1, y: -6 } },
  }}
  initial="rest"
  animate="rest"
  whileHover="hover"
  transition={{ duration: 0.25, delay: stagger(0.01) }}
  options={{ type: 'chars' }}
>
  <p>Hover this text</p>
</SplitText>
```

## CSS Classes

Default classes applied to split elements:

| Class | Element | Notes |
|-------|---------|-------|
| `.split-char` | Characters | Inline positioning |
| `.split-word` | Words | Inline positioning |
| `.split-line` | Lines | Block display |

Split elements receive typed index attributes:
- Characters: `data-char-index`
- Words: `data-word-index`
- Lines: `data-line-index`

## Font Loading

For accurate kerning measurements, fonts must be fully loaded before splitting. When using custom fonts in vanilla JS, wait for `document.fonts.ready`:

```ts
document.fonts.ready.then(() => {
  const { words } = splitText(element);
  animate(words, { opacity: [0, 1] });
});
```

React and Motion components wait for fonts by default (`waitForFonts={true}`), which gives the most stable kerning.

If you notice a visual shift after splitting, keep the default waiting behavior enabled.

If you need immediate splitting (for example, responsiveness-first UI), you can opt out with `waitForFonts={false}`:

```tsx
<SplitText waitForFonts={false}>
  <h1>Split Immediately</h1>
</SplitText>
```

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
- **Authored hard breaks are preserved** — Explicit `<br>` and block-level descendants are treated as hard boundaries. In `chars`/`words` modes, hard boundaries are normalized to `<br>` in the split output.

## Browser Support

All modern browsers: Chrome, Firefox, Safari, Edge.

Requires:
- `ResizeObserver`
- `IntersectionObserver`
- `Intl.Segmenter`

**Safari note** — Kerning compensation works but may be slightly less accurate due to Safari's unique font rendering. Differences are typically imperceptible and vary by font, but if you're using `revert()` and notice a subtle shift in some characters, you can bypass compensation with `disableKerning: true`.

## License

MIT
