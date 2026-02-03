import { splitText, normalizeToPromise } from "../core/splitText";
import { animate, hover, scroll } from "motion";
import { usePresence } from "motion/react";
import type { AnimationOptions, DOMKeyframesDefinition } from "motion";
import {
  createElement,
  forwardRef,
  isValidElement,
  ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

/** Style value for initialStyles - a partial style object */
type InitialStyleValue = Partial<CSSStyleDeclaration>;

/** Function that returns styles based on element and index */
type InitialStyleFn = (element: HTMLElement, index: number) => InitialStyleValue;

/** Initial style can be a static object or a function */
type InitialStyle = InitialStyleValue | InitialStyleFn;

/** Initial styles configuration for chars, words, and/or lines */
interface InitialStyles {
  chars?: InitialStyle;
  words?: InitialStyle;
  lines?: InitialStyle;
}

/** Initial classes configuration for chars, words, and/or lines */
interface InitialClasses {
  chars?: string;
  words?: string;
  lines?: string;
}

/**
 * Re-apply initial styles to elements.
 */
function reapplyInitialStyles(
  elements: HTMLElement[],
  style: InitialStyle | undefined
): void {
  if (!style || elements.length === 0) return;

  const isFn = typeof style === "function";

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const styles = isFn ? style(el, i) : style;

    for (const [key, value] of Object.entries(styles)) {
      if (value == null) continue;
      if (key === "cssText") {
        if (typeof value === "string") {
          el.style.cssText = value;
        }
        continue;
      }
      if (typeof value !== "string" && typeof value !== "number") continue;
      const cssValue = typeof value === "number" ? String(value) : value;
      const cssKey = key.startsWith("--")
        ? key
        : key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      el.style.setProperty(cssKey, cssValue);
    }
  }
}

/**
 * Re-apply initial classes to elements.
 */
function reapplyInitialClasses(
  elements: HTMLElement[],
  className: string | undefined
): void {
  if (!className || elements.length === 0) return;
  const classes = className.split(/\s+/).filter(Boolean);
  for (const el of elements) {
    el.classList.add(...classes);
  }
}

interface SplitTextOptions {
  type?:
    | "chars"
    | "words"
    | "lines"
    | "chars,words"
    | "words,lines"
    | "chars,lines"
    | "chars,words,lines";
  charClass?: string;
  wordClass?: string;
  lineClass?: string;
  /** Apply overflow mask wrapper to elements for reveal animations */
  mask?: "lines" | "words" | "chars";
  propIndex?: boolean;
  /** Skip kerning compensation (no margin adjustments applied).
   * Kerning is naturally lost when splitting into inline-block spans.
   * Use this if you prefer no compensation over imperfect Safari compensation. */
  disableKerning?: boolean;
}

interface ScrollPropOptions {
  /** Scroll offsets. Default: Motion's default ["start end", "end start"] */
  offset?: MotionScrollOffset;
  /** Scroll axis. Default: "y" */
  axis?: "x" | "y";
  /** Custom scroll container ref. Default: nearest scrollable ancestor / window */
  container?: React.RefObject<Element | null>;
}

/** Matches Motion's viewport prop */
interface ViewportOptions {
  /** Only trigger once. Default: false */
  once?: boolean;
  /** How much of the element must be visible. Motion supports "some" | "all" | number. Default: 0 */
  amount?: number | "some" | "all";
  /** Root margin for IntersectionObserver. Default: "0px" */
  margin?: string;
  /** Root element for IntersectionObserver */
  root?: React.RefObject<Element>;
}

/**
 * Result passed to SplitText callbacks (onSplit, onViewportEnter, onViewportLeave, onResize).
 *
 * Contains arrays of split elements and a revert function for manual control.
 * Empty arrays are returned for split types not requested in options.
 */
export interface SplitTextElements {
  /** Array of character span elements */
  chars: HTMLSpanElement[];
  /** Array of word span elements */
  words: HTMLSpanElement[];
  /** Array of line span elements */
  lines: HTMLSpanElement[];
  /** Revert to original HTML and cleanup observers */
  revert: () => void;
}

/** Return type for callbacks - void, single animation, array of animations, or promise */
type CallbackReturn =
  | void
  | { finished: Promise<unknown> }
  | Array<{ finished: Promise<unknown> }>
  | Promise<unknown>;

// ---------------------------------------------------------------------------
// Variant types
// ---------------------------------------------------------------------------

/** Motion-compatible animation target (passed directly to motion.animate) */
type VariantTarget = DOMKeyframesDefinition & {
  transition?: AnimationOptions;
};

/** Info passed to function variant callbacks */
export interface VariantInfo {
  /** Relative index within nearest split parent (line > word > global) */
  index: number;
  /** Total elements in that parent group */
  count: number;
  /** Absolute index across all elements of this type */
  globalIndex: number;
  /** Total elements of this type across the entire split */
  globalCount: number;
  /** Parent line index (0 if lines not split) */
  lineIndex: number;
  /** Parent word index (0 if words not split) */
  wordIndex: number;
  /** AnimatePresence presence state */
  isPresent: boolean;
}

type VariantResolver = (info: VariantInfo) => VariantTarget;
type PerTypeVariant = VariantTarget | VariantResolver;

/** A variant: flat target, flat function, per-type targets (static or function), with optional transition */
type VariantDefinition =
  | VariantTarget
  | VariantResolver
  | {
      chars?: PerTypeVariant;
      words?: PerTypeVariant;
      lines?: PerTypeVariant;
      transition?: AnimationOptions;
    };

// ---------------------------------------------------------------------------
// Motion API (static import)
// ---------------------------------------------------------------------------

interface MotionApi {
  animate: typeof animate;
  hover: typeof hover;
  scroll: typeof scroll;
}
const motionApi: MotionApi = { animate, hover, scroll };

type MotionAnimation = ReturnType<typeof animate>;
type MotionScrollOptions = NonNullable<Parameters<typeof scroll>[1]>;
type MotionScrollOffset = MotionScrollOptions["offset"];

// ---------------------------------------------------------------------------
// Variant helpers
// ---------------------------------------------------------------------------

const ELEMENT_TYPE_KEYS: Array<"chars" | "words" | "lines"> = [
  "chars",
  "words",
  "lines",
];

/** Detect per-type vs flat variant */
type PerTypeVariants = Partial<
  Record<"chars" | "words" | "lines", PerTypeVariant>
> & {
  transition?: AnimationOptions;
};

function isPerTypeVariant(v: VariantDefinition): v is PerTypeVariants {
  if (typeof v !== "object" || v === null) return false;
  return "chars" in v || "words" in v || "lines" in v;
}

/** Get most granular element type for flat variants */
function getTargetElements(
  result: SplitTextElements,
  type?: string
): HTMLSpanElement[] {
  if (type?.includes("chars") && result.chars.length) return result.chars;
  if (type?.includes("words") && result.words.length) return result.words;
  if (type?.includes("lines") && result.lines.length) return result.lines;
  return result.words;
}

/** Get most granular element type name for flat variants */
function getTargetType(result: SplitTextElements, type?: string): "chars" | "words" | "lines" {
  if (type?.includes("chars") && result.chars.length) return "chars";
  if (type?.includes("words") && result.words.length) return "words";
  if (type?.includes("lines") && result.lines.length) return "lines";
  return "words";
}

/** Separate transition from animation props in a variant definition */
function extractTransition(
  variant: VariantTarget
): { props: DOMKeyframesDefinition; transition?: AnimationOptions } {
  const { transition, ...props } = variant;
  return { props, transition };
}

// ---------------------------------------------------------------------------
// Index maps for function variants
// ---------------------------------------------------------------------------

interface IndexMaps {
  charToWord: number[];
  charToLine: number[];
  wordToLine: number[];
  /** Relative index + group count per element, keyed by parent */
  charInWord: number[];
  charCountInWord: number[];
  charInLine: number[];
  charCountInLine: number[];
  wordInLine: number[];
  wordCountInLine: number[];
}

function buildIndexMaps(result: SplitTextElements): IndexMaps {
  const charToWord: number[] = [];
  const charToLine: number[] = [];
  const wordToLine: number[] = [];

  // char → word
  if (result.chars.length && result.words.length) {
    let wi = 0;
    for (let ci = 0; ci < result.chars.length; ci++) {
      while (wi < result.words.length - 1 && !result.words[wi].contains(result.chars[ci])) wi++;
      charToWord[ci] = wi;
    }
  }

  // word → line
  if (result.words.length && result.lines.length) {
    let li = 0;
    for (let wi = 0; wi < result.words.length; wi++) {
      while (li < result.lines.length - 1 && !result.lines[li].contains(result.words[wi])) li++;
      wordToLine[wi] = li;
    }
  }

  // char → line (derive from char→word→line, or direct if no words)
  if (result.chars.length && result.lines.length) {
    if (charToWord.length && wordToLine.length) {
      for (let ci = 0; ci < result.chars.length; ci++) charToLine[ci] = wordToLine[charToWord[ci]];
    } else {
      let li = 0;
      for (let ci = 0; ci < result.chars.length; ci++) {
        while (li < result.lines.length - 1 && !result.lines[li].contains(result.chars[ci])) li++;
        charToLine[ci] = li;
      }
    }
  }

  // Relative indices + group counts
  const charInWord: number[] = [];
  const charCountInWord: number[] = [];
  const charInLine: number[] = [];
  const charCountInLine: number[] = [];
  const wordInLine: number[] = [];
  const wordCountInLine: number[] = [];

  if (charToWord.length) {
    let prev = -1, counter = 0;
    for (let ci = 0; ci < charToWord.length; ci++) {
      if (charToWord[ci] !== prev) { counter = 0; prev = charToWord[ci]; }
      charInWord[ci] = counter++;
    }
    const countByGroup: number[] = [];
    for (let ci = charInWord.length - 1; ci >= 0; ci--) {
      if (ci === charInWord.length - 1 || charToWord[ci] !== charToWord[ci + 1]) {
        countByGroup[charToWord[ci]] = charInWord[ci] + 1;
      }
    }
    for (let ci = 0; ci < charToWord.length; ci++) {
      charCountInWord[ci] = countByGroup[charToWord[ci]];
    }
  }

  if (charToLine.length) {
    // Relative indices
    let prev = -1, counter = 0;
    for (let ci = 0; ci < charToLine.length; ci++) {
      if (charToLine[ci] !== prev) { counter = 0; prev = charToLine[ci]; }
      charInLine[ci] = counter++;
    }
    // Group counts (backwards pass to find last index per group, then fill)
    const countByGroup: number[] = [];
    for (let ci = charInLine.length - 1; ci >= 0; ci--) {
      if (ci === charInLine.length - 1 || charToLine[ci] !== charToLine[ci + 1]) {
        countByGroup[charToLine[ci]] = charInLine[ci] + 1;
      }
    }
    for (let ci = 0; ci < charToLine.length; ci++) {
      charCountInLine[ci] = countByGroup[charToLine[ci]];
    }
  }

  if (wordToLine.length) {
    let prev = -1, counter = 0;
    for (let wi = 0; wi < wordToLine.length; wi++) {
      if (wordToLine[wi] !== prev) { counter = 0; prev = wordToLine[wi]; }
      wordInLine[wi] = counter++;
    }
    const countByGroup: number[] = [];
    for (let wi = wordInLine.length - 1; wi >= 0; wi--) {
      if (wi === wordInLine.length - 1 || wordToLine[wi] !== wordToLine[wi + 1]) {
        countByGroup[wordToLine[wi]] = wordInLine[wi] + 1;
      }
    }
    for (let wi = 0; wi < wordToLine.length; wi++) {
      wordCountInLine[wi] = countByGroup[wordToLine[wi]];
    }
  }

  return { charToWord, charToLine, wordToLine, charInWord, charCountInWord, charInLine, charCountInLine, wordInLine, wordCountInLine };
}

const indexMapsCache = new WeakMap<SplitTextElements, IndexMaps>();

function getIndexMaps(result: SplitTextElements): IndexMaps {
  const cached = indexMapsCache.get(result);
  if (cached) return cached;
  const maps = buildIndexMaps(result);
  indexMapsCache.set(result, maps);
  return maps;
}

function buildFnInfo(
  elementType: "chars" | "words" | "lines",
  globalIndex: number,
  total: number,
  maps: IndexMaps,
  isPresent: boolean
): VariantInfo {
  if (elementType === "chars") {
    const lineIndex = maps.charToLine.length ? maps.charToLine[globalIndex] : 0;
    const wordIndex = maps.charToWord.length ? maps.charToWord[globalIndex] : 0;
    // Relative to highest parent: line > word > global
    const index = maps.charInLine.length ? maps.charInLine[globalIndex]
      : maps.charInWord.length ? maps.charInWord[globalIndex]
      : globalIndex;
    const count = maps.charCountInLine.length ? maps.charCountInLine[globalIndex]
      : maps.charCountInWord.length ? maps.charCountInWord[globalIndex]
      : total;
    return { index, count, globalIndex, globalCount: total, lineIndex, wordIndex, isPresent };
  }
  if (elementType === "words") {
    const lineIndex = maps.wordToLine.length ? maps.wordToLine[globalIndex] : 0;
    const index = maps.wordInLine.length ? maps.wordInLine[globalIndex] : globalIndex;
    const count = maps.wordCountInLine.length ? maps.wordCountInLine[globalIndex] : total;
    return { index, count, globalIndex, globalCount: total, lineIndex, wordIndex: globalIndex, isPresent };
  }
  return { index: globalIndex, count: total, globalIndex, globalCount: total, lineIndex: globalIndex, wordIndex: 0, isPresent };
}

type FnAnimationItem = {
  element: HTMLSpanElement;
  props: DOMKeyframesDefinition;
  transition?: AnimationOptions;
};

/**
 * Build per-element animation items for function variants.
 * Each element gets resolved props and transition (delay can be a stagger fn).
 */
function buildFnItems(
  elements: HTMLSpanElement[],
  elementType: "chars" | "words" | "lines",
  fn: VariantResolver,
  maps: IndexMaps,
  transition: AnimationOptions | undefined,
  isPresent: boolean
): FnAnimationItem[] {
  const t = transition;
  const { delay: outerDelay, duration, ...rest } = t || {};
  const items: FnAnimationItem[] = [];
  const total = elements.length;

  for (let i = 0; i < total; i++) {
    const info = buildFnInfo(elementType, i, total, maps, isPresent);
    const { transition: localT, ...props } = fn(info);
    // Merge: per-element transition from fn return overrides outer transition
    let merged: AnimationOptions = localT ? { ...rest, ...localT } : { ...rest };
    if (duration != null && merged.duration == null) {
      merged = { ...merged, duration };
    }

    // Resolve delay — may be a stagger function from motion
    const rawDelay = merged.delay ?? outerDelay;
    const resolvedDelay =
      typeof rawDelay === "function"
        ? rawDelay(info.index, info.count)
        : rawDelay;

    if (resolvedDelay != null) {
      merged = { ...merged, delay: resolvedDelay };
    } else if ("delay" in merged) {
      const { delay: _removed, ...restNoDelay } = merged;
      merged = restNoDelay;
    }

    items.push({
      element: elements[i],
      props,
      transition: Object.keys(merged).length ? merged : undefined,
    });
  }

  return items;
}

function animateVariant(
  motion: MotionApi,
  result: SplitTextElements,
  variant: VariantDefinition,
  globalTransition: AnimationOptions | undefined,
  type?: string,
  isPresent = true
): MotionAnimation[] {
  // Case 1: Flat function variant
  if (typeof variant === "function") {
    const targetType = getTargetType(result, type);
    const elements = result[targetType];
    if (!elements.length) return [];
    const maps = getIndexMaps(result);
    const items = buildFnItems(elements, targetType, variant, maps, globalTransition, isPresent);
    return items.map((item) =>
      motion.animate(item.element, item.props, item.transition)
    );
  }

  // Case 2 & 3: Per-type variant (may contain function values)
  if (isPerTypeVariant(variant)) {
    const hasFnKey = ELEMENT_TYPE_KEYS.some(
      (k) => typeof variant[k] === "function"
    );

    if (hasFnKey) {
      // Build index maps once for all function keys
      const maps = getIndexMaps(result);
      const staticAnimations: MotionAnimation[] = [];
      const fnAnimations: MotionAnimation[] = [];

      for (const key of ELEMENT_TYPE_KEYS) {
        const target = variant[key];
        if (!target || !result[key].length) continue;

        if (typeof target === "function") {
          const localTransition = variant.transition || globalTransition;
          const items = buildFnItems(
            result[key],
            key,
            target,
            maps,
            localTransition,
            isPresent
          );
          fnAnimations.push(
            ...items.map((item) =>
              motion.animate(item.element, item.props, item.transition)
            )
          );
        } else {
          // Static per-type target — use existing path
          const { props, transition: localT } = extractTransition(target);
          const t = localT || globalTransition;
          staticAnimations.push(motion.animate(result[key], props, t));
        }
      }

      return [...staticAnimations, ...fnAnimations];
    }

    // Case 3: All static per-type — unchanged
    const animations: MotionAnimation[] = [];
    for (const key of ELEMENT_TYPE_KEYS) {
      const target = variant[key];
      if (!target || !result[key].length || typeof target === "function") continue;
      const { props, transition: localT } = extractTransition(target);
      const t = localT || globalTransition;
      animations.push(motion.animate(result[key], props, t));
    }
    return animations;
  }

  // Case 4: Flat static variant — unchanged
  const { props, transition: localT } = extractTransition(variant);
  const elements = getTargetElements(result, type);
  const t = localT || globalTransition;
  return [motion.animate(elements, props, t)];
}

/** Wait for all animation controls to finish */
function allFinished(animations: MotionAnimation[]): Promise<unknown[]> {
  return Promise.all(animations.map((a) => a.finished));
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SplitTextProps {
  children: ReactElement;
  /** The wrapper element type. Default: "div" */
  as?: keyof HTMLElementTagNameMap;
  /** Class name for the wrapper element */
  className?: string;
  /** Additional styles for the wrapper element (merged with internal styles) */
  style?: React.CSSProperties;
  /**
   * Called after text is split.
   * Return an animation or promise to enable revert (requires revertOnComplete).
   * Still fires in variant mode for side effects.
   */
  onSplit?: (result: SplitTextElements) => CallbackReturn;
  /** Called when autoSplit triggers a re-split on resize */
  onResize?: (result: SplitTextElements) => void;
  options?: SplitTextOptions;
  autoSplit?: boolean;
  /** When true, reverts to original HTML after animation promise resolves */
  revertOnComplete?: boolean;
  /** Viewport observer options (replaces `inView`). Configures IntersectionObserver. */
  viewport?: ViewportOptions;
  /** Called when element enters viewport (replaces `onInView`). Return animation for revertOnComplete support */
  onViewportEnter?: (result: SplitTextElements) => CallbackReturn;
  /** Called when element leaves viewport (replaces `onLeaveView`) */
  onViewportLeave?: (result: SplitTextElements) => CallbackReturn;
  /** Apply initial inline styles to elements after split (and after kerning compensation).
   * Can be a static style object or a function that receives (element, index). */
  initialStyles?: InitialStyles;
  /** Apply initial classes to elements after split (and after kerning compensation).
   * Classes are added via classList.add() and support space-separated class names. */
  initialClasses?: InitialClasses;
  /** Re-apply initialStyles/initialClasses (callback mode) or initial variant (variant mode) when element leaves viewport.
   * Useful for scroll-triggered animations that should reset when scrolling away. */
  resetOnViewportLeave?: boolean;

  // --- Variant props ---

  /** Named variant definitions. Keys are variant names, values are animation targets. */
  variants?: Record<string, VariantDefinition>;
  /** Initial variant applied instantly (duration: 0) after split. Set to false to skip. */
  initial?: string | false;
  /** Variant to animate to immediately after split */
  animate?: string;
  /** Variant to animate to when entering viewport */
  whileInView?: string;
  /** Variant to animate to on exit when used inside AnimatePresence.
   *  Accepts a variant name or a full variant definition. */
  exit?: string | VariantDefinition | false;
  /** Variant to scroll-animate to. Animation progress is driven by scroll position.
   *  Takes priority over `animate` and `whileInView`. */
  whileScroll?: string;
  /** Scroll options for whileScroll. Configures target tracking and scroll range. */
  scroll?: ScrollPropOptions;
  /** Variant to animate to on hover */
  whileHover?: string;
  /** Called when hover starts */
  onHoverStart?: () => void;
  /** Called when hover ends */
  onHoverEnd?: () => void;
  /** Global transition options for variant animations.
   *  Precedence: per-element fn return > per-variant transition > this global transition. */
  transition?: AnimationOptions;
}

/**
 * React component wrapper for text splitting with kerning compensation.
 *
 * Wraps a single child element and splits its text content into characters,
 * words, and/or lines. Handles lifecycle cleanup automatically on unmount.
 *
 * Supports two modes:
 * - **Callback mode**: Use `onSplit`, `onViewportEnter`, `onViewportLeave` for imperative animation control
 * - **Variant mode**: Use `variants`, `initial`, `animate`, `whileInView`, `whileHover`, `exit` for declarative animations powered by Motion
 *
 * @param props - Component props including callbacks and options
 * @returns The child element wrapped in a container div
 *
 * @example
 * ```tsx
 * import { SplitText } from "fetta/react-motion";
 * import { animate, stagger } from "motion";
 *
 * // Imperative animation
 * <SplitText
 *   onSplit={({ words }) => {
 *     animate(words, { opacity: [0, 1], y: [20, 0] }, { delay: stagger(0.05) });
 *   }}
 * >
 *   <h1>Animated Text</h1>
 * </SplitText>
 * ```
 *
 * @example
 * ```tsx
 * // Declarative variants
 * import { stagger } from "motion";
 * <SplitText
 *   variants={{
 *     hidden: { opacity: 0, y: 20 },
 *     visible: { opacity: 1, y: 0 },
 *   }}
 *   initial="hidden"
 *   whileInView="visible"
 *   viewport={{ amount: 0.5, once: true }}
 *   transition={{ duration: 0.65, delay: stagger(0.04) }}
 *   options={{ type: "words" }}
 * >
 *   <p>Reveals on scroll</p>
 * </SplitText>
 * ```
 */
export const SplitText = forwardRef<HTMLElement, SplitTextProps>(
  function SplitText(
    {
      children,
      as: Component = "div",
      className,
      style: userStyle,
      onSplit,
      onResize,
      options,
      autoSplit = false,
      revertOnComplete = false,
      viewport,
      onViewportEnter,
      onViewportLeave,
      initialStyles,
      initialClasses,
      resetOnViewportLeave = false,
      variants,
      initial: initialVariant,
      animate: animateVariantName,
      whileInView,
      whileScroll,
      exit,
      scroll: scrollProp,
      whileHover,
      onHoverStart,
      onHoverEnd,
      transition,
    },
    forwardedRef
  ) {
    const containerRef = useRef<HTMLElement>(null);

    // Merge internal ref with forwarded ref
    const mergedRef = useCallback(
      (node: HTMLElement | null) => {
        containerRef.current = node;
        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef]
    );
  const [childElement, setChildElement] = useState<HTMLElement | null>(null);
  const [isInView, setIsInView] = useState(false);
  const [isPresent, safeToRemove] = usePresence();

  // Detect variant mode
  const hasVariants = !!variants;

  // Detect whether viewport observer is needed
  const needsViewport = !!(
    whileInView ||
    onViewportEnter ||
    onViewportLeave ||
    resetOnViewportLeave ||
    viewport
  );

  // Stable refs for callbacks and options
  const onSplitRef = useRef(onSplit);
  const onResizeRef = useRef(onResize);
  const optionsRef = useRef(options);
  const revertOnCompleteRef = useRef(revertOnComplete);
  const viewportRef = useRef(viewport);
  const onViewportEnterRef = useRef(onViewportEnter);
  const onViewportLeaveRef = useRef(onViewportLeave);
  const initialStylesRef = useRef(initialStyles);
  const initialClassesRef = useRef(initialClasses);
  const resetOnViewportLeaveRef = useRef(resetOnViewportLeave);
  const variantsRef = useRef(variants);
  const initialVariantRef = useRef(initialVariant);
  const animateVariantNameRef = useRef(animateVariantName);
  const whileInViewRef = useRef(whileInView);
  const whileScrollRef = useRef(whileScroll);
  const scrollPropRef = useRef(scrollProp);
  const whileHoverRef = useRef(whileHover);
  const onHoverStartRef = useRef(onHoverStart);
  const onHoverEndRef = useRef(onHoverEnd);
  const transitionRef = useRef(transition);
  const exitRef = useRef(exit);
  const isPresentRef = useRef(true);

  useLayoutEffect(() => {
    onSplitRef.current = onSplit;
    onResizeRef.current = onResize;
    optionsRef.current = options;
    revertOnCompleteRef.current = revertOnComplete;
    viewportRef.current = viewport;
    onViewportEnterRef.current = onViewportEnter;
    onViewportLeaveRef.current = onViewportLeave;
    initialStylesRef.current = initialStyles;
    initialClassesRef.current = initialClasses;
    resetOnViewportLeaveRef.current = resetOnViewportLeave;
    variantsRef.current = variants;
    initialVariantRef.current = initialVariant;
    animateVariantNameRef.current = animateVariantName;
    whileInViewRef.current = whileInView;
    whileScrollRef.current = whileScroll;
    scrollPropRef.current = scrollProp;
    whileHoverRef.current = whileHover;
    onHoverStartRef.current = onHoverStart;
    onHoverEndRef.current = onHoverEnd;
    transitionRef.current = transition;
    exitRef.current = exit;
  });

  // Refs for tracking state
  const hasSplitRef = useRef(false);
  const hasRevertedRef = useRef(false);
  const revertFnRef = useRef<(() => void) | null>(null);
  const splitResultRef = useRef<SplitTextElements | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const hasTriggeredOnceRef = useRef(false);
  const cleanupsRef = useRef<Array<() => void>>([]);
  const exitAnimationsRef = useRef<MotionAnimation[] | null>(null);
  const exitTokenRef = useRef(0);
  const wasPresentRef = useRef(true);
  const isExitingRef = useRef(false);

  useLayoutEffect(() => {
    const element = containerRef.current?.firstElementChild;
    setChildElement(element instanceof HTMLElement ? element : null);
  }, [children]);

  useEffect(() => {
    isPresentRef.current = isPresent;
  }, [isPresent]);

  function setupViewportObserver(container: HTMLElement) {
    const vpOptions = viewportRef.current || {};
    const amount = vpOptions.amount ?? 0;
    const threshold = amount === "some" ? 0 : amount === "all" ? 1 : amount;
    const rootMargin = vpOptions.margin ?? "0px";
    const root = vpOptions.root?.current ?? undefined;

    // Use array with both 0 and user's threshold to detect entering at threshold
    // AND fully exiting (asymmetric: enter at threshold, leave at 0)
    const thresholds = threshold > 0 ? [0, threshold] : 0;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        const isOnce = vpOptions.once;

        // Enter: when element is intersecting AND ratio is at/above threshold
        if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
          if (isOnce && hasTriggeredOnceRef.current) return;
          hasTriggeredOnceRef.current = true;
          setIsInView(true);
        } else if (!entry.isIntersecting && !isOnce) {
          // Leave: only when element has fully exited viewport
          setIsInView(false);
        }
      },
      { threshold: thresholds, rootMargin, root }
    );

    observerRef.current.observe(container);
  }

  function setupVariantBehaviors(
    splitElements: SplitTextElements
  ): Array<() => void> {
    const cleanups: Array<() => void> = [];
    const motion = motionApi;
    const vDefs = variantsRef.current;
    const container = containerRef.current;

    if (!vDefs || !container) return cleanups;

    const type = optionsRef.current?.type;
    const globalTransition = transitionRef.current;

    // whileScroll (takes priority over animate and whileInView)
    if (whileScrollRef.current && vDefs[whileScrollRef.current]) {
      const scrollOpts = scrollPropRef.current;
      const animations = animateVariant(
        motion,
        splitElements,
        vDefs[whileScrollRef.current],
        globalTransition,
        type,
        isPresentRef.current
      );

      for (const anim of animations) {
        const cancel = motion.scroll(anim, {
          target: container,
          offset: scrollOpts?.offset,
          axis: scrollOpts?.axis,
          container: scrollOpts?.container?.current ?? undefined,
        });
        cleanups.push(cancel);
      }
    }

    // whileHover
    if (whileHoverRef.current && vDefs[whileHoverRef.current]) {
      const hoverVariantName = whileHoverRef.current;
      const baseVariantName =
        animateVariantNameRef.current || initialVariantRef.current;

      const cancelHover = motion.hover(container, () => {
        onHoverStartRef.current?.();
        if (vDefs[hoverVariantName]) {
          animateVariant(
            motion,
            splitElements,
            vDefs[hoverVariantName],
            globalTransition,
            type,
            isPresentRef.current
          );
        }

        return () => {
          onHoverEndRef.current?.();
          if (
            baseVariantName &&
            typeof baseVariantName === "string" &&
            vDefs[baseVariantName]
          ) {
            animateVariant(
              motion,
              splitElements,
              vDefs[baseVariantName],
              globalTransition,
              type,
              isPresentRef.current
            );
          }
        };
      });

      cleanups.push(cancelHover);
    }

    // Viewport observer (skip if whileScroll is active)
    if (!whileScrollRef.current && needsViewport) {
      setupViewportObserver(container);
    }

    return cleanups;
  }

  // Initial split
  useEffect(() => {
    if (!childElement) return;
    if (hasSplitRef.current) return;

    let isMounted = true;
    cleanupsRef.current = [];
    const cleanups = cleanupsRef.current;

    document.fonts.ready.then(async () => {
      if (!isMounted || hasSplitRef.current || !isPresentRef.current) return;
      if (!containerRef.current) return;

      // Use core splitText with autoSplit feature
      const result = splitText(childElement, {
        ...optionsRef.current,
        autoSplit,
        revertOnComplete: revertOnCompleteRef.current,
        initialStyles: initialStylesRef.current,
        initialClasses: initialClassesRef.current,
        onResize: (resizeResult) => {
          // Update stored result with new elements but same revert
          const newSplitTextElements: SplitTextElements = {
            chars: resizeResult.chars,
            words: resizeResult.words,
            lines: resizeResult.lines,
            revert: result.revert,
          };
          splitResultRef.current = newSplitTextElements;
          onResizeRef.current?.(newSplitTextElements);
        },
      });

      // Store revert function for cleanup
      revertFnRef.current = result.revert;

      hasSplitRef.current = true;

      // Create result object with revert exposed
      const splitElements: SplitTextElements = {
        chars: result.chars,
        words: result.words,
        lines: result.lines,
        revert: result.revert,
      };
      splitResultRef.current = splitElements;

      // --- Variant mode ---
      if (variantsRef.current) {
        const motion = motionApi;
        const vDefs = variantsRef.current;
        const type = optionsRef.current?.type;
        const globalTransition = transitionRef.current;

        // 1. Apply initial variant instantly (duration: 0)
        // Must await .finished so WAAPI commits the values before the next animation reads them
        if (initialVariantRef.current !== false && initialVariantRef.current && vDefs[initialVariantRef.current]) {
          const initAnimations = animateVariant(motion, splitElements, vDefs[initialVariantRef.current], { duration: 0 }, type, isPresentRef.current);
          await allFinished(initAnimations);
        }

        if (!isMounted) return;

        // 2. Reveal container
        containerRef.current!.style.visibility = "visible";

        // 3. Call onSplit for side effects
        onSplitRef.current?.(splitElements);

        // 5. Immediate animate — skip if whileScroll is active
        if (animateVariantNameRef.current && !whileInViewRef.current && !whileScrollRef.current && vDefs[animateVariantNameRef.current]) {
          const animations = animateVariant(
            motion,
            splitElements,
            vDefs[animateVariantNameRef.current],
            globalTransition,
            type,
            isPresentRef.current
          );

          // Handle revertOnComplete
          if (revertOnCompleteRef.current) {
            allFinished(animations)
              .then(() => {
                if (!isMounted || hasRevertedRef.current) return;
                result.revert();
                hasRevertedRef.current = true;
              })
              .catch(() => {
                console.warn("[fetta] Animation rejected, text not reverted");
              });
          }
        }

        // 6. Set up behaviors (scroll/hover/viewport)
        cleanups.push(...setupVariantBehaviors(splitElements));

        return;
      }

      // --- Callback mode (existing behavior) ---

      // Reveal after split
      containerRef.current!.style.visibility = "visible";

      // Call onSplit if provided
      if (onSplitRef.current) {
        const callbackResult = onSplitRef.current(splitElements);

        // Handle revertOnComplete for onSplit (only when viewport is NOT enabled)
        if (!needsViewport && revertOnCompleteRef.current) {
          const promise = normalizeToPromise(callbackResult);
          if (promise) {
            promise
              .then(() => {
                if (!isMounted || hasRevertedRef.current) return;
                result.revert();
                hasRevertedRef.current = true;
              })
              .catch(() => {
                console.warn("[fetta] Animation rejected, text not reverted");
              });
          } else if (callbackResult === undefined) {
            // No warning if onSplit didn't return anything - user might be setting up state
          } else {
            console.warn(
              "SplitText: revertOnComplete is enabled but onSplit did not return an animation or promise."
            );
          }
        }
      }

      // Set up IntersectionObserver if viewport callbacks are present
      if (needsViewport && containerRef.current) {
        setupViewportObserver(containerRef.current);
      }
    });

    return () => {
      isMounted = false;
      // Run accumulated cleanups (hover, etc.)
      for (const fn of cleanups) fn();
      cleanupsRef.current = [];
      // Cleanup observer
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      // Cleanup on unmount
      if (revertFnRef.current) {
        revertFnRef.current();
      }
      // Reset for StrictMode remount
      hasSplitRef.current = false;
    };
  }, [childElement, autoSplit, hasVariants, needsViewport]);

  // Handle isInView changes
  useEffect(() => {
    if (!isPresent) return;
    if (!splitResultRef.current) return;
    if (hasRevertedRef.current) return;

    // --- Variant mode viewport handling ---
    if (hasVariants && variantsRef.current) {
      const motion = motionApi;
      const vDefs = variantsRef.current;
      const type = optionsRef.current?.type;
      const globalTransition = transitionRef.current;
      const isOnce = viewportRef.current?.once;

      if (isInView) {
        // Also call onViewportEnter callback if provided
        onViewportEnterRef.current?.(splitResultRef.current);

        const variantName = whileInViewRef.current;
        if (variantName && vDefs[variantName]) {
          animateVariant(motion, splitResultRef.current, vDefs[variantName], globalTransition, type, isPresent);
        }
      } else {
        // Also call onViewportLeave callback if provided
        onViewportLeaveRef.current?.(splitResultRef.current);

        if (!isOnce && resetOnViewportLeaveRef.current) {
          const initName = initialVariantRef.current;
          if (initName && typeof initName === "string" && vDefs[initName]) {
            animateVariant(
              motion,
              splitResultRef.current,
              vDefs[initName],
              { duration: 0 },
              type,
              isPresent
            );
          }
        }
      }
      return;
    }

    // --- Callback mode viewport handling ---
    if (isInView && onViewportEnterRef.current) {
      const callbackResult = onViewportEnterRef.current(splitResultRef.current);
      const promise = normalizeToPromise(callbackResult);

      if (revertOnCompleteRef.current && promise) {
        promise
          .then(() => {
            if (hasRevertedRef.current) return;
            splitResultRef.current?.revert();
            hasRevertedRef.current = true;
          })
          .catch(() => {
            console.warn("[fetta] Animation rejected, text not reverted");
          });
      }
    } else if (!isInView && splitResultRef.current) {
      // Re-apply initial styles/classes when leaving viewport
      if (resetOnViewportLeaveRef.current) {
        const { chars, words, lines } = splitResultRef.current;
        const styles = initialStylesRef.current;
        const classes = initialClassesRef.current;

        if (styles) {
          reapplyInitialStyles(chars, styles.chars);
          reapplyInitialStyles(words, styles.words);
          reapplyInitialStyles(lines, styles.lines);
        }

        if (classes) {
          reapplyInitialClasses(chars, classes.chars);
          reapplyInitialClasses(words, classes.words);
          reapplyInitialClasses(lines, classes.lines);
        }
      }

      // Call onViewportLeave callback if provided
      if (onViewportLeaveRef.current) {
        onViewportLeaveRef.current(splitResultRef.current);
      }
    }
  }, [isInView, hasVariants, isPresent]);

  useEffect(() => {
    if (isPresent) return;
    if (!safeToRemove) return;

    isExitingRef.current = true;

    for (const fn of cleanupsRef.current) fn();
    cleanupsRef.current = [];
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (!splitResultRef.current) {
      safeToRemove();
      return;
    }

    const exitConfig = exitRef.current;
    if (exitConfig === false || exitConfig == null) {
      safeToRemove();
      return;
    }

    const vDefs = variantsRef.current;
    const exitVariant =
      typeof exitConfig === "string" ? vDefs?.[exitConfig] : exitConfig;

    if (!exitVariant) {
      safeToRemove();
      return;
    }

    const animations = animateVariant(
      motionApi,
      splitResultRef.current,
      exitVariant,
      transitionRef.current,
      optionsRef.current?.type,
      false
    );

    exitAnimationsRef.current = animations;
    const token = ++exitTokenRef.current;

    allFinished(animations)
      .then(() => {
        if (exitTokenRef.current !== token) return;
        if (isPresentRef.current) return;
        safeToRemove();
      })
      .catch(() => {
        if (exitTokenRef.current !== token) return;
        if (isPresentRef.current) return;
        safeToRemove();
      });
  }, [isPresent, safeToRemove]);

  useEffect(() => {
    const wasPresent = wasPresentRef.current;

    if (isPresent && !wasPresent) {
      if (isExitingRef.current) {
        for (const anim of exitAnimationsRef.current || []) anim.stop();
        exitAnimationsRef.current = null;
        exitTokenRef.current += 1;
        isExitingRef.current = false;
      }

      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      if (splitResultRef.current && variantsRef.current) {
        cleanupsRef.current.forEach((fn) => fn());
        cleanupsRef.current = setupVariantBehaviors(splitResultRef.current);

        const vDefs = variantsRef.current;
        const type = optionsRef.current?.type;
        const globalTransition = transitionRef.current;

        if (whileScrollRef.current && vDefs[whileScrollRef.current]) {
          // Scroll-driven variants will take over playback.
        } else if (
          whileInViewRef.current &&
          isInView &&
          vDefs[whileInViewRef.current]
        ) {
          animateVariant(
            motionApi,
            splitResultRef.current,
            vDefs[whileInViewRef.current],
            globalTransition,
            type,
            true
          );
        } else if (
          animateVariantNameRef.current &&
          vDefs[animateVariantNameRef.current]
        ) {
          animateVariant(
            motionApi,
            splitResultRef.current,
            vDefs[animateVariantNameRef.current],
            globalTransition,
            type,
            true
          );
        }
      }
    }

    wasPresentRef.current = isPresent;
  }, [isPresent, isInView]);

  if (!isValidElement(children)) {
    console.error("SplitText: children must be a single valid React element");
    return null;
  }

  const Wrapper = Component;
  return createElement(
    Wrapper,
    {
      ref: mergedRef,
      className,
      style: { visibility: "hidden", position: "relative", ...userStyle },
    },
    children
  );
  }
);
