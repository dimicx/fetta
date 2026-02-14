# Fetta

Text splitting that keeps kerning intact.

Split text into chars, words, and lines while preserving original typography. `fetta` provides the framework-agnostic `splitText()` API for vanilla and imperative workflows, `fetta/react` is for React lifecycle and callback-based control, and `fetta/motion` is for Motion-first variants and triggers. `fetta/helpers` adds optional utilities for advanced layered effects.

Docs: https://fetta.dimi.me/

## Installation

```bash
npm install fetta
```

## Choose Your Entry Point

| Import | Use when | Size (min + brotli) |
|------|------|------|
| `fetta` | You want the framework-agnostic core API (`splitText`) | ~7.04 kB |
| `fetta/react` | You use React and want callback/lifecycle control | ~8.18 kB |
| `fetta/motion` | You use Motion variants and built-in triggers | ~13.71 kB |
| `fetta/helpers` | You need optional utilities for layered split effects | ~742 B |

## Features

- **Kerning Compensation** — Maintains original character spacing when splitting by chars
- **Nested Elements** — Preserves `<a>`, `<em>`, `<strong>` and other inline elements with all attributes
- **Line Detection** — Groups words into rendered lines
- **Dash Handling** — Allows text to wrap naturally after em-dashes, en-dashes, hyphens, and slashes
- **Auto Re-split** — Re-splits on container resize
- **Auto Revert** — Restores original HTML after animations
- **Masking** — Wrap elements in clip containers for reveal animations
- **Emoji Support** — Properly handles compound emojis and complex Unicode characters
- **Accessible** — Automatic screen reader support, even with nested links or emphasis
- **TypeScript** — Full type definitions included
- **Library Agnostic** — Works with Motion, GSAP, CSS, WAAPI, or custom animation code

## Quick Start

### Vanilla JavaScript (`fetta`)

```ts
import { splitText } from "fetta";
import { animate, stagger } from "motion";

const element = document.querySelector("h1");
const { chars } = splitText(element, { type: "chars" });

animate(chars, { opacity: [0, 1], y: [20, 0] }, { delay: stagger(0.02) });
```

### React Callbacks (`fetta/react`)

```tsx
import { SplitText } from "fetta/react";
import { animate, stagger } from "motion";

<SplitText
  options={{ type: "words" }}
  onSplit={({ words }) => {
    animate(words, { opacity: [0, 1], y: [20, 0] }, { delay: stagger(0.05) });
  }}
>
  <h1>Hello World</h1>
</SplitText>;
```

### Motion Variants (`fetta/motion`)

```tsx
import { SplitText } from "fetta/motion";
import { stagger } from "motion";

<SplitText
  variants={{
    hidden: { words: { opacity: 0, y: 20 } },
    visible: { words: { opacity: 1, y: 0 } },
  }}
  initial="hidden"
  animate="visible"
  transition={{ duration: 0.65, delay: stagger(0.04) }}
  options={{ type: "words" }}
>
  <h1>Hello World</h1>
</SplitText>;
```

`fetta/motion` supports standard Motion targets, per-type targets (`chars` / `words` / `lines` / `wrapper`), and split-aware function variants.

## API

### `splitText(element, options?)` (`fetta`)

Splits text content into characters, words, and/or lines.

```ts
import { splitText } from "fetta";

const result = splitText(element, options);
```

#### Options

| Option | Type | Default | Description |
|------|------|------|------|
| `type` | `SplitType` | `"chars,words,lines"` | What to split: `"chars"`, `"words"`, `"lines"`, or combinations |
| `charClass` | `string` | `"split-char"` | CSS class for character elements |
| `wordClass` | `string` | `"split-word"` | CSS class for word elements |
| `lineClass` | `string` | `"split-line"` | CSS class for line elements |
| `mask` | `"chars" \| "words" \| "lines"` | — | Wrap elements in `overflow: clip` container |
| `autoSplit` | `boolean` | `false` | Re-split on container resize |
| `onResplit` | `(result) => void` | — | Callback after autoSplit/full-resplit replaces split output elements |
| `onSplit` | `(result) => CallbackReturn` | — | Callback after initial split. Return animation/promise for `revertOnComplete` |
| `revertOnComplete` | `boolean` | `false` | Auto-revert when returned animation completes |
| `propIndex` | `boolean` | `false` | Add CSS custom properties: `--char-index`, `--word-index`, `--line-index` |
| `disableKerning` | `boolean` | `false` | Skip kerning compensation (no margin adjustments) |
| `initialStyles` | `object` | — | Apply initial inline styles to chars/words/lines after split. Values can be objects or `(el, index) => object` functions |
| `initialClasses` | `object` | — | Apply initial CSS classes to chars/words/lines. Values are strings |

```ts
type SplitType =
  | "chars"
  | "words"
  | "lines"
  | "chars,words"
  | "words,lines"
  | "chars,lines"
  | "chars,words,lines";
```

#### Return Value

```ts
interface SplitTextResult {
  chars: HTMLSpanElement[];
  words: HTMLSpanElement[];
  lines: HTMLSpanElement[];
  revert: () => void;
}
```

### `<SplitText>` (`fetta/react`)

```tsx
import { SplitText } from "fetta/react";
```

`fetta/react` wraps `splitText()` for React with lifecycle hooks, viewport callbacks, and automatic cleanup.

#### React Props

| Prop | Type | Default | Description |
|------|------|------|------|
| `children` | `ReactElement` | — | Single React element to split |
| `as` | `keyof JSX.IntrinsicElements` | `"div"` | Wrapper element type |
| `className` | `string` | — | Wrapper class name |
| `style` | `CSSProperties` | — | Wrapper styles |
| `ref` | `Ref<HTMLElement>` | — | Ref to wrapper element |
| `onSplit` | `(result) => CallbackReturn` | — | Called after initial split |
| `onResplit` | `(result) => void` | — | Called when autoSplit/full-resplit replaces split output elements |
| `options` | `SplitTextOptions` | — | Split options (`type`, classes, mask, etc.) |
| `autoSplit` | `boolean` | `false` | Re-split on container resize |
| `waitForFonts` | `boolean` | `true` | Wait for `document.fonts.ready` before splitting |
| `revertOnComplete` | `boolean` | `false` | Revert after animation completes |
| `onRevert` | `() => void` | — | Called when split text reverts |
| `viewport` | `ViewportOptions` | — | Configure viewport detection |
| `onViewportEnter` | `(result) => CallbackReturn` | — | Called when entering viewport |
| `onViewportLeave` | `(result) => CallbackReturn` | — | Called when leaving viewport |
| `initialStyles` | `object` | — | Apply initial inline styles to chars/words/lines |
| `initialClasses` | `object` | — | Apply initial CSS classes to chars/words/lines |
| `resetOnViewportLeave` | `boolean` | `false` | Re-apply initial styles/classes when leaving viewport |

All callbacks receive:

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

`fetta/react` and `fetta/motion` both forward common wrapper DOM props (`id`, `role`, `tabIndex`, `aria-*`, `data-*`, event handlers) to the wrapper.

### `<SplitText>` (`fetta/motion`)

```tsx
import { SplitText } from "fetta/motion";
```

Variant-driven component built on Motion. Includes every `fetta/react` prop plus Motion animation/triggers (`initial`, `animate`, `exit`, `whileInView`, `whileScroll`, `whileHover`, etc.).

#### Motion-only Props

| Prop | Type | Default | Description |
|------|------|------|------|
| `variants` | `Record<string, VariantDefinition<TCustom>>` | — | Named variant definitions |
| `initial` | `string \| VariantDefinition<TCustom> \| false` | — | Initial variant applied instantly after split |
| `animate` | `string \| VariantDefinition<TCustom>` | — | Base variant |
| `exit` | `string \| VariantDefinition<TCustom> \| false` | — | Exit variant (`AnimatePresence`) |
| `whileInView` | `string \| VariantDefinition<TCustom>` | — | Variant while element is in view |
| `whileOutOfView` | `string \| VariantDefinition<TCustom>` | — | Variant after element leaves view |
| `whileScroll` | `string \| VariantDefinition<TCustom>` | — | Scroll-driven variant (highest trigger priority) |
| `whileHover` | `string \| VariantDefinition<TCustom>` | — | Variant on hover |
| `whileTap` | `string \| VariantDefinition<TCustom>` | — | Variant on tap/press |
| `whileFocus` | `string \| VariantDefinition<TCustom>` | — | Variant on focus |
| `animateOnResplit` | `boolean` | `false` | Replay `initial -> animate` on autoSplit/full-resplit |
| `scroll` | `{ offset?, axis?, container? }` | — | Scroll tracking options for `whileScroll` |
| `transition` | `AnimationOptions` | — | Global/default transition for variants |
| `custom` | `TCustom` | — | Custom data forwarded to function variants |
| `delayScope` | `"global" \| "local"` | `"global"` | Delay-function index scope (`globalIndex` vs local `index`) |
| `reducedMotion` | `"user" \| "always" \| "never"` | `"never"` | Reduced-motion behavior for this component |
| `onHoverStart` | `() => void` | — | Called when hover starts |
| `onHoverEnd` | `() => void` | — | Called when hover ends |

Exit animations use standard Motion behavior (`SplitText` must be a direct child of `AnimatePresence`):

```tsx
import { AnimatePresence } from "motion/react";
import { SplitText } from "fetta/motion";

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
</AnimatePresence>;
```

### `createSplitClones(splitResult, options)` (`fetta/helpers`, optional)

Helpers are optional utilities for advanced layered reveal/swap effects.

```ts
import { splitText } from "fetta";
import { createSplitClones } from "fetta/helpers";

const split = splitText(element, { type: "chars", mask: "chars" });
const layers = createSplitClones(split, { unit: "chars", wrap: true });
```

#### Helper Options

| Option | Type | Default | Description |
|------|------|------|------|
| `unit` | `"chars" \| "words" \| "lines"` | — | Which split nodes to layer |
| `wrap` | `boolean` | `false` | Wrap each original in a track wrapper (`position: relative`) |
| `display` | `"auto" \| "inline-block" \| "block"` | `"auto"` | Track display when `wrap: true` (`lines` => `block`, others => `inline-block`) |
| `cloneOffset.axis` | `"x" \| "y"` | `"y"` | Axis used for initial clone offset |
| `cloneOffset.direction` | `"start" \| "end"` | `"start"` | Offset direction (`start` => negative) |
| `cloneOffset.distance` | `string` | `"100%"` | Offset distance |
| `trackClassName` / `cloneClassName` | `string \| (ctx) => string \| undefined` | — | Class names (static or per-item) |
| `trackStyle` / `cloneStyle` | `object \| (ctx) => object` | — | Inline styles (static or per-item) |

#### Helper Behavior

- Helper does not call `splitText()`; pass an existing split result.
- Clone is appended to the current parent of each original split node.
- `wrap: false` appends clone to existing parent.
- `wrap: true` moves original into a generated track, then appends clone there.
- `cleanup()` removes helper-created tracks/clones and is idempotent.
- `cleanup({ revertSplit: true })` also calls `split.revert()`.

For reveal/swap effects, match helper `unit` with `splitText` `mask` (`"chars"`, `"words"`, `"lines"`).

## CSS Classes

Default classes applied to split output:

| Class | Element |
|------|------|
| `.split-char` | Character span |
| `.split-word` | Word span |
| `.split-line` | Line span |

Split elements receive index attributes:

- `data-char-index`
- `data-word-index`
- `data-line-index`

## Font Loading

For stable kerning measurements in vanilla usage, wait for fonts before splitting:

```ts
document.fonts.ready.then(() => {
  const { words } = splitText(element);
  animate(words, { opacity: [0, 1] });
});
```

React and Motion components wait for fonts by default (`waitForFonts={true}`).

## Accessibility

Fetta keeps split text readable by screen readers:

- Headings/landmarks: split nodes are hidden from assistive tech and parent gets `aria-label`.
- Generic/nested content: visual split output is hidden and a screen-reader copy preserves semantics.
- Existing `aria-label` values are preserved.

## Notes

- Ligatures are disabled (`font-variant-ligatures: none`) because ligatures cannot span multiple elements.
- Authored hard breaks are preserved (`<br>` and block boundaries are kept as hard split boundaries).

## Browser Support

All modern browsers: Chrome, Firefox, Safari, Edge.

Requires:

- `ResizeObserver`
- `IntersectionObserver`
- `Intl.Segmenter`

Safari kerning compensation works, but font rendering precision can vary slightly by font. If you notice subtle shifts around `revert()`, use `disableKerning: true`.

## Docs

- https://fetta.dimi.me/
- https://fetta.dimi.me/installation
- https://fetta.dimi.me/api/core
- https://fetta.dimi.me/api/react
- https://fetta.dimi.me/api/motion
- https://fetta.dimi.me/api/helpers
- https://fetta.dimi.me/examples/vanilla
- https://fetta.dimi.me/examples/react
- https://fetta.dimi.me/examples/motion

## License

MIT
