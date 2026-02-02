import { splitText, normalizeToPromise } from "../core/splitText";
import {
  cloneElement,
  forwardRef,
  isValidElement,
  ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

/** Style value for initialStyles - a partial CSSStyleDeclaration object */
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

  const isFn = typeof style === 'function';

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const styles = isFn ? style(el, i) : style;

    for (const [key, value] of Object.entries(styles)) {
      if (value !== undefined) {
        (el.style as unknown as Record<string, unknown>)[key] = value;
      }
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
  offset?: string[];
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
type VariantTarget = Record<string, string | number>;

interface VariantTransition {
  duration?: number;
  ease?: string | number[] | readonly number[];
  /** Static number or stagger function (i, total) => number from motion */
  delay?: number | ((index: number, total: number) => number);
  type?: "spring" | "tween";
  stiffness?: number;
  damping?: number;
  mass?: number;
  bounce?: number;
}

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
}

/** Per-type target with optional transition override */
type PerTypeTarget = {
  [key: string]: string | number | VariantTransition | undefined;
  transition?: VariantTransition;
};

/** Flat variant target with optional transition override */
type FlatVariantTarget = {
  [key: string]: string | number | VariantTransition | PerTypeTarget | undefined;
  transition?: VariantTransition;
};

/** A variant: flat target, flat function, per-type targets (static or function), with optional transition */
type VariantDefinition =
  | FlatVariantTarget
  | ((info: VariantInfo) => PerTypeTarget)
  | {
      chars?: PerTypeTarget | ((info: VariantInfo) => PerTypeTarget);
      words?: PerTypeTarget | ((info: VariantInfo) => PerTypeTarget);
      lines?: PerTypeTarget | ((info: VariantInfo) => PerTypeTarget);
      transition?: VariantTransition;
    };

// ---------------------------------------------------------------------------
// Dynamic Motion import — module-level cache
// ---------------------------------------------------------------------------

interface MotionApi {
  animate: Function;
  hover: Function;
  scroll: Function;
}

let motionCache: MotionApi | null = null;

async function loadMotion(): Promise<MotionApi> {
  if (motionCache) return motionCache;
  try {
    const m = await import("motion");
    motionCache = {
      animate: m.animate,
      hover: m.hover,
      scroll: m.scroll,
    };
    return motionCache;
  } catch {
    throw new Error(
      "[fetta] Variants require 'motion' to be installed. Run: npm install motion"
    );
  }
}

// ---------------------------------------------------------------------------
// Variant helpers
// ---------------------------------------------------------------------------

const ELEMENT_TYPE_KEYS = ["chars", "words", "lines"] as const;

/** Detect per-type vs flat variant */
function isPerTypeVariant(v: VariantDefinition): boolean {
  if (typeof v === "function") return false;
  return ELEMENT_TYPE_KEYS.some((k) => {
    const val = (v as Record<string, unknown>)[k];
    return val != null && (typeof val === "object" || typeof val === "function");
  });
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

/** Normalize transition options before passing to Motion */
function resolveTransition(
  t: VariantTransition | undefined
): Record<string, unknown> | undefined {
  if (!t) return undefined;
  const { stagger: _stagger, ...rest } = t as VariantTransition & {
    stagger?: unknown;
  };
  return { ...rest };
}

/** Separate transition from animation props in a variant definition */
function extractTransition(
  variant: Record<string, unknown>
): { props: Record<string, unknown>; transition?: VariantTransition } {
  const { transition, ...props } = variant;
  return { props, transition: transition as VariantTransition | undefined };
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

function buildFnInfo(
  elementType: "chars" | "words" | "lines",
  globalIndex: number,
  total: number,
  maps: IndexMaps
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
    return { index, count, globalIndex, globalCount: total, lineIndex, wordIndex };
  }
  if (elementType === "words") {
    const lineIndex = maps.wordToLine.length ? maps.wordToLine[globalIndex] : 0;
    const index = maps.wordInLine.length ? maps.wordInLine[globalIndex] : globalIndex;
    const count = maps.wordCountInLine.length ? maps.wordCountInLine[globalIndex] : total;
    return { index, count, globalIndex, globalCount: total, lineIndex, wordIndex: globalIndex };
  }
  return { index: globalIndex, count: total, globalIndex, globalCount: total, lineIndex: globalIndex, wordIndex: 0 };
}

/**
 * Build motion sequence segments for function variants.
 * Each element gets its own segment with resolved props from the fn.
 * If delay is a stagger function (from motion), it's called with (info.index, info.count).
 */
function buildFnSequence(
  elements: HTMLSpanElement[],
  elementType: "chars" | "words" | "lines",
  fn: (info: VariantInfo) => PerTypeTarget,
  maps: IndexMaps,
  transition: VariantTransition | undefined
): Array<[HTMLSpanElement, Record<string, unknown>, Record<string, unknown>?]> {
  const t = transition as (VariantTransition & { stagger?: unknown }) | undefined;
  const { delay: outerDelay, duration, stagger: _stagger, ...rest } = t || {};
  const segments: Array<[HTMLSpanElement, Record<string, unknown>, Record<string, unknown>?]> = [];
  const total = elements.length;

  for (let i = 0; i < total; i++) {
    const info = buildFnInfo(elementType, i, total, maps);
    const { transition: localT, ...props } = fn(info);
    // Merge: per-element transition from fn return overrides outer transition
    const merged: Record<string, unknown> = localT
      ? { ...rest, ...(localT as Record<string, unknown>) }
      : { ...rest };
    if (duration != null && !('duration' in merged)) merged.duration = duration;

    // Resolve delay — may be a stagger function from motion
    const rawDelay = merged.delay ?? outerDelay;
    const resolvedDelay = typeof rawDelay === "function"
      ? (rawDelay as (i: number, t: number) => number)(info.index, info.count)
      : rawDelay as number | undefined;

    if (resolvedDelay != null) {
      merged.at = resolvedDelay;
      delete merged.delay;
    }

    segments.push([elements[i], props, Object.keys(merged).length ? merged : undefined]);
  }

  return segments;
}

function animateVariant(
  motion: MotionApi,
  result: SplitTextElements,
  variant: VariantDefinition,
  globalTransition: VariantTransition | undefined,
  type?: string
): Array<{ finished: Promise<unknown> }> {
  // Case 1: Flat function variant
  if (typeof variant === "function") {
    const targetType = getTargetType(result, type);
    const elements = result[targetType];
    if (!elements.length) return [];
    const maps = buildIndexMaps(result);
    const segments = buildFnSequence(elements, targetType, variant, maps, globalTransition);
    return [motion.animate(segments)];
  }

  // Case 2 & 3: Per-type variant (may contain function values)
  if (isPerTypeVariant(variant)) {
    const perType = variant as Record<string, unknown>;
    const hasFnKey = ELEMENT_TYPE_KEYS.some(
      (k) => typeof perType[k] === "function"
    );

    if (hasFnKey) {
      // Build index maps once for all function keys
      const maps = buildIndexMaps(result);
      const allSegments: Array<[HTMLSpanElement, Record<string, unknown>, Record<string, unknown>?]> = [];
      const staticAnimations: Array<{ finished: Promise<unknown> }> = [];

      for (const key of ELEMENT_TYPE_KEYS) {
        const target = perType[key];
        if (!target || !result[key].length) continue;

        if (typeof target === "function") {
          const localTransition = (perType.transition as VariantTransition | undefined) || globalTransition;
          const segments = buildFnSequence(result[key], key, target as (info: any) => PerTypeTarget, maps, localTransition);
          allSegments.push(...segments);
        } else {
          // Static per-type target — use existing path
          const { props, transition: localT } = extractTransition(target as Record<string, unknown>);
          const t = resolveTransition(localT || globalTransition);
          staticAnimations.push(motion.animate(result[key], props, t));
        }
      }

      const animations = [...staticAnimations];
      if (allSegments.length) {
        animations.push(motion.animate(allSegments));
      }
      return animations;
    }

    // Case 3: All static per-type — unchanged
    const animations: Array<{ finished: Promise<unknown> }> = [];
    for (const key of ELEMENT_TYPE_KEYS) {
      const target = perType[key];
      if (!target || !result[key].length) continue;
      const { props, transition: localT } = extractTransition(target as Record<string, unknown>);
      const t = resolveTransition(localT || globalTransition);
      animations.push(motion.animate(result[key], props, t));
    }
    return animations;
  }

  // Case 4: Flat static variant — unchanged
  const { props, transition: localT } = extractTransition(variant as Record<string, unknown>);
  const elements = getTargetElements(result, type);
  const t = resolveTransition(localT || globalTransition);
  return [motion.animate(elements, props, t)];
}

/** Wait for all animation controls to finish */
function allFinished(
  animations: Array<{ finished: Promise<unknown> }>
): Promise<unknown[]> {
  return Promise.all(animations.map((a) => a.finished));
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SplitTextProps {
  children: ReactElement;
  /** The wrapper element type. Default: "div" */
  as?: keyof React.JSX.IntrinsicElements;
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
  transition?: VariantTransition;
}

/**
 * React component wrapper for text splitting with kerning compensation.
 *
 * Wraps a single child element and splits its text content into characters,
 * words, and/or lines. Handles lifecycle cleanup automatically on unmount.
 *
 * Supports two modes:
 * - **Callback mode**: Use `onSplit`, `onViewportEnter`, `onViewportLeave` for imperative animation control
 * - **Variant mode**: Use `variants`, `initial`, `animate`, `whileInView`, `whileHover` for declarative animations powered by Motion
 *
 * @param props - Component props including callbacks and options
 * @returns The child element wrapped in a container div
 *
 * @example
 * ```tsx
 * import { SplitText } from "fetta/react";
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

  // Detect variant mode
  const hasVariants = !!variants;

  // Detect whether viewport observer is needed
  const needsViewport = !!(whileInView || onViewportEnter || onViewportLeave || viewport);

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
  });

  // Refs for tracking state
  const hasSplitRef = useRef(false);
  const hasRevertedRef = useRef(false);
  const revertFnRef = useRef<(() => void) | null>(null);
  const splitResultRef = useRef<SplitTextElements | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const hasTriggeredOnceRef = useRef(false);

  const childRefCallback = useCallback((node: HTMLElement | null) => {
    setChildElement(node);
  }, []);

  // Initial split
  useEffect(() => {
    if (!childElement) return;
    if (hasSplitRef.current) return;

    let isMounted = true;
    const cleanups: Array<() => void> = [];

    // Load motion in parallel with fonts if variant mode
    const readyPromise = hasVariants
      ? Promise.all([document.fonts.ready, loadMotion()] as const)
      : document.fonts.ready.then((v) => [v, null] as const);

    readyPromise.then(async ([, motion]) => {
      if (!isMounted || hasSplitRef.current) return;
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
      if (motion && variantsRef.current) {
        const vDefs = variantsRef.current;
        const type = optionsRef.current?.type;
        const globalTransition = transitionRef.current;

        // 1. Apply initial variant instantly (duration: 0)
        // Must await .finished so WAAPI commits the values before the next animation reads them
        if (initialVariantRef.current !== false && initialVariantRef.current && vDefs[initialVariantRef.current]) {
          const initAnimations = animateVariant(motion, splitElements, vDefs[initialVariantRef.current], { duration: 0 }, type);
          await allFinished(initAnimations);
        }

        if (!isMounted) return;

        // 2. Reveal container
        containerRef.current!.style.visibility = "visible";

        // 3. Call onSplit for side effects
        onSplitRef.current?.(splitElements);

        // 4. whileScroll (takes priority over animate and whileInView)
        if (whileScrollRef.current && containerRef.current && vDefs[whileScrollRef.current]) {
          const scrollOpts = scrollPropRef.current;

          // Create animations to target variant — scroll() takes over playback
          const animations = animateVariant(
            motion, splitElements, vDefs[whileScrollRef.current], globalTransition, type
          );

          // Bind each animation to scroll progress
          for (const anim of animations) {
            const cancel = motion.scroll(anim, {
              target: containerRef.current,
              offset: scrollOpts?.offset,
              axis: scrollOpts?.axis,
              container: scrollOpts?.container?.current ?? undefined,
            });
            cleanups.push(cancel);
          }
        }

        // 5. Immediate animate — skip if whileScroll is active
        if (animateVariantNameRef.current && !whileInViewRef.current && !whileScrollRef.current && vDefs[animateVariantNameRef.current]) {
          const animations = animateVariant(motion, splitElements, vDefs[animateVariantNameRef.current], globalTransition, type);

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

        // 6. whileHover
        if (whileHoverRef.current && containerRef.current && vDefs[whileHoverRef.current]) {
          const hoverVariantName = whileHoverRef.current;
          // Determine base variant to return to on hover end
          const baseVariantName = animateVariantNameRef.current || initialVariantRef.current;

          const cancelHover = motion.hover(containerRef.current, () => {
            onHoverStartRef.current?.();
            if (vDefs[hoverVariantName]) {
              animateVariant(motion, splitElements, vDefs[hoverVariantName], globalTransition, type);
            }

            // Return cleanup = hover end
            return () => {
              onHoverEndRef.current?.();
              if (baseVariantName && typeof baseVariantName === "string" && vDefs[baseVariantName]) {
                animateVariant(motion, splitElements, vDefs[baseVariantName], globalTransition, type);
              }
            };
          });

          cleanups.push(cancelHover);
        }

        // 7. Set up viewport observer for whileInView — skip if whileScroll is active
        if (!whileScrollRef.current && whileInViewRef.current && containerRef.current) {
          // Viewport observer handled via isInView state + dedicated effect
          setupViewportObserver(containerRef.current);
        }

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

    function setupViewportObserver(container: HTMLElement) {
      const vpOptions = viewportRef.current || {};
      const amount = vpOptions.amount ?? 0;
      const threshold =
        amount === "some" ? 0 : amount === "all" ? 1 : amount;
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

    return () => {
      isMounted = false;
      // Run accumulated cleanups (hover, etc.)
      for (const fn of cleanups) fn();
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
    if (!splitResultRef.current) return;
    if (hasRevertedRef.current) return;

    // --- Variant mode viewport handling ---
    if (hasVariants && variantsRef.current && motionCache) {
      const motion = motionCache;
      const vDefs = variantsRef.current;
      const type = optionsRef.current?.type;
      const globalTransition = transitionRef.current;
      const isOnce = viewportRef.current?.once;

      if (isInView) {
        // Also call onViewportEnter callback if provided
        onViewportEnterRef.current?.(splitResultRef.current);

        const variantName = whileInViewRef.current;
        if (variantName && vDefs[variantName]) {
          animateVariant(motion, splitResultRef.current, vDefs[variantName], globalTransition, type);
        }
      } else {
        // Also call onViewportLeave callback if provided
        onViewportLeaveRef.current?.(splitResultRef.current);

        if (!isOnce && resetOnViewportLeaveRef.current) {
          const initName = initialVariantRef.current;
          if (initName && typeof initName === "string" && vDefs[initName]) {
            animateVariant(motion, splitResultRef.current, vDefs[initName], { duration: 0 }, type);
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
  }, [isInView, hasVariants]);

  if (!isValidElement(children)) {
    console.error("SplitText: children must be a single valid React element");
    return null;
  }

  const clonedChild = cloneElement(children, {
    ref: childRefCallback,
  } as Record<string, unknown>);

  const Wrapper = Component as React.ElementType;
  return (
    <Wrapper
      ref={mergedRef}
      className={className}
      style={{ visibility: "hidden", position: "relative", ...userStyle }}
    >
      {clonedChild}
    </Wrapper>
  );
  }
);
