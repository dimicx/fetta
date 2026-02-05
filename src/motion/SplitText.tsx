import { splitTextData } from "../internal/splitTextShared";
import { normalizeToPromise } from "../core/splitText";
import { animate, scroll } from "motion";
import { MotionConfig, motion, usePresence, useReducedMotion } from "motion/react";
import type { AnimationOptions, DOMKeyframesDefinition } from "motion";
import {
  createElement,
  forwardRef,
  isValidElement,
  ReactElement,
  ReactNode,
  ForwardedRef,
  RefAttributes,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useId,
} from "react";
import type { SplitTextData, SplitTextDataNode } from "../core/splitText";

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
  /** How much visibility is required to consider the element out of view. Default: 0 (fully out) */
  leave?: number | "some" | "all";
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

/** Motion-compatible animation target (passed directly to motion variants) */
type VariantTarget = DOMKeyframesDefinition & {
  transition?: AnimationOptions;
};

/** Info passed to function variant callbacks */
export interface VariantInfo<TCustom = unknown> {
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
  /** User custom data passed to SplitText */
  custom: TCustom | undefined;
  /** AnimatePresence presence state */
  isPresent: boolean;
}

type VariantResolver<TCustom = unknown> = (
  info: VariantInfo<TCustom>
) => VariantTarget;
type WrapperVariantResolver<TCustom = unknown> = (
  args: { custom?: TCustom }
) => VariantTarget;
type PerTypeVariant<TCustom = unknown> =
  | VariantTarget
  | VariantResolver<TCustom>;
type WrapperVariant<TCustom = unknown> =
  | VariantTarget
  | WrapperVariantResolver<TCustom>;

/** A variant: flat target, flat function, per-type targets (static or function), with optional transition */
type VariantDefinition<TCustom = unknown> =
  | VariantTarget
  | VariantResolver<TCustom>
  | {
      chars?: PerTypeVariant<TCustom>;
      words?: PerTypeVariant<TCustom>;
      lines?: PerTypeVariant<TCustom>;
      wrapper?: WrapperVariant<TCustom>;
      transition?: AnimationOptions;
    };

type SplitTypeKey = "chars" | "words" | "lines";
type SplitRole = "char" | "word" | "line";
type DelayScope = "global" | "local";

const ELEMENT_TYPE_KEYS: SplitTypeKey[] = ["chars", "words", "lines"];

/** Detect per-type vs flat variant */
type PerTypeVariants<TCustom = unknown> = Partial<
  Record<SplitTypeKey, PerTypeVariant<TCustom>>
> & {
  wrapper?: WrapperVariant<TCustom>;
  transition?: AnimationOptions;
};

function isPerTypeVariant<TCustom = unknown>(
  v: VariantDefinition<TCustom>
): v is PerTypeVariants<TCustom> {
  if (typeof v !== "object" || v === null) return false;
  return "chars" in v || "words" in v || "lines" in v || "wrapper" in v;
}

const ORCHESTRATION_KEYS = new Set([
  "delayChildren",
  "staggerChildren",
  "staggerDirection",
  "when",
]);

function pickOrchestration(
  transition?: AnimationOptions
): AnimationOptions | undefined {
  if (!transition) return undefined;
  const picked: AnimationOptions = {};
  for (const key of ORCHESTRATION_KEYS) {
    if (key in transition) {
      (picked as Record<string, unknown>)[key] = (transition as Record<
        string,
        unknown
      >)[key];
    }
  }
  return Object.keys(picked).length ? picked : undefined;
}

function stripOrchestration(
  transition?: AnimationOptions
): AnimationOptions | undefined {
  if (!transition) return undefined;
  const stripped: AnimationOptions = {};
  for (const [key, value] of Object.entries(transition)) {
    if (!ORCHESTRATION_KEYS.has(key)) {
      (stripped as Record<string, unknown>)[key] = value;
    }
  }
  return Object.keys(stripped).length ? stripped : undefined;
}

function hasOrchestration(transition?: AnimationOptions): boolean {
  if (!transition) return false;
  for (const key of ORCHESTRATION_KEYS) {
    if (key in transition) return true;
  }
  return false;
}

function getVariantTransition<TCustom = unknown>(
  def: VariantDefinition<TCustom>
): AnimationOptions | undefined {
  if (typeof def !== "object" || def == null) return undefined;
  if ("transition" in def) {
    return (def as { transition?: AnimationOptions }).transition;
  }
  return undefined;
}

function withDefaultTransition<TCustom = unknown>(
  target: PerTypeVariant<TCustom>,
  defaultTransition: AnimationOptions | undefined,
  delayScope: DelayScope
): PerTypeVariant<TCustom> {
  const needsDelayResolution = (transition?: AnimationOptions): boolean => {
    const delay = transition?.delay as unknown;
    if (typeof delay === "function") return true;
    if (typeof delay === "number") return !Number.isFinite(delay);
    return false;
  };

  const resolveDelay = (
    delay: AnimationOptions["delay"],
    info: VariantInfo<TCustom>
  ): number | undefined => {
    if (typeof delay === "function") {
      const [index, count] =
        delayScope === "local"
          ? [info.index, info.count]
          : [info.globalIndex, info.globalCount];
      if (!Number.isFinite(index) || !Number.isFinite(count) || count <= 0) {
        return undefined;
      }
      const value = delay(index, count);
      return Number.isFinite(value) ? value : undefined;
    }
    if (typeof delay === "number") {
      return Number.isFinite(delay) ? delay : undefined;
    }
    return undefined;
  };

  const mergeTransitions = (
    base: AnimationOptions | undefined,
    override: AnimationOptions | undefined,
    info: VariantInfo<TCustom>
  ): AnimationOptions | undefined => {
    const merged: AnimationOptions = {
      ...(base ?? {}),
      ...(override ?? {}),
    };

    if ("delay" in merged) {
      const resolved = resolveDelay(merged.delay, info);
      if (resolved == null) {
        delete (merged as { delay?: AnimationOptions["delay"] }).delay;
      } else {
        merged.delay = resolved;
      }
    }

    return Object.keys(merged).length ? merged : undefined;
  };

  if (typeof target === "function") {
    return (info: VariantInfo<TCustom>) => {
      const resolved = target(info);
      const transition = mergeTransitions(
        defaultTransition,
        resolved.transition,
        info
      );
      if (transition) return { ...resolved, transition };
      if (resolved.transition) {
        const { transition: _removed, ...rest } = resolved;
        return rest;
      }
      return resolved;
    };
  }

  if (
    needsDelayResolution(defaultTransition) ||
    needsDelayResolution(target.transition)
  ) {
    return (info: VariantInfo<TCustom>) => {
      const transition = mergeTransitions(
        defaultTransition,
        target.transition,
        info
      );
      return transition ? { ...target, transition } : target;
    };
  }

  if (!defaultTransition) return target;

  if (!target.transition) {
    return { ...target, transition: defaultTransition };
  }

  return {
    ...target,
    transition: { ...defaultTransition, ...target.transition },
  };
}

function getTargetType(
  data: SplitTextData,
  type?: string
): SplitTypeKey {
  const hasChars = data.meta.type?.includes("chars");
  const hasWords = data.meta.type?.includes("words");
  const hasLines = data.meta.type?.includes("lines");

  if (type?.includes("chars") && hasChars) return "chars";
  if (type?.includes("words") && hasWords) return "words";
  if (type?.includes("lines") && hasLines) return "lines";

  if (hasChars) return "chars";
  if (hasWords) return "words";
  return "lines";
}

function buildVariantsByType<TCustom = unknown>(
  variants: Record<string, VariantDefinition<TCustom>> | undefined,
  targetType: SplitTypeKey,
  childDefaultTransition: AnimationOptions | undefined,
  delayScope: DelayScope,
  forceInstant = false
): {
  types: Partial<Record<SplitTypeKey, Record<string, PerTypeVariant<TCustom>>>>;
  wrapper: Record<string, WrapperVariant<TCustom>>;
} {
  if (!variants) return { types: {}, wrapper: {} };

  const result: Partial<
    Record<SplitTypeKey, Record<string, PerTypeVariant<TCustom>>>
  > = {};
  const wrapperVariants: Record<string, WrapperVariant<TCustom>> = {};
  const instantTransition: AnimationOptions = { duration: 0, delay: 0 };
  const applyInstant = (
    target: PerTypeVariant<TCustom>
  ): PerTypeVariant<TCustom> => {
    if (typeof target === "function") {
      return (info: VariantInfo<TCustom>) => {
        const resolved = target(info);
        return { ...resolved, transition: instantTransition };
      };
    }
    return { ...target, transition: instantTransition };
  };
  const applyInstantWrapper = (
    target: WrapperVariant<TCustom>
  ): WrapperVariant<TCustom> => {
    if (typeof target === "function") {
      return ({ custom }: { custom?: TCustom }) => {
        const resolved = target({ custom });
        return { ...resolved, transition: instantTransition };
      };
    }
    return { ...target, transition: instantTransition };
  };

  for (const [name, def] of Object.entries(variants)) {
    const defaultTransition = isPerTypeVariant<TCustom>(def)
      ? def.transition ?? childDefaultTransition
      : childDefaultTransition;
    const resolvedDefault = forceInstant ? instantTransition : defaultTransition;

    if (isPerTypeVariant<TCustom>(def)) {
      if (def.wrapper) {
        wrapperVariants[name] = forceInstant
          ? applyInstantWrapper(def.wrapper)
          : def.wrapper;
      }
      for (const key of ELEMENT_TYPE_KEYS) {
        const perType = def[key];
        if (!perType) continue;
        const entry = forceInstant
          ? applyInstant(perType)
          : withDefaultTransition(perType, resolvedDefault, delayScope);
        if (!result[key]) result[key] = {};
        result[key]![name] = entry;
      }
      continue;
    }

    if (targetType) {
      const entry = forceInstant
        ? applyInstant(def)
        : withDefaultTransition(def, resolvedDefault, delayScope);
      if (!result[targetType]) result[targetType] = {};
      result[targetType]![name] = entry;
    }
  }

  return { types: result, wrapper: wrapperVariants };
}

// ---------------------------------------------------------------------------
// Index maps for function variants (data-driven)
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

interface RelationMaps {
  charToWord: number[];
  charToLine: number[];
  wordToLine: number[];
  counts: { chars: number; words: number; lines: number };
}

function collectRelations(nodes: SplitTextDataNode[]): RelationMaps {
  const charToWord: number[] = [];
  const charToLine: number[] = [];
  const wordToLine: number[] = [];
  const counts = { chars: 0, words: 0, lines: 0 };

  const walk = (
    list: SplitTextDataNode[],
    context: { lineIndex: number | null; wordIndex: number | null }
  ) => {
    for (const node of list) {
      if (node.type !== "element") continue;

      let nextContext = context;
      if (node.split === "line") {
        const lineIndex = counts.lines++;
        nextContext = { ...context, lineIndex };
      }
      if (node.split === "word") {
        const wordIndex = counts.words++;
        if (nextContext.lineIndex != null) {
          wordToLine[wordIndex] = nextContext.lineIndex;
        }
        nextContext = { ...nextContext, wordIndex };
      }
      if (node.split === "char") {
        const charIndex = counts.chars++;
        charToWord[charIndex] =
          nextContext.wordIndex != null ? nextContext.wordIndex : -1;
        charToLine[charIndex] =
          nextContext.lineIndex != null ? nextContext.lineIndex : -1;
      }

      walk(node.children, nextContext);
    }
  };

  walk(nodes, { lineIndex: null, wordIndex: null });

  if (counts.words === 0) {
    charToWord.length = 0;
  } else {
    for (let i = 0; i < charToWord.length; i++) {
      if (charToWord[i] < 0) charToWord[i] = 0;
    }
  }

  if (counts.lines === 0) {
    charToLine.length = 0;
    wordToLine.length = 0;
  } else {
    for (let i = 0; i < charToLine.length; i++) {
      if (charToLine[i] < 0) charToLine[i] = 0;
    }
    for (let i = 0; i < wordToLine.length; i++) {
      if (wordToLine[i] == null) wordToLine[i] = 0;
    }
  }

  return { charToWord, charToLine, wordToLine, counts };
}

function buildIndexMaps(relations: RelationMaps): IndexMaps {
  const { charToWord, charToLine, wordToLine } = relations;

  const charInWord: number[] = [];
  const charCountInWord: number[] = [];
  const charInLine: number[] = [];
  const charCountInLine: number[] = [];
  const wordInLine: number[] = [];
  const wordCountInLine: number[] = [];

  if (charToWord.length) {
    let prev = -1;
    let counter = 0;
    for (let ci = 0; ci < charToWord.length; ci++) {
      if (charToWord[ci] !== prev) {
        counter = 0;
        prev = charToWord[ci];
      }
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
    let prev = -1;
    let counter = 0;
    for (let ci = 0; ci < charToLine.length; ci++) {
      if (charToLine[ci] !== prev) {
        counter = 0;
        prev = charToLine[ci];
      }
      charInLine[ci] = counter++;
    }
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
    let prev = -1;
    let counter = 0;
    for (let wi = 0; wi < wordToLine.length; wi++) {
      if (wordToLine[wi] !== prev) {
        counter = 0;
        prev = wordToLine[wi];
      }
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

  return {
    charToWord,
    charToLine,
    wordToLine,
    charInWord,
    charCountInWord,
    charInLine,
    charCountInLine,
    wordInLine,
    wordCountInLine,
  };
}

function buildVariantInfo<TCustom = unknown>(
  elementType: SplitTypeKey,
  globalIndex: number,
  total: number,
  maps: IndexMaps,
  isPresent: boolean,
  custom?: TCustom
): VariantInfo<TCustom> {
  if (elementType === "chars") {
    const lineIndex = maps.charToLine.length
      ? maps.charToLine[globalIndex]
      : 0;
    const wordIndex = maps.charToWord.length
      ? maps.charToWord[globalIndex]
      : 0;
    const index = maps.charInLine.length
      ? maps.charInLine[globalIndex]
      : maps.charInWord.length
        ? maps.charInWord[globalIndex]
        : globalIndex;
    const count = maps.charCountInLine.length
      ? maps.charCountInLine[globalIndex]
      : maps.charCountInWord.length
        ? maps.charCountInWord[globalIndex]
        : total;
    return {
      index,
      count,
      globalIndex,
      globalCount: total,
      lineIndex,
      wordIndex,
      custom,
      isPresent,
    };
  }
  if (elementType === "words") {
    const lineIndex = maps.wordToLine.length
      ? maps.wordToLine[globalIndex]
      : 0;
    const index = maps.wordInLine.length
      ? maps.wordInLine[globalIndex]
      : globalIndex;
    const count = maps.wordCountInLine.length
      ? maps.wordCountInLine[globalIndex]
      : total;
    return {
      index,
      count,
      globalIndex,
      globalCount: total,
      lineIndex,
      wordIndex: globalIndex,
      custom,
      isPresent,
    };
  }
  return {
    index: globalIndex,
    count: total,
    globalIndex,
    globalCount: total,
    lineIndex: globalIndex,
    wordIndex: 0,
    custom,
    isPresent,
  };
}

// ---------------------------------------------------------------------------
// Imperative whileScroll helpers (variant definitions)
// ---------------------------------------------------------------------------

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
function getTargetTypeForElements(
  result: SplitTextElements,
  type?: string
): SplitTypeKey {
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

interface IndexMapsDom {
  charToWord: number[];
  charToLine: number[];
  wordToLine: number[];
  charInWord: number[];
  charCountInWord: number[];
  charInLine: number[];
  charCountInLine: number[];
  wordInLine: number[];
  wordCountInLine: number[];
}

function buildIndexMapsDom(result: SplitTextElements): IndexMapsDom {
  const charToWord: number[] = [];
  const charToLine: number[] = [];
  const wordToLine: number[] = [];

  if (result.chars.length && result.words.length) {
    let wi = 0;
    for (let ci = 0; ci < result.chars.length; ci++) {
      while (
        wi < result.words.length - 1 &&
        !result.words[wi].contains(result.chars[ci])
      )
        wi++;
      charToWord[ci] = wi;
    }
  }

  if (result.words.length && result.lines.length) {
    let li = 0;
    for (let wi = 0; wi < result.words.length; wi++) {
      while (
        li < result.lines.length - 1 &&
        !result.lines[li].contains(result.words[wi])
      )
        li++;
      wordToLine[wi] = li;
    }
  }

  if (result.chars.length && result.lines.length) {
    if (charToWord.length && wordToLine.length) {
      for (let ci = 0; ci < result.chars.length; ci++) {
        charToLine[ci] = wordToLine[charToWord[ci]];
      }
    } else {
      let li = 0;
      for (let ci = 0; ci < result.chars.length; ci++) {
        while (
          li < result.lines.length - 1 &&
          !result.lines[li].contains(result.chars[ci])
        )
          li++;
        charToLine[ci] = li;
      }
    }
  }

  const charInWord: number[] = [];
  const charCountInWord: number[] = [];
  const charInLine: number[] = [];
  const charCountInLine: number[] = [];
  const wordInLine: number[] = [];
  const wordCountInLine: number[] = [];

  if (charToWord.length) {
    let prev = -1;
    let counter = 0;
    for (let ci = 0; ci < charToWord.length; ci++) {
      if (charToWord[ci] !== prev) {
        counter = 0;
        prev = charToWord[ci];
      }
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
    let prev = -1;
    let counter = 0;
    for (let ci = 0; ci < charToLine.length; ci++) {
      if (charToLine[ci] !== prev) {
        counter = 0;
        prev = charToLine[ci];
      }
      charInLine[ci] = counter++;
    }
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
    let prev = -1;
    let counter = 0;
    for (let wi = 0; wi < wordToLine.length; wi++) {
      if (wordToLine[wi] !== prev) {
        counter = 0;
        prev = wordToLine[wi];
      }
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

  return {
    charToWord,
    charToLine,
    wordToLine,
    charInWord,
    charCountInWord,
    charInLine,
    charCountInLine,
    wordInLine,
    wordCountInLine,
  };
}

function buildFnInfoFromDom<TCustom = unknown>(
  elementType: SplitTypeKey,
  globalIndex: number,
  total: number,
  maps: IndexMapsDom,
  isPresent: boolean,
  custom?: TCustom
): VariantInfo<TCustom> {
  if (elementType === "chars") {
    const lineIndex = maps.charToLine.length
      ? maps.charToLine[globalIndex]
      : 0;
    const wordIndex = maps.charToWord.length
      ? maps.charToWord[globalIndex]
      : 0;
    const index = maps.charInLine.length
      ? maps.charInLine[globalIndex]
      : maps.charInWord.length
        ? maps.charInWord[globalIndex]
        : globalIndex;
    const count = maps.charCountInLine.length
      ? maps.charCountInLine[globalIndex]
      : maps.charCountInWord.length
        ? maps.charCountInWord[globalIndex]
        : total;
    return {
      index,
      count,
      globalIndex,
      globalCount: total,
      lineIndex,
      wordIndex,
      custom,
      isPresent,
    };
  }
  if (elementType === "words") {
    const lineIndex = maps.wordToLine.length
      ? maps.wordToLine[globalIndex]
      : 0;
    const index = maps.wordInLine.length
      ? maps.wordInLine[globalIndex]
      : globalIndex;
    const count = maps.wordCountInLine.length
      ? maps.wordCountInLine[globalIndex]
      : total;
    return {
      index,
      count,
      globalIndex,
      globalCount: total,
      lineIndex,
      wordIndex: globalIndex,
      custom,
      isPresent,
    };
  }
  return {
    index: globalIndex,
    count: total,
    globalIndex,
    globalCount: total,
    lineIndex: globalIndex,
    wordIndex: 0,
    custom,
    isPresent,
  };
}

type MotionAnimation = ReturnType<typeof animate>;
type MotionScrollOptions = NonNullable<Parameters<typeof scroll>[1]>;
type MotionScrollOffset = MotionScrollOptions["offset"];

type FnAnimationItem = {
  element: HTMLSpanElement;
  props: DOMKeyframesDefinition;
  transition?: AnimationOptions;
};

function buildFnItems<TCustom = unknown>(
  elements: HTMLSpanElement[],
  elementType: SplitTypeKey,
  fn: VariantResolver<TCustom>,
  maps: IndexMapsDom,
  transition: AnimationOptions | undefined,
  isPresent: boolean,
  delayScope: DelayScope,
  custom?: TCustom,
  forceInstant = false
): FnAnimationItem[] {
  const t = transition;
  const { delay: outerDelay, duration, ...rest } = t || {};
  const items: FnAnimationItem[] = [];
  const total = elements.length;
  const instantTransition = { duration: 0, delay: 0 };

  for (let i = 0; i < total; i++) {
    const info = buildFnInfoFromDom(
      elementType,
      i,
      total,
      maps,
      isPresent,
      custom
    );
    const { transition: localT, ...props } = fn(info);
    let merged: AnimationOptions | undefined;
    if (forceInstant) {
      merged = instantTransition;
    } else {
      merged = localT ? { ...rest, ...localT } : { ...rest };
      if (duration != null && merged.duration == null) {
        merged = { ...merged, duration };
      }
      const rawDelay = merged.delay ?? outerDelay;
      const resolvedDelay =
        typeof rawDelay === "function"
          ? rawDelay(
              delayScope === "local" ? info.index : info.globalIndex,
              delayScope === "local" ? info.count : info.globalCount
            )
          : rawDelay;
      if (resolvedDelay != null && Number.isFinite(resolvedDelay)) {
        merged = { ...merged, delay: resolvedDelay };
      } else if ("delay" in merged) {
        const { delay: _removed, ...restNoDelay } = merged;
        merged = restNoDelay;
      }
    }

    items.push({
      element: elements[i],
      props,
      transition:
        merged && Object.keys(merged).length ? merged : undefined,
    });
  }

  return items;
}

function animateVariant<TCustom = unknown>(
  result: SplitTextElements,
  variant: VariantDefinition<TCustom>,
  globalTransition: AnimationOptions | undefined,
  type?: string,
  isPresent = true,
  delayScope: DelayScope = "global",
  custom?: TCustom,
  forceInstant = false
): MotionAnimation[] {
  const instantTransition = { duration: 0, delay: 0 };

  if (typeof variant === "function") {
    const targetType = getTargetTypeForElements(result, type);
    const elements = result[targetType];
    if (!elements.length) return [];
    const maps = buildIndexMapsDom(result);
    const items = buildFnItems(
      elements,
      targetType,
      variant,
      maps,
      globalTransition,
      isPresent,
      delayScope,
      custom,
      forceInstant
    );
    return items.map((item) =>
      animate(item.element, item.props, item.transition)
    );
  }

  if (isPerTypeVariant(variant)) {
    const hasFnKey = ELEMENT_TYPE_KEYS.some(
      (k) => typeof variant[k] === "function"
    );

    if (hasFnKey) {
      const maps = buildIndexMapsDom(result);
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
            isPresent,
            delayScope,
            custom,
            forceInstant
          );
          fnAnimations.push(
            ...items.map((item) =>
              animate(item.element, item.props, item.transition)
            )
          );
        } else {
          const { props, transition: localT } = extractTransition(target);
          const t = forceInstant ? instantTransition : localT || globalTransition;
          staticAnimations.push(animate(result[key], props, t));
        }
      }

      return [...staticAnimations, ...fnAnimations];
    }

    const animations: MotionAnimation[] = [];
    for (const key of ELEMENT_TYPE_KEYS) {
      const target = variant[key];
      if (!target || !result[key].length || typeof target === "function")
        continue;
      const { props, transition: localT } = extractTransition(target);
      const t = forceInstant ? instantTransition : localT || globalTransition;
      animations.push(animate(result[key], props, t));
    }
    return animations;
  }

  const { props, transition: localT } = extractTransition(variant);
  const elements = getTargetElements(result, type);
  const t = forceInstant ? instantTransition : localT || globalTransition;
  return [animate(elements, props, t)];
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SplitTextProps<TCustom = unknown> {
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
  variants?: Record<string, VariantDefinition<TCustom>>;
  /** Initial variant applied instantly after split (ignores transitions on mount). Set to false to skip. */
  initial?: string | VariantDefinition<TCustom> | false;
  /** Variant to animate to immediately after split */
  animate?: string | VariantDefinition<TCustom>;
  /** Variant to animate to when entering viewport */
  whileInView?: string;
  /** Variant to animate to when leaving viewport */
  whileOutOfView?: string;
  /** Variant to animate to on exit when used inside AnimatePresence.
   *  Accepts a variant name or a full variant definition. */
  exit?: string | VariantDefinition<TCustom> | false;
  /** Variant to scroll-animate to. Animation progress is driven by scroll position.
   *  Takes priority over `animate` and `whileInView`. */
  whileScroll?: string;
  /** Scroll options for whileScroll. Configures target tracking and scroll range. */
  scroll?: ScrollPropOptions;
  /** Variant to animate to on hover */
  whileHover?: string;
  /** Variant to animate to on tap */
  whileTap?: string;
  /** Variant to animate to on focus */
  whileFocus?: string;
  /** Reduced motion handling (matches MotionConfig reducedMotion) */
  reducedMotion?: "user" | "always" | "never";
  /** Custom data forwarded to function variants and AnimatePresence */
  custom?: TCustom;
  /** Called when hover starts */
  onHoverStart?: () => void;
  /** Called when hover ends */
  onHoverEnd?: () => void;
  /** Global transition options for variant animations.
   *  Precedence: per-element fn return > per-variant transition > this global transition. */
  transition?: AnimationOptions;
  /** Controls how delay functions are resolved. "global" uses globalIndex/globalCount, "local" uses index/count. */
  delayScope?: DelayScope;
}

function parseStyleValue(styleText: string): React.CSSProperties {
  const style: React.CSSProperties = {};
  const parts = styleText.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (!part) continue;
    const [rawKey, ...rawValueParts] = part.split(":");
    if (!rawKey || rawValueParts.length === 0) continue;
    const rawValue = rawValueParts.join(":").trim();
    const key = rawKey.trim();
    if (key.startsWith("--")) {
      (style as Record<string, string>)[key] = rawValue;
      continue;
    }
    const camelKey = key.replace(/-([a-z])/g, (_, char: string) =>
      char.toUpperCase()
    );
    (style as Record<string, string>)[camelKey] = rawValue;
  }
  return style;
}

function attrsToProps(attrs: Record<string, string>): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(attrs)) {
    if (name === "class") {
      props.className = value;
      continue;
    }
    if (name === "style") {
      props.style = parseStyleValue(value);
      continue;
    }
    props[name] = value;
  }
  return props;
}

function serializeInitial(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "function") return value.toString();
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function serializeNode(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(serializeNode).join("");
  }
  if (isValidElement(node)) {
    const elementType = node.type as
      | string
      | {
          displayName?: string;
          name?: string;
        };
    const type =
      typeof elementType === "string"
        ? elementType
        : elementType.displayName || elementType.name || "Component";
    const props = node.props as Record<string, unknown> | null | undefined;
    const className =
      typeof props?.className === "string" ? props.className : "";
    return `<${type}${className ? `.${className}` : ""}>${serializeNode(
      (props as { children?: ReactNode } | undefined)?.children
    )}</${type}>`;
  }
  return "";
}

function buildSplitSignature(
  child: ReactElement,
  options: SplitTextOptions | undefined,
  initialStyles: InitialStyles | undefined,
  initialClasses: InitialClasses | undefined
): string {
  const opt = options ?? {};
  const signature = {
    type: opt.type ?? "",
    charClass: opt.charClass ?? "",
    wordClass: opt.wordClass ?? "",
    lineClass: opt.lineClass ?? "",
    mask: opt.mask ?? "",
    propIndex: !!opt.propIndex,
    disableKerning: !!opt.disableKerning,
    initialStyles: serializeInitial(initialStyles),
    initialClasses: serializeInitial(initialClasses),
    child: serializeNode(child),
  };
  try {
    return JSON.stringify(signature);
  } catch {
    return String(signature);
  }
}

function getMotionComponent(tag: string): React.ElementType {
  const registry = motion as unknown as Record<string, React.ElementType>;
  return registry[tag] ?? motion.span;
}

function collectSplitElements(
  element: HTMLElement,
  options?: SplitTextOptions
): SplitTextElements {
  const normalizeSelector = (value: string) => {
    const tokens = value.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return "";
    return `.${tokens.join(".")}`;
  };

  const charClass = normalizeSelector(options?.charClass ?? "split-char");
  const wordClass = normalizeSelector(options?.wordClass ?? "split-word");
  const lineClass = normalizeSelector(options?.lineClass ?? "split-line");

  const chars = Array.from(
    element.querySelectorAll<HTMLSpanElement>(charClass)
  );
  const words = Array.from(
    element.querySelectorAll<HTMLSpanElement>(wordClass)
  );
  const lines = Array.from(
    element.querySelectorAll<HTMLSpanElement>(lineClass)
  );

  return { chars, words, lines, revert: () => {} };
}

function buildVariantInfos<TCustom = unknown>(
  data: SplitTextData | null,
  isPresent: boolean,
  custom?: TCustom
): {
  charInfos: VariantInfo<TCustom>[];
  wordInfos: VariantInfo<TCustom>[];
  lineInfos: VariantInfo<TCustom>[];
  counts: { chars: number; words: number; lines: number };
} {
  if (!data) {
    return {
      charInfos: [],
      wordInfos: [],
      lineInfos: [],
      counts: { chars: 0, words: 0, lines: 0 },
    };
  }

  const relations = collectRelations(data.nodes);
  const maps = buildIndexMaps(relations);
  const { chars, words, lines } = relations.counts;

  const charInfos = new Array(chars)
    .fill(0)
    .map((_, index) =>
      buildVariantInfo("chars", index, chars, maps, isPresent, custom)
    );
  const wordInfos = new Array(words)
    .fill(0)
    .map((_, index) =>
      buildVariantInfo("words", index, words, maps, isPresent, custom)
    );
  const lineInfos = new Array(lines)
    .fill(0)
    .map((_, index) =>
      buildVariantInfo("lines", index, lines, maps, isPresent, custom)
    );

  return {
    charInfos,
    wordInfos,
    lineInfos,
    counts: relations.counts,
  };
}

/**
 * Motion-enabled SplitText component.
 */
type SplitTextComponent = <TCustom = unknown>(
  props: SplitTextProps<TCustom> & RefAttributes<HTMLElement>
) => ReactElement | null;

export const SplitText = forwardRef(function SplitText<TCustom>(
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
      whileOutOfView,
      whileScroll,
      exit,
      scroll: scrollProp,
      whileHover,
      whileTap,
      whileFocus,
      reducedMotion,
      custom,
      onHoverStart,
      onHoverEnd,
      transition,
      delayScope = "global",
    }: SplitTextProps<TCustom>,
  forwardedRef: ForwardedRef<HTMLElement>
) {
    const containerRef = useRef<HTMLElement>(null);
    const [childElement, setChildElement] = useState<HTMLElement | null>(null);
    const [data, setData] = useState<SplitTextData | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [isInView, setIsInView] = useState(false);
    const [isPresent, safeToRemove] = usePresence();
    const presenceEnabled = typeof safeToRemove === "function";
    const instanceId = useId();
    const prefersReducedMotion = useReducedMotion();
    const reduceMotionActive =
      reducedMotion === "always" ||
      (reducedMotion === "user" && !!prefersReducedMotion);
    const [isHovered, setIsHovered] = useState(false);
    const [isTapped, setIsTapped] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

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

    // Detect whether viewport observer is needed
    const needsViewport = !!(
      whileInView ||
      whileOutOfView ||
      onViewportEnter ||
      onViewportLeave ||
      resetOnViewportLeave ||
      viewport
    );
    const viewportAmount = viewport?.amount ?? 0;
    const viewportLeave = viewport?.leave ?? 0;
    const viewportMargin = viewport?.margin ?? "0px";
    const viewportOnce = viewport?.once ?? false;
    const viewportRoot = viewport?.root?.current ?? null;

    const inlineInitialVariant =
      initialVariant != null &&
      initialVariant !== false &&
      typeof initialVariant !== "string";
    const inlineAnimateVariant =
      animateVariantName != null && typeof animateVariantName !== "string";
    const inlineExitVariant =
      exit != null && exit !== false && typeof exit !== "string";
    const resolvedVariants = useMemo(() => {
      if (!variants && !inlineInitialVariant && !inlineAnimateVariant && !inlineExitVariant) {
        return variants;
      }
      const merged: Record<string, VariantDefinition<TCustom>> = {
        ...(variants ?? {}),
      };
      if (inlineInitialVariant) {
        merged.__fetta_initial__ = initialVariant as VariantDefinition<TCustom>;
      }
      if (inlineAnimateVariant) {
        merged.__fetta_animate__ =
          animateVariantName as VariantDefinition<TCustom>;
      }
      if (inlineExitVariant) {
        merged.__fetta_exit__ = exit as VariantDefinition<TCustom>;
      }
      return merged;
    }, [
      variants,
      inlineInitialVariant,
      inlineAnimateVariant,
      inlineExitVariant,
      initialVariant,
      animateVariantName,
      exit,
    ]);

    const initialLabel: string | false | undefined = inlineInitialVariant
      ? "__fetta_initial__"
      : (initialVariant as string | false | undefined);
    const animateLabel: string | undefined = inlineAnimateVariant
      ? "__fetta_animate__"
      : (animateVariantName as string | undefined);
    const exitLabel: string | false | undefined = inlineExitVariant
      ? "__fetta_exit__"
      : exit;
    const hasVariants = !!(
      resolvedVariants && Object.keys(resolvedVariants).length
    );
    const hasHover = !!(whileHover && hasVariants);

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
    const initialVariantRef = useRef(initialLabel);
    const whileInViewRef = useRef(whileInView);
    const whileOutOfViewRef = useRef(whileOutOfView);
    const debugPresence =
      (options as { __debugPresence?: boolean } | undefined)?.__debugPresence ===
      true;

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
      initialVariantRef.current = initialLabel;
      whileInViewRef.current = whileInView;
      whileOutOfViewRef.current = whileOutOfView;
    });

    useEffect(() => {
      if (!debugPresence) return;
      console.log(
        "[fetta][SplitText]",
        instanceId,
        "present",
        isPresent,
        "ready",
        isReady,
        "data",
        !!data
      );
    }, [debugPresence, instanceId, isPresent, isReady, data]);

    useEffect(() => {
      if (!debugPresence) return;
      console.log("[fetta][SplitText]", instanceId, "mount");
      return () => {
        console.log("[fetta][SplitText]", instanceId, "unmount");
      };
    }, [debugPresence, instanceId]);

    // Refs for tracking state
    const hasSplitRef = useRef(false);
    const hasRevertedRef = useRef(false);
    const splitResultRef = useRef<SplitTextElements | null>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);
    const hasTriggeredOnceRef = useRef(false);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lineFingerprintRef = useRef<string | null>(null);
    const originalHTMLRef = useRef<string | null>(null);
    const pendingResizeRef = useRef(false);

    useLayoutEffect(() => {
      const element = containerRef.current?.firstElementChild;
      setChildElement(element instanceof HTMLElement ? element : null);
    }, [children, data]);

    const splitSignature = useMemo(() => {
      if (!isValidElement(children)) return "";
      return buildSplitSignature(
        children,
        options,
        initialStyles,
        initialClasses
      );
    }, [children, options, initialStyles, initialClasses]);

    const lastSignatureRef = useRef<string>("");
    const pendingSignatureRef = useRef<string | null>(null);

    const resetSplitState = useCallback((nextSignature: string) => {
      hasSplitRef.current = false;
      hasRevertedRef.current = false;
      originalHTMLRef.current = null;
      lineFingerprintRef.current = null;
      pendingResizeRef.current = false;
      setData(null);
      setIsReady(false);
      lastSignatureRef.current = nextSignature;
    }, []);

    useEffect(() => {
      if (!splitSignature) return;
      if (splitSignature === lastSignatureRef.current) return;
      if (!isPresent) {
        pendingSignatureRef.current = splitSignature;
        return;
      }
      pendingSignatureRef.current = null;
      resetSplitState(splitSignature);
    }, [splitSignature, isPresent, resetSplitState]);

    useEffect(() => {
      if (!isPresent) return;
      if (!pendingSignatureRef.current) return;
      const next = pendingSignatureRef.current;
      pendingSignatureRef.current = null;
      resetSplitState(next);
    }, [isPresent, resetSplitState]);

    function setupViewportObserver(container: HTMLElement) {
      const vpOptions = viewportRef.current || {};
      const amount = vpOptions.amount ?? 0;
      const leave = vpOptions.leave ?? 0;
      const threshold = amount === "some" ? 0 : amount === "all" ? 1 : amount;
      const leaveThreshold =
        leave === "some" ? 0 : leave === "all" ? 1 : leave;
      const rootMargin = vpOptions.margin ?? "0px";
      const root = vpOptions.root?.current ?? undefined;

      const thresholdValues = Array.from(
        new Set([0, threshold, leaveThreshold])
      ).sort((a, b) => a - b);
      const thresholds =
        thresholdValues.length === 1 ? thresholdValues[0] : thresholdValues;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) return;

          const isOnce = vpOptions.once;

          if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
            if (isOnce && hasTriggeredOnceRef.current) return;
            hasTriggeredOnceRef.current = true;
            setIsInView(true);
            return;
          }

          if (isOnce) return;

          const shouldLeave =
            leaveThreshold === 0
              ? !entry.isIntersecting
              : entry.intersectionRatio <= leaveThreshold;

          if (shouldLeave) {
            setIsInView(false);
          }
        },
        { threshold: thresholds, rootMargin, root }
      );

      observerRef.current.observe(container);
    }

    const measureAndSetData = useCallback(
      (isResize = false) => {
        if (!childElement) return;

        const originalHTML =
          originalHTMLRef.current ?? childElement.innerHTML;
        originalHTMLRef.current = originalHTML;

        childElement.innerHTML = originalHTML;
        setIsReady(false);
        pendingResizeRef.current = isResize;

        const nextData = splitTextData(childElement, {
          ...optionsRef.current,
          initialStyles: initialStylesRef.current,
          initialClasses: initialClassesRef.current,
        });

        setData(nextData);
      },
      [childElement]
    );

    // Initial split
    useEffect(() => {
      if (!childElement) return;
      if (hasSplitRef.current) return;

      let isMounted = true;

      document.fonts.ready.then(() => {
        if (!isMounted || hasSplitRef.current) return;
        if (!containerRef.current) return;

        measureAndSetData();
        hasSplitRef.current = true;
      });

      return () => {
        isMounted = false;
      };
    }, [childElement, measureAndSetData]);

    // Build VariantInfo arrays for function variants
    const variantInfo = useMemo(
      () => buildVariantInfos(data, isPresent, custom),
      [data, isPresent, custom]
    );

    const targetType = useMemo(() => {
      if (!data) return "words";
      return getTargetType(data, options?.type);
    }, [data, options]);

    const orchestrationTransition = useMemo(
      () => pickOrchestration(transition),
      [transition]
    );

    const hasOrchestrationVariants = useMemo(() => {
      if (hasOrchestration(transition)) return true;
      if (!resolvedVariants) return false;
      for (const def of Object.values(resolvedVariants)) {
        if (hasOrchestration(getVariantTransition(def))) return true;
      }
      return false;
    }, [transition, resolvedVariants]);

    const childDefaultTransition = useMemo(() => {
      if (reduceMotionActive) {
        return { duration: 0, delay: 0 };
      }
      return stripOrchestration(transition);
    }, [transition, reduceMotionActive]);

    const { types: variantsByType, wrapper: wrapperVariantsByName } = useMemo(
      () =>
        buildVariantsByType(
          resolvedVariants,
          targetType,
          childDefaultTransition,
          delayScope,
          reduceMotionActive
        ),
      [
        resolvedVariants,
        targetType,
        childDefaultTransition,
        delayScope,
        reduceMotionActive,
      ]
    );

    const exitTypes = useMemo(() => {
      const exitKey = typeof exitLabel === "string" ? exitLabel : null;
      if (!exitKey) return [] as SplitTypeKey[];
      const types: SplitTypeKey[] = [];
      for (const key of ELEMENT_TYPE_KEYS) {
        const defs = (variantsByType as Partial<
          Record<SplitTypeKey, Record<string, PerTypeVariant<TCustom>>>
        >)[key];
        if (defs && exitKey in defs) {
          types.push(key);
        }
      }
      return types;
    }, [variantsByType, exitLabel]);

    const revertTypes = useMemo(() => {
      const animateKey = typeof animateLabel === "string" ? animateLabel : null;
      if (!animateKey) return [] as SplitTypeKey[];
      const types: SplitTypeKey[] = [];
      for (const key of ELEMENT_TYPE_KEYS) {
      const defs = (variantsByType as Partial<
          Record<SplitTypeKey, Record<string, PerTypeVariant<TCustom>>>
        >)[key];
        if (defs && animateKey in defs) {
          types.push(key);
        }
      }
      return types;
    }, [variantsByType, animateLabel]);

    const exitTotalCount = useMemo(() => {
      return exitTypes.reduce((sum, type) => {
        const count = variantInfo.counts[type] ?? 0;
        return sum + count;
      }, 0);
    }, [exitTypes, variantInfo.counts]);

    const revertTotalCount = useMemo(() => {
      return revertTypes.reduce((sum, type) => {
        const count = variantInfo.counts[type] ?? 0;
        return sum + count;
      }, 0);
    }, [revertTypes, variantInfo.counts]);

    const parentVariants = useMemo(() => {
      if (!resolvedVariants) return undefined;
      const entries = Object.keys(resolvedVariants);
      if (entries.length === 0) return undefined;
      const result: Record<string, VariantTarget> = {};
      for (const key of entries) {
        const wrapperVariant = wrapperVariantsByName[key];
        const def = resolvedVariants[key];
        const localOrchestration = pickOrchestration(
          getVariantTransition(def)
        );
        const wrapperBaseTransition = reduceMotionActive
          ? { duration: 0, delay: 0 }
          : stripOrchestration(transition);
        const applyWrapperTransition = (target: VariantTarget) => {
          if (!wrapperBaseTransition) return target;
          if (target.transition) {
            return {
              ...target,
              transition: { ...wrapperBaseTransition, ...target.transition },
            };
          }
          return { ...target, transition: wrapperBaseTransition };
        };
        if (wrapperVariant) {
          if (typeof wrapperVariant === "function") {
            const resolved = wrapperVariant({ custom });
            result[key] = reduceMotionActive
              ? { ...resolved, transition: { duration: 0, delay: 0 } }
              : applyWrapperTransition(resolved);
          } else {
            const resolved = reduceMotionActive
              ? { ...wrapperVariant, transition: { duration: 0, delay: 0 } }
              : wrapperVariant;
            result[key] = applyWrapperTransition(resolved);
          }
          continue;
        }
        const transitionValue = reduceMotionActive
          ? { duration: 0, delay: 0 }
          : orchestrationTransition || localOrchestration
            ? {
                ...(orchestrationTransition ?? {}),
                ...(localOrchestration ?? {}),
              }
            : undefined;
        result[key] = transitionValue ? { transition: transitionValue } : {};
      }
      return result;
    }, [
      resolvedVariants,
      orchestrationTransition,
      reduceMotionActive,
      wrapperVariantsByName,
      custom,
    ]);

    const [activeVariant, setActiveVariant] = useState<string | undefined>(
      animateLabel
    );

    useEffect(() => {
      if (!hasHover) {
        setIsHovered(false);
      }
    }, [hasHover]);

    const hasTap = !!(whileTap && hasVariants);
    const hasFocus = !!(whileFocus && hasVariants);

    useEffect(() => {
      if (!hasTap) {
        setIsTapped(false);
      }
    }, [hasTap]);

    useEffect(() => {
      if (!hasFocus) {
        setIsFocused(false);
      }
    }, [hasFocus]);

    const exitTrackerRef = useRef({
      isPresent: true,
      total: 0,
      completed: 0,
      session: 0,
    });
    const revertTrackerRef = useRef({
      total: 0,
      completed: 0,
    });

    useEffect(() => {
      exitTrackerRef.current.isPresent = isPresent;
    }, [isPresent]);

    useEffect(() => {
      if (!presenceEnabled) return;
      const tracker = exitTrackerRef.current;
      tracker.session += 1;
      tracker.completed = 0;
      tracker.total = exitTotalCount;

      if (isPresent) return;
      if (!exitLabel || exitTotalCount === 0) {
        safeToRemove?.();
      }
    }, [presenceEnabled, isPresent, exitLabel, exitTotalCount, safeToRemove]);

    const handleExitComplete = useCallback(
      (definition?: string | VariantTarget) => {
        if (!presenceEnabled) return;
        const tracker = exitTrackerRef.current;
        if (tracker.isPresent) return;
        if (typeof exitLabel !== "string") return;
        if (definition !== exitLabel) return;
        tracker.completed += 1;
        if (tracker.completed >= tracker.total) {
          safeToRemove?.();
        }
      },
      [presenceEnabled, exitLabel, safeToRemove]
    );

    const handleHoverStart = useCallback(() => {
      if (hasHover) {
        setIsHovered(true);
      }
      onHoverStart?.();
    }, [hasHover, onHoverStart]);

    const handleHoverEnd = useCallback(() => {
      if (hasHover) {
        setIsHovered(false);
      }
      onHoverEnd?.();
    }, [hasHover, onHoverEnd]);

    const handleTapStart = useCallback(() => {
      if (hasTap) {
        setIsTapped(true);
      }
    }, [hasTap]);

    const handleTapCancel = useCallback(() => {
      if (hasTap) {
        setIsTapped(false);
      }
    }, [hasTap]);

    const handleTapEnd = useCallback(() => {
      if (hasTap) {
        setIsTapped(false);
      }
    }, [hasTap]);

    const handleFocus = useCallback(() => {
      if (hasFocus) {
        setIsFocused(true);
      }
    }, [hasFocus]);

    const handleBlur = useCallback(() => {
      if (hasFocus) {
        setIsFocused(false);
      }
    }, [hasFocus]);

    useEffect(() => {
      if (!hasVariants) return;
      if (!resolvedVariants) return;

      if (!isPresent) return;

      if (whileScroll) return;

      const vDefs = resolvedVariants;
      if (isInView) {
        const inViewName = whileInViewRef.current;
        if (inViewName && vDefs[inViewName]) {
          setActiveVariant(inViewName);
          return;
        }
      } else {
        const outName = whileOutOfViewRef.current;
        if (outName && vDefs[outName] && hasTriggeredOnceRef.current) {
          setActiveVariant(outName);
          return;
        }

        if (!viewportRef.current?.once && resetOnViewportLeaveRef.current) {
          const initName = initialVariantRef.current;
          if (initName && typeof initName === "string" && vDefs[initName]) {
            setActiveVariant(initName);
            return;
          }
        }
      }

      const animateName = animateLabel;
      if (animateName && vDefs[animateName]) {
        setActiveVariant(animateName);
      }
    }, [
      isInView,
      hasVariants,
      resolvedVariants,
      animateLabel,
      whileScroll,
      isPresent,
    ]);

    useEffect(() => {
      if (!data || !childElement) return;

      const splitElements = collectSplitElements(childElement, optionsRef.current);
      const revert = () => {
        if (hasRevertedRef.current) return;
        if (originalHTMLRef.current && childElement) {
          childElement.innerHTML = originalHTMLRef.current;
        }
        hasRevertedRef.current = true;
        setData(null);
        setIsReady(true);
      };

      splitResultRef.current = { ...splitElements, revert };

      const fingerprint = splitElements.lines
        .map((line) => line.textContent || "")
        .join("\n");
      if (pendingResizeRef.current && onResizeRef.current) {
        if (lineFingerprintRef.current !== fingerprint) {
          onResizeRef.current({
            chars: splitElements.chars,
            words: splitElements.words,
            lines: splitElements.lines,
            revert,
          });
        }
        pendingResizeRef.current = false;
      }
      lineFingerprintRef.current = fingerprint;

      setIsReady(true);

      if (onSplitRef.current) {
        const callbackResult = onSplitRef.current(splitResultRef.current);
        const shouldRevert =
          !hasVariants && !needsViewport && revertOnCompleteRef.current;
        if (shouldRevert) {
          const promise = normalizeToPromise(callbackResult);
          if (promise) {
            promise
              .then(() => {
                if (hasRevertedRef.current) return;
                splitResultRef.current?.revert();
              })
              .catch(() => {
                console.warn("[fetta] Animation rejected, text not reverted");
              });
          } else if (callbackResult !== undefined) {
            console.warn(
              "SplitText: revertOnComplete is enabled but onSplit did not return an animation or promise."
            );
          }
        }
      }

      return undefined;
    }, [data, childElement, needsViewport]);

    useEffect(() => {
      if (!needsViewport) {
        if (observerRef.current) {
          observerRef.current.disconnect();
          observerRef.current = null;
        }
        return;
      }
      if (!containerRef.current) return;
      if (!data) return;

      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      setupViewportObserver(containerRef.current);

      return () => {
        if (observerRef.current) {
          observerRef.current.disconnect();
          observerRef.current = null;
        }
      };
    }, [
      data,
      needsViewport,
      viewportAmount,
      viewportLeave,
      viewportMargin,
      viewportOnce,
      viewportRoot,
    ]);

    const shouldRevertOnComplete =
      hasVariants &&
      !!animateLabel &&
      !whileInView &&
      !needsViewport &&
      !whileScroll &&
      revertOnComplete;

    const pendingRevertRef = useRef<string | null>(null);
    useEffect(() => {
      if (!shouldRevertOnComplete) {
        pendingRevertRef.current = null;
        revertTrackerRef.current.total = 0;
        revertTrackerRef.current.completed = 0;
        return;
      }
      pendingRevertRef.current = animateLabel ?? null;
      const tracker = revertTrackerRef.current;
      tracker.total = revertTotalCount;
      tracker.completed = 0;

      if (revertTotalCount === 0) {
        splitResultRef.current?.revert();
        pendingRevertRef.current = null;
      }
    }, [shouldRevertOnComplete, animateLabel, revertTotalCount]);

    const handleRevertComplete = useCallback(
      (definition?: string | VariantTarget) => {
        const label = pendingRevertRef.current;
        if (!label) return;
        if (typeof definition === "string" && definition !== label) {
          return;
        }
        const tracker = revertTrackerRef.current;
        tracker.completed += 1;
        if (tracker.completed >= tracker.total) {
          splitResultRef.current?.revert();
          pendingRevertRef.current = null;
        }
      },
      []
    );

    useEffect(() => {
      if (!autoSplit || !containerRef.current) return;

      let skipFirst = true;
      const target = containerRef.current;
      let lastWidth: number | null = null;

      const handleResize = () => {
        if (!childElement || !data) return;

        const currentWidth = target.offsetWidth;
        if (currentWidth === lastWidth) return;
        lastWidth = currentWidth;

        if (resizeTimerRef.current) {
          clearTimeout(resizeTimerRef.current);
        }
        resizeTimerRef.current = setTimeout(() => {
          measureAndSetData(true);
        }, 200);
      };

      resizeObserverRef.current = new ResizeObserver(() => {
        if (skipFirst) {
          skipFirst = false;
          return;
        }
        handleResize();
      });

      resizeObserverRef.current.observe(target);
      lastWidth = target.offsetWidth;

      return () => {
        if (resizeObserverRef.current) {
          resizeObserverRef.current.disconnect();
          resizeObserverRef.current = null;
        }
        if (resizeTimerRef.current) {
          clearTimeout(resizeTimerRef.current);
          resizeTimerRef.current = null;
        }
      };
    }, [autoSplit, childElement, data, measureAndSetData]);

    useEffect(() => {
      if (!splitResultRef.current) return;
      if (!needsViewport) return;

      if (isInView && onViewportEnterRef.current) {
        const callbackResult = onViewportEnterRef.current(
          splitResultRef.current
        );
        const promise = normalizeToPromise(callbackResult);

        if (revertOnCompleteRef.current && promise) {
          promise
            .then(() => {
              splitResultRef.current?.revert();
            })
            .catch(() => {
              console.warn("[fetta] Animation rejected, text not reverted");
            });
        }
        return;
      }

      if (!isInView) {
        if (!hasVariants && resetOnViewportLeaveRef.current) {
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

        if (onViewportLeaveRef.current) {
          onViewportLeaveRef.current(splitResultRef.current);
        }
      }
    }, [isInView, needsViewport]);

    useEffect(() => {
      if (!whileScroll) return;
      if (!resolvedVariants) return;
      if (!splitResultRef.current) return;

      const variantName = whileScroll;
      const def = resolvedVariants[variantName];
      if (!def) return;

      if (reduceMotionActive) {
        animateVariant(
          splitResultRef.current,
          def,
          { duration: 0, delay: 0 },
          optionsRef.current?.type,
          isPresent,
          delayScope,
          custom,
          true
        );
        return;
      }

      const animations = animateVariant(
        splitResultRef.current,
        def,
        transition,
        optionsRef.current?.type,
        isPresent,
        delayScope,
        custom
      );

      const scrollOpts = scrollProp;
      const cleanups = animations.map((anim) =>
        scroll(anim, {
          target: containerRef.current ?? undefined,
          offset: scrollOpts?.offset,
          axis: scrollOpts?.axis,
          container: scrollOpts?.container?.current ?? undefined,
        })
      );

      return () => {
        for (const cleanup of cleanups) cleanup();
      };
    }, [
      data,
      isPresent,
      whileScroll,
      resolvedVariants,
      transition,
      scrollProp,
      delayScope,
      reduceMotionActive,
      custom,
    ]);

    if (!isValidElement(children)) {
      console.error("SplitText: children must be a single valid React element");
      return null;
    }

    const counters = { char: 0, word: 0, line: 0 };
    const exitProp = exitLabel === false ? undefined : exitLabel;
    const hoverVariant = hasHover ? whileHover : undefined;
    const tapVariant = hasTap ? whileTap : undefined;
    const focusVariant = hasFocus ? whileFocus : undefined;
    const hasWrapperVariants = Object.keys(wrapperVariantsByName).length > 0;
    const interactionVariant =
      (isTapped && tapVariant) ||
      (isFocused && focusVariant) ||
      (isHovered && hoverVariant) ||
      undefined;
    const displayVariant = interactionVariant ?? activeVariant;
    const shouldInheritVariants =
      hasOrchestrationVariants ||
      !!whileScroll ||
      hasHover ||
      hasTap ||
      hasFocus ||
      hasWrapperVariants;
    const childInitial =
      shouldInheritVariants || initialLabel === undefined
        ? undefined
        : initialLabel;
    const childAnimate =
      shouldInheritVariants || !hasVariants || !isReady
        ? undefined
        : displayVariant;
    const wrapperVariants = shouldInheritVariants ? parentVariants : undefined;
    const wrapperInitial =
      shouldInheritVariants && initialLabel !== undefined
        ? initialLabel
        : undefined;
    const wrapperAnimate =
      shouldInheritVariants && hasVariants && isReady
        ? displayVariant
        : undefined;
    const wrapperExit = shouldInheritVariants ? exitProp : undefined;
    const wrapperTransition =
      shouldInheritVariants && hasVariants
        ? reduceMotionActive
          ? { duration: 0, delay: 0 }
          : orchestrationTransition
        : undefined;

    function renderNode(node: SplitTextDataNode, key: string): ReactNode {
      if (node.type === "text") {
        return node.text;
      }

      const props = attrsToProps(node.attrs);

      if (node.split) {
        const splitType = node.split === "char"
          ? "chars"
          : node.split === "word"
            ? "words"
            : "lines";
        const isChar = splitType === "chars";
        const isWord = splitType === "words";
        const index = isChar
          ? counters.char++
          : isWord
            ? counters.word++
            : counters.line++;
        const info = isChar
          ? variantInfo.charInfos[index]
          : isWord
            ? variantInfo.wordInfos[index]
            : variantInfo.lineInfos[index];
        const MotionTag = getMotionComponent(node.tag);
        const variantsForType = (variantsByType as Record<string, unknown>)[
          splitType
        ] as Record<string, PerTypeVariant<TCustom>> | undefined;
        const needsExitTracking =
          presenceEnabled &&
          typeof exitLabel === "string" &&
          variantsForType &&
          exitLabel in variantsForType;
        const animateKey = typeof animateLabel === "string" ? animateLabel : null;
        const needsRevertTracking =
          shouldRevertOnComplete &&
          !!animateKey &&
          variantsForType &&
          animateKey in variantsForType;
        const onCompleteHandler =
          needsExitTracking || needsRevertTracking
            ? (definition?: string | VariantTarget) => {
                if (needsExitTracking) {
                  handleExitComplete(definition);
                }
                if (needsRevertTracking) {
                  handleRevertComplete(definition);
                }
              }
            : undefined;

        return createElement(
          MotionTag,
          {
            key,
            ...props,
            custom: info,
            variants: variantsForType,
            initial: childInitial,
            animate: childAnimate,
            exit: exitProp,
            onAnimationComplete: onCompleteHandler,
          },
          renderNodes(node.children, key)
        );
      }

      return createElement(
        node.tag,
        { key, ...props },
        renderNodes(node.children, key)
      );
    }

    function renderNodes(nodes: SplitTextDataNode[], keyPrefix: string) {
      return nodes.map((node, index) =>
        renderNode(node, `${keyPrefix}-${index}`)
      );
    }

    const child = data
      ? (() => {
          const childProps: Record<string, unknown> = {
            ...(children.props as Record<string, unknown>),
          };
          if ("dangerouslySetInnerHTML" in childProps) {
            delete (childProps as { dangerouslySetInnerHTML?: unknown })
              .dangerouslySetInnerHTML;
          }
          if (data.meta.useAriaLabel && data.meta.ariaLabel) {
            childProps["aria-label"] = data.meta.ariaLabel;
          }
          return createElement(
            children.type,
            childProps,
            renderNodes(data.nodes, "split")
          );
        })()
      : children;

    const Wrapper = getMotionComponent(Component);

    const content = createElement(
      Wrapper,
      {
        ref: mergedRef,
        className,
        style: {
          visibility: isReady ? "visible" : "hidden",
          position: "relative",
          ...userStyle,
        },
        variants: wrapperVariants,
        initial: wrapperInitial,
        animate: wrapperAnimate,
        custom,
        exit: wrapperExit,
        transition: wrapperTransition,
        onHoverStart: handleHoverStart,
        onHoverEnd: handleHoverEnd,
        onTapStart: handleTapStart,
        onTapCancel: handleTapCancel,
        onTap: handleTapEnd,
        onFocus: handleFocus,
        onBlur: handleBlur,
      },
      child
    );

    if (reducedMotion) {
      return createElement(MotionConfig, { reducedMotion }, content);
    }

    return content;
}) as SplitTextComponent;
