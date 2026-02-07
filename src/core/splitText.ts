/**
 * Custom splitText implementation with built-in kerning compensation.
 * Measures kerning between character pairs, splits text into spans,
 * applies margin compensation, and detects lines based on rendered positions.
 */

import { renderSplitTextData } from "../internal/splitTextRender";

// Tags whose implicit ARIA role allows aria-label (headings, landmarks, interactive elements).
// Other elements (span, div, p, etc.) use a sr-only copy instead.
const ARIA_LABEL_ALLOWED_TAGS = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6",
  "a", "button", "img", "input", "select", "textarea",
  "table", "figure", "form", "fieldset", "dialog", "details",
  "section", "article", "nav", "aside", "header", "footer", "main",
]);

/**
 * Configuration options for the splitText function.
 *
 * @example
 * ```typescript
 * const options: SplitTextOptions = {
 *   type: "chars,words,lines",
 *   charClass: "char",
 *   mask: "lines",
 *   autoSplit: true,
 * };
 * ```
 */
export interface SplitTextOptions {
  /** Split type: chars, words, lines, or combinations like "chars,words" */
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
  /** Auto-split on resize (observes parent element) */
  autoSplit?: boolean;
  /** Callback when resize triggers re-split (does not re-trigger initial animations) */
  onResize?: (result: Omit<SplitTextResult, "revert" | "dispose">) => void;
  /** Callback fired after text is split, receives split elements. Return animation for revertOnComplete. */
  onSplit?: (result: {
    chars: HTMLSpanElement[];
    words: HTMLSpanElement[];
    lines: HTMLSpanElement[];
  }) =>
    | void
    | { finished: Promise<unknown> }
    | Array<{ finished: Promise<unknown> }>
    | Promise<unknown>;
  /** Auto-revert when onSplit animation completes */
  revertOnComplete?: boolean;
  /** Add CSS custom properties (--char-index, --word-index, --line-index) */
  propIndex?: boolean;
  /** Skip kerning compensation (no margin adjustments applied).
   * Kerning is naturally lost when splitting into inline-block spans.
   * Use this if you prefer no compensation over imperfect Safari compensation. */
  disableKerning?: boolean;
  /** Apply initial inline styles to elements after split (and after kerning compensation).
   * Can be a static style object or a function that receives (element, index). */
  initialStyles?: {
    chars?: InitialStyle;
    words?: InitialStyle;
    lines?: InitialStyle;
  };
  /** Apply initial classes to elements after split (and after kerning compensation).
   * Classes are added via classList.add() and support space-separated class names. */
  initialClasses?: {
    chars?: string;
    words?: string;
    lines?: string;
  };
}

/** Style value for initialStyles - a partial CSSStyleDeclaration object */
type InitialStyleValue = Partial<CSSStyleDeclaration>;

/** Function that returns styles based on element and index */
type InitialStyleFn = (element: HTMLElement, index: number) => InitialStyleValue;

/** Initial style can be a static object or a function */
type InitialStyle = InitialStyleValue | InitialStyleFn;

/**
 * Result returned by splitText containing arrays of split elements and a revert function.
 *
 * Each array contains the created span elements. Empty arrays are returned for
 * split types not requested (e.g., if `type: "words"`, chars and lines will be empty).
 */
export interface SplitTextResult {
  /** Array of character span elements (empty if chars not in type) */
  chars: HTMLSpanElement[];
  /** Array of word span elements (empty if words not in type) */
  words: HTMLSpanElement[];
  /** Array of line span elements (empty if lines not in type) */
  lines: HTMLSpanElement[];
  /** Revert the element to its original HTML and cleanup all observers/timers */
  revert: () => void;
}

// ---------------------------------------------------------------------------
// Data-only split output (internal)
// ---------------------------------------------------------------------------

type SplitRole = "char" | "word" | "line";

export type SplitTextDataNode =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "element";
      tag: string;
      attrs: Record<string, string>;
      children: SplitTextDataNode[];
      split?: SplitRole;
    };

export interface SplitTextData {
  nodes: SplitTextDataNode[];
  meta: {
    text: string;
    type: SplitTextOptions["type"];
    mask?: SplitTextOptions["mask"];
    charClass: string;
    wordClass: string;
    lineClass: string;
    propIndex: boolean;
    useAriaLabel: boolean;
    ariaLabel: string | null;
  };
}

/**
 * Internal data-only splitter.
 *
 * Performs a temporary split for measurement, serializes the result, and
 * restores the element to its original HTML/ARIA/styles.
 */
export function splitTextData(
  element: HTMLElement,
  {
    type = "chars,words,lines",
    charClass = "split-char",
    wordClass = "split-word",
    lineClass = "split-line",
    mask,
    propIndex = false,
    disableKerning = false,
    initialStyles,
    initialClasses,
  }: SplitTextOptions = {}
): SplitTextData {
  if (!(element instanceof HTMLElement)) {
    throw new Error("splitTextData: element must be an HTMLElement");
  }

  const text = element.textContent?.trim() ?? "";
  if (!text) {
    console.warn("splitTextData: element has no text content");
    return {
      nodes: [],
      meta: {
        text: "",
        type,
        mask,
        charClass,
        wordClass,
        lineClass,
        propIndex,
        useAriaLabel: false,
        ariaLabel: null,
      },
    };
  }

  const originalHTML = element.innerHTML;
  const originalAriaLabel = element.getAttribute("aria-label");
  const originalStyle = element.getAttribute("style");

  // Parse type option into flags
  let splitChars = type.includes("chars");
  let splitWords = type.includes("words");
  let splitLines = type.includes("lines");

  if (!splitChars && !splitWords && !splitLines) {
    console.warn(
      'splitTextData: type must include at least one of: chars, words, lines. Defaulting to "chars,words,lines".'
    );
    splitChars = splitWords = splitLines = true;
  }

  // If splitting chars, force disable ligatures for consistency
  if (splitChars) {
    element.style.fontVariantLigatures = "none";
  }

  const trackAncestors = hasInlineDescendants(element);
  const measuredWords = collectTextStructure(element, trackAncestors);

  // Perform the split
  const useAriaLabel =
    !trackAncestors &&
    ARIA_LABEL_ALLOWED_TAGS.has(element.tagName.toLowerCase());

  performSplit(
    element,
    measuredWords,
    charClass,
    wordClass,
    lineClass,
    splitChars,
    splitWords,
    splitLines,
    {
      propIndex,
      mask,
      ariaHidden: useAriaLabel,
      disableKerning,
      initialStyles,
      initialClasses,
    }
  );

  // Accessibility: mirror core split behavior
  if (trackAncestors) {
    injectSrOnlyStyles();

    const visualWrapper = document.createElement("span");
    visualWrapper.setAttribute("aria-hidden", "true");
    visualWrapper.dataset.fettaVisual = "true";

    while (element.firstChild) {
      visualWrapper.appendChild(element.firstChild);
    }
    element.appendChild(visualWrapper);
    element.appendChild(createScreenReaderCopy(originalHTML));
  } else if (useAriaLabel) {
    if (originalAriaLabel === null) {
      element.setAttribute("aria-label", text);
    }
  } else {
    injectSrOnlyStyles();

    const visualWrapper = document.createElement("span");
    visualWrapper.setAttribute("aria-hidden", "true");
    visualWrapper.dataset.fettaVisual = "true";

    while (element.firstChild) {
      visualWrapper.appendChild(element.firstChild);
    }
    element.appendChild(visualWrapper);
    element.appendChild(createScreenReaderCopy(originalHTML));
  }

  const nodes = serializeChildren(element, { charClass, wordClass, lineClass });
  const ariaLabel = element.getAttribute("aria-label");

  // Restore original element state
  element.innerHTML = originalHTML;

  if (originalAriaLabel !== null) {
    element.setAttribute("aria-label", originalAriaLabel);
  } else {
    element.removeAttribute("aria-label");
  }

  if (originalStyle !== null) {
    element.setAttribute("style", originalStyle);
  } else {
    element.removeAttribute("style");
  }

  return {
    nodes,
    meta: {
      text,
      type,
      mask,
      charClass,
      wordClass,
      lineClass,
      propIndex,
      useAriaLabel,
      ariaLabel,
    },
  };
}

/**
 * Information about an ancestor inline element that wraps a text node.
 * Used to preserve nested elements like <a>, <em>, <strong> when splitting.
 */
interface AncestorInfo {
  tagName: string;                    // e.g., 'em', 'a', 'strong'
  attributes: Map<string, string>;    // all attributes preserved
  instanceId: symbol;                 // unique ID per element instance
}

interface MeasuredChar {
  char: string;
  ancestors: AncestorInfo[];  // ancestor chain from innermost to outermost
}

interface MeasuredWord {
  chars: MeasuredChar[];
  /** If true, no space should be added before this word (e.g., continuation after dash) */
  noSpaceBefore: boolean;
}

// Characters that act as break points (word can wrap after these)
const BREAK_CHARS = new Set([
  "—", // em-dash
  "–", // en-dash
  "-", // hyphen
  "/", // slash
  "‒", // figure dash (U+2012)
  "―", // horizontal bar (U+2015)
]);

// Regex to detect scripts with contextual shaping where kerning measurement breaks
// Arabic, Hebrew, Thai, Devanagari, and other complex scripts
const CONTEXTUAL_SCRIPT_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF\uFB1D-\uFB4F\u0E00-\u0E7F\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F]/;

/**
 * Check if text contains scripts with contextual shaping.
 * These scripts have letters that change form based on position,
 * making character-by-character kerning measurement inaccurate.
 */
function hasContextualScript(chars: string[]): boolean {
  return chars.some(char => CONTEXTUAL_SCRIPT_REGEX.test(char));
}

// Inline elements that should be preserved when splitting text
const INLINE_ELEMENTS = new Set([
  'a', 'abbr', 'acronym', 'b', 'bdi', 'bdo', 'big', 'cite', 'code',
  'data', 'del', 'dfn', 'em', 'i', 'ins', 'kbd', 'mark', 'q', 's',
  'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var',
]);


/**
 * Text-related CSS properties that can affect glyph metrics/kerning.
 * Keep this list focused to avoid unnecessary work while ensuring accuracy.
 */
const KERNING_STYLE_PROPS = [
  "font",
  "font-kerning",
  "font-variant-ligatures",
  "font-feature-settings",
  "font-variation-settings",
  "font-optical-sizing",
  "font-size-adjust",
  "font-stretch",
  "font-variant-caps",
  "font-variant-numeric",
  "font-variant-east-asian",
  "font-synthesis",
  "font-synthesis-weight",
  "font-synthesis-style",
  "letter-spacing",
  "word-spacing",
  "text-rendering",
  "text-transform",
  "direction",
  "unicode-bidi",
] as const;

function copyKerningStyles(
  target: HTMLElement,
  styles: CSSStyleDeclaration
): void {
  KERNING_STYLE_PROPS.forEach((prop) => {
    const value = styles.getPropertyValue(prop);
    if (value) target.style.setProperty(prop, value);
  });
}

function buildKerningStyleKey(styles: CSSStyleDeclaration): string {
  return KERNING_STYLE_PROPS.map((prop) => styles.getPropertyValue(prop)).join("|");
}

// Detect Safari browser (cached)
let isSafariBrowser: boolean | null = null;
function isSafari(): boolean {
  if (isSafariBrowser !== null) return isSafariBrowser;
  if (typeof navigator === 'undefined') return false;
  isSafariBrowser = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  return isSafariBrowser;
}

/**
 * Measure kerning using DOM elements.
 * Slower but accurate - inherits all styles including -webkit-font-smoothing.
 * Used for Safari where font-smoothing affects glyph metrics.
 */
function measureKerningDOM(
  container: HTMLElement,
  styleSource: HTMLElement,
  chars: string[],
  styles?: CSSStyleDeclaration
): Map<number, number> {
  const kerningMap = new Map<number, number>();
  if (chars.length < 2) return kerningMap;

  const measurer = document.createElement('span');
  measurer.style.cssText = `
    position: absolute;
    visibility: hidden;
    white-space: pre;
  `;

  const computedStyles = styles ?? getComputedStyle(styleSource);
  copyKerningStyles(measurer, computedStyles);

  // Copy font smoothing (critical for Safari)
  // @ts-expect-error - webkit property
  const webkitSmoothing = computedStyles.webkitFontSmoothing || computedStyles['-webkit-font-smoothing'];
  // @ts-expect-error - moz property
  const mozSmoothing = computedStyles.MozOsxFontSmoothing || computedStyles['-moz-osx-font-smoothing'];
  if (webkitSmoothing) {
    // @ts-expect-error - webkit property
    measurer.style.webkitFontSmoothing = webkitSmoothing;
  }
  if (mozSmoothing) {
    // @ts-expect-error - moz property
    measurer.style.MozOsxFontSmoothing = mozSmoothing;
  }

  container.appendChild(measurer);

  // Measure unique chars first (deduplicated)
  const charWidths = new Map<string, number>();
  for (const char of new Set(chars)) {
    measurer.textContent = char;
    charWidths.set(char, measurer.getBoundingClientRect().width);
  }

  // Measure pairs and calculate kerning
  for (let i = 0; i < chars.length - 1; i++) {
    const char1 = chars[i];
    const char2 = chars[i + 1];

    measurer.textContent = char1 + char2;
    const pairWidth = measurer.getBoundingClientRect().width;
    const kerning = pairWidth - charWidths.get(char1)! - charWidths.get(char2)!;

    if (Math.abs(kerning) > 0.001) {
      kerningMap.set(i + 1, kerning);
    }
  }

  container.removeChild(measurer);
  return kerningMap;
}

/**
 * Measure kerning using Range API on text nodes.
 * Faster than DOM element measurement — avoids box model computation.
 * Used for non-Safari browsers (Chrome, Firefox, Edge).
 */
function measureKerningRange(
  container: HTMLElement,
  styleSource: HTMLElement,
  chars: string[],
  styles?: CSSStyleDeclaration
): Map<number, number> {
  const kerningMap = new Map<number, number>();
  if (chars.length < 2) return kerningMap;

  const measurer = document.createElement('span');
  measurer.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;';

  const computedStyles = styles ?? getComputedStyle(styleSource);
  copyKerningStyles(measurer, computedStyles);
  container.appendChild(measurer);

  const range = document.createRange();
  const measureWidth = (): number => {
    const textNode = measurer.firstChild;
    if (!textNode) return 0;
    range.selectNodeContents(textNode);
    return range.getBoundingClientRect().width;
  };

  // Measure unique chars first (deduplicated)
  const charWidths = new Map<string, number>();
  for (const char of new Set(chars)) {
    measurer.textContent = char;
    charWidths.set(char, measureWidth());
  }

  // Measure pairs and calculate kerning
  for (let i = 0; i < chars.length - 1; i++) {
    const char1 = chars[i];
    const char2 = chars[i + 1];
    measurer.textContent = char1 + char2;
    const kerning = measureWidth() - charWidths.get(char1)! - charWidths.get(char2)!;
    if (Math.abs(kerning) > 0.001) {
      kerningMap.set(i + 1, kerning);
    }
  }

  range.detach();
  container.removeChild(measurer);
  return kerningMap;
}

/**
 * Measure kerning between character pairs.
 * Uses Range API for speed in Chrome/Firefox/Edge.
 * Uses DOM measurement in Safari for accuracy with font-smoothing.
 */
function measureKerning(
  container: HTMLElement,
  styleSource: HTMLElement,
  chars: string[],
  styles?: CSSStyleDeclaration
): Map<number, number> {
  if (chars.length < 2) return new Map();

  if (!container.isConnected) {
    console.warn('splitText: kerning measurement requires a connected DOM element. Skipping kerning.');
    return new Map();
  }

  const computedStyles = styles ?? getComputedStyle(styleSource);

  // Safari needs DOM-based measurement for font-smoothing accuracy.
  return isSafari()
    ? measureKerningDOM(container, styleSource, chars, computedStyles)
    : measureKerningRange(container, styleSource, chars, computedStyles);
}

// Track whether screen reader styles have been injected
let srOnlyStylesInjected = false;

/**
 * Inject screen reader only CSS styles into the document.
 * Only injects once per page load.
 */
function injectSrOnlyStyles(): void {
  if (srOnlyStylesInjected || typeof document === 'undefined') return;

  const style = document.createElement('style');
  style.textContent = `
.fetta-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border-width: 0;
}`;
  document.head.appendChild(style);
  srOnlyStylesInjected = true;
}

/**
 * Create a screen reader only copy of the original HTML.
 * Preserves semantic structure (links, emphasis, etc.) for assistive technology.
 */
function createScreenReaderCopy(originalHTML: string): HTMLSpanElement {
  const srCopy = document.createElement('span');
  srCopy.className = 'fetta-sr-only';
  srCopy.innerHTML = originalHTML;
  srCopy.dataset.fettaSrCopy = 'true';
  return srCopy;
}

/**
 * Check if element contains any inline element descendants.
 * Used for early detection to skip ancestor tracking when not needed.
 */
function hasInlineDescendants(element: HTMLElement): boolean {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT);
  let node: Element | null;
  while ((node = walker.nextNode() as Element | null)) {
    if (INLINE_ELEMENTS.has(node.tagName.toLowerCase())) {
      return true;
    }
  }
  return false;
}

/**
 * Check if two ancestor chains are equal (same elements in same order).
 */
function ancestorChainsEqual(a: AncestorInfo[], b: AncestorInfo[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].instanceId !== b[i].instanceId) return false;
  }
  return true;
}

/**
 * Group adjacent characters by their ancestor chain.
 * Returns array of { ancestors, chars } groups.
 */
function groupCharsByAncestors(
  chars: MeasuredChar[]
): { ancestors: AncestorInfo[]; chars: MeasuredChar[] }[] {
  if (chars.length === 0) return [];

  const groups: { ancestors: AncestorInfo[]; chars: MeasuredChar[] }[] = [];
  let currentGroup: MeasuredChar[] = [chars[0]];
  let currentAncestors = chars[0].ancestors;

  for (let i = 1; i < chars.length; i++) {
    const char = chars[i];
    if (ancestorChainsEqual(char.ancestors, currentAncestors)) {
      currentGroup.push(char);
    } else {
      groups.push({ ancestors: currentAncestors, chars: currentGroup });
      currentGroup = [char];
      currentAncestors = char.ancestors;
    }
  }

  groups.push({ ancestors: currentAncestors, chars: currentGroup });
  return groups;
}

/**
 * Clone an ancestor element with its tag and all attributes.
 */
function cloneAncestorAsWrapper(info: AncestorInfo): HTMLElement {
  const el = document.createElement(info.tagName);
  info.attributes.forEach((value, key) => {
    el.setAttribute(key, value);
  });
  return el;
}

/**
 * Wrap content in nested ancestor elements (innermost to outermost order).
 */
function wrapInAncestors(content: Node, ancestors: AncestorInfo[]): Node {
  if (ancestors.length === 0) return content;

  // Build from innermost (first) to outermost (last)
  let wrapped: Node = content;
  for (let i = 0; i < ancestors.length; i++) {
    const wrapper = cloneAncestorAsWrapper(ancestors[i]);
    wrapper.appendChild(wrapped);
    wrapped = wrapper;
  }
  return wrapped;
}

// ---------------------------------------------------------------------------
// Data serialization helpers (internal)
// ---------------------------------------------------------------------------

function hasAllClasses(element: Element, className: string | undefined): boolean {
  if (!className) return false;
  const tokens = className.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((token) => element.classList.contains(token));
}

function getSplitRole(
  element: Element,
  classInfo: { charClass: string; wordClass: string; lineClass: string }
): SplitRole | undefined {
  if (hasAllClasses(element, classInfo.charClass)) return "char";
  if (hasAllClasses(element, classInfo.wordClass)) return "word";
  if (hasAllClasses(element, classInfo.lineClass)) return "line";
  return undefined;
}

function serializeNode(
  node: Node,
  classInfo: { charClass: string; wordClass: string; lineClass: string }
): SplitTextDataNode | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return {
      type: "text",
      text: node.textContent ?? "",
    };
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const element = node as Element;
  const attrs: Record<string, string> = {};
  for (const attr of Array.from(element.attributes)) {
    attrs[attr.name] = attr.value;
  }

  const children: SplitTextDataNode[] = [];
  element.childNodes.forEach((child) => {
    const serialized = serializeNode(child, classInfo);
    if (serialized) children.push(serialized);
  });

  const split = getSplitRole(element, classInfo);

  return {
    type: "element",
    tag: element.tagName.toLowerCase(),
    attrs,
    children,
    split,
  };
}

function serializeChildren(
  element: Element,
  classInfo: { charClass: string; wordClass: string; lineClass: string }
): SplitTextDataNode[] {
  const nodes: SplitTextDataNode[] = [];
  element.childNodes.forEach((child) => {
    const serialized = serializeNode(child, classInfo);
    if (serialized) nodes.push(serialized);
  });
  return nodes;
}

/**
 * Normalize various animation return types to a Promise.
 *
 * Handles multiple animation library formats:
 * - Motion: objects with `.finished` property (Promise)
 * - GSAP: thenables with `.then()` method
 * - Arrays: waits for all animations via Promise.all
 * - Raw Promises: returned as-is
 *
 * @param value - Animation result from onSplit callback (Motion animation, GSAP timeline, Promise, or array)
 * @returns Promise that resolves when animation completes, or null if value is not a recognized animation type
 *
 * @example
 * ```typescript
 * // Motion animation
 * const promise = normalizeToPromise(animate(el, { opacity: 1 }));
 *
 * // GSAP timeline
 * const promise = normalizeToPromise(gsap.to(el, { opacity: 1 }));
 *
 * // Array of animations
 * const promise = normalizeToPromise([anim1, anim2]);
 * ```
 */
export function normalizeToPromise(value: unknown): Promise<unknown> | null {
  if (!value) return null;
  if (value instanceof Promise) return value;
  if (typeof value === "object") {
    // Motion: { finished: Promise }
    if ("finished" in value) {
      return (value as { finished: Promise<unknown> }).finished;
    }
    // GSAP and other thenables: { then: Function }
    if ("then" in value && typeof (value as { then: unknown }).then === "function") {
      return Promise.resolve(value);
    }
  }
  if (Array.isArray(value)) {
    const promises = value
      .map(normalizeToPromise)
      .filter((p): p is Promise<unknown> => p !== null);
    return promises.length ? Promise.all(promises) : null;
  }
  return null;
}

// Module-level cache for Intl.Segmenter
let segmenterCache: Intl.Segmenter | null = null;

/**
 * Segment text into grapheme clusters (properly handles emoji, accented chars, etc.)
 * Uses Intl.Segmenter for modern browsers.
 */
function segmentGraphemes(text: string): string[] {
  if (!segmenterCache) {
    segmenterCache = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  }
  return [...segmenterCache.segment(text)].map((s) => s.segment);
}

/**
 * Build ancestor chain for a text node, walking up to the root element.
 * Uses a cache to ensure consistent instanceId for each element.
 */
function buildAncestorChain(
  textNode: Text,
  rootElement: HTMLElement,
  ancestorCache: WeakMap<Element, AncestorInfo>
): AncestorInfo[] {
  const ancestors: AncestorInfo[] = [];
  let current: Node | null = textNode.parentNode;

  while (current && current !== rootElement && current instanceof Element) {
    const tagName = current.tagName.toLowerCase();

    // Only include inline elements
    if (INLINE_ELEMENTS.has(tagName)) {
      // Check cache first for consistent instanceId
      let info = ancestorCache.get(current);
      if (!info) {
        const attributes = new Map<string, string>();
        for (const attr of current.attributes) {
          attributes.set(attr.name, attr.value);
        }
        info = {
          tagName,
          attributes,
          instanceId: Symbol(),
        };
        ancestorCache.set(current, info);
      }
      ancestors.push(info);
    }

    current = current.parentNode;
  }

  return ancestors;
}

/**
 * Collect text structure from element.
 * Splits at whitespace AND after em-dashes/en-dashes for natural wrapping.
 * Preserves ancestor chain for each character to support nested inline elements.
 *
 * @param trackAncestors - When false, skips ancestor chain building for better performance
 */
function collectTextStructure(
  element: HTMLElement,
  trackAncestors: boolean
): MeasuredWord[] {
  const words: MeasuredWord[] = [];

  // Only create ancestor cache if we need to track ancestors
  const ancestorCache = trackAncestors ? new WeakMap<Element, AncestorInfo>() : null;

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node: Text | null;

  let currentWord: MeasuredChar[] = [];
  let noSpaceBeforeNext = false;

  const pushWord = () => {
    if (currentWord.length > 0) {
      words.push({
        chars: currentWord,
        noSpaceBefore: noSpaceBeforeNext,
      });
      currentWord = [];
      noSpaceBeforeNext = false;
    }
  };

  // Reusable empty array for chars without ancestors (avoids allocations)
  const emptyAncestors: AncestorInfo[] = [];

  while ((node = walker.nextNode() as Text | null)) {
    const text = node.textContent || "";

    // Build ancestor chain only if tracking is enabled
    const ancestors = trackAncestors
      ? buildAncestorChain(node, element, ancestorCache!)
      : emptyAncestors;

    // Segment into grapheme clusters for proper emoji/complex character handling
    const graphemes = segmentGraphemes(text);

    for (const grapheme of graphemes) {
      // Whitespace = word boundary (with space before next word)
      if (grapheme === " " || grapheme === "\n" || grapheme === "\t") {
        pushWord();
        // Reset noSpaceBeforeNext - explicit space overrides dash continuation
        noSpaceBeforeNext = false;
        continue;
      }

      currentWord.push({ char: grapheme, ancestors });

      // Break AFTER dash characters (dash stays with preceding text)
      if (BREAK_CHARS.has(grapheme)) {
        pushWord();
        noSpaceBeforeNext = true; // Next word continues without space
      }
    }
  }

  // Don't forget the last word
  pushWord();

  return words;
}

/**
 * Create a span element with optional class and index.
 */
function createSpan(
  className?: string,
  index?: number,
  display: "inline-block" | "block" = "inline-block",
  options?: { propIndex?: boolean; propName?: string; ariaHidden?: boolean }
): HTMLSpanElement {
  const span = document.createElement("span");

  if (className) {
    span.className = className;
  }

  if (index !== undefined && options?.propName) {
    span.setAttribute(`data-${options.propName}-index`, index.toString());

    // Add CSS custom property if propIndex enabled
    if (options.propIndex) {
      span.style.setProperty(`--${options.propName}-index`, index.toString());
    }
  }

  span.style.display = display;
  span.style.position = "relative";
  // Inherit text-decoration so underlines from parent <a> tags work with inline-block
  span.style.textDecoration = "inherit";

  // Hide from screen readers (for simple text, aria-label on parent provides accessible name)
  if (options?.ariaHidden) {
    span.setAttribute("aria-hidden", "true");
  }

  return span;
}

/**
 * Create a mask wrapper element with overflow: clip for reveal animations.
 */
function createMaskWrapper(
  display: "inline-block" | "block" = "inline-block"
): HTMLSpanElement {
  const wrapper = document.createElement("span");
  wrapper.style.display = display;
  wrapper.style.position = "relative";
  wrapper.style.overflow = "clip";
  return wrapper;
}

// Styles that should NOT be overridden (internal layout)
const PROTECTED_STYLES = new Set([
  'display',
  'position',
  'textDecoration',
  'fontVariantLigatures',
]);

/**
 * Apply initial styles to elements after split.
 * Protects internal layout styles from being overridden.
 */
function applyInitialStyles(
  elements: HTMLElement[],
  style: InitialStyle
): void {
  if (!style || elements.length === 0) return;

  const isFn = typeof style === 'function';

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const styles = isFn ? style(el, i) : style;

    for (const [key, value] of Object.entries(styles)) {
      if (!PROTECTED_STYLES.has(key) && value !== undefined) {
        (el.style as unknown as Record<string, unknown>)[key] = value;
      }
    }
  }
}

/**
 * Apply initial classes to elements after split.
 * Supports space-separated class names.
 */
function applyInitialClasses(
  elements: HTMLElement[],
  className: string
): void {
  if (!className || elements.length === 0) return;
  const classes = className.split(/\s+/).filter(Boolean);
  for (const el of elements) {
    el.classList.add(...classes);
  }
}

/**
 * Group elements into lines based on their Y position.
 * Generic function that works with any element type (word spans, char spans, or text nodes).
 */
function groupIntoLines<T extends HTMLElement | Text>(
  elements: T[],
  element: HTMLElement
): T[][] {
  const fontSize = parseFloat(getComputedStyle(element).fontSize);
  const tolerance = Math.max(5, fontSize * 0.3);

  const lineGroups: T[][] = [];
  let currentLine: T[] = [];
  let currentY: number | null = null;

  elements.forEach((el) => {
    // Get Y position - for text nodes, use parent's bounding rect
    const rect = el instanceof HTMLElement
      ? el.getBoundingClientRect()
      : el.parentElement!.getBoundingClientRect();
    const y = Math.round(rect.top);

    if (currentY === null) {
      currentY = y;
      currentLine.push(el);
    } else if (Math.abs(y - currentY) < tolerance) {
      currentLine.push(el);
    } else {
      lineGroups.push(currentLine);
      currentLine = [el];
      currentY = y;
    }
  });

  if (currentLine.length > 0) {
    lineGroups.push(currentLine);
  }

  return lineGroups;
}

/**
 * Internal function that performs the actual splitting logic.
 * Can be called both initially and on resize.
 */
function performSplit(
  element: HTMLElement,
  measuredWords: MeasuredWord[],
  charClass: string,
  wordClass: string,
  lineClass: string,
  splitChars: boolean,
  splitWords: boolean,
  splitLines: boolean,
  options?: {
    propIndex?: boolean;
    mask?: "lines" | "words" | "chars";
    ariaHidden?: boolean;
    disableKerning?: boolean;
    initialStyles?: SplitTextOptions['initialStyles'];
    initialClasses?: SplitTextOptions['initialClasses'];
  }
): {
  chars: HTMLSpanElement[];
  words: HTMLSpanElement[];
  lines: HTMLSpanElement[];
} {
  // Clear element
  element.textContent = "";

  const allChars: HTMLSpanElement[] = [];
  const allWords: HTMLSpanElement[] = [];

  // Simplification: When splitting chars, we ALWAYS need word wrappers for proper spacing
  // We'll create word spans internally, but only return them if user requested words
  const needWordWrappers = splitChars || splitWords;

  // Branch based on whether we need word wrappers
  if (needWordWrappers) {
    // ========== PATH 1: KEEP WORD WRAPPERS ==========

    const noSpaceBeforeSet = new Set<HTMLSpanElement>();

    // Track word-level ancestors (when all chars in a word share the same ancestors)
    const wordLevelAncestors = new Map<HTMLSpanElement, AncestorInfo[]>();

    // Global character index counter (for propIndex across all words)
    let globalCharIndex = 0;

    // Create word spans (with char spans or text content)
    measuredWords.forEach((measuredWord, wordIndex) => {
      const wordSpan = createSpan(wordClass, wordIndex, "inline-block", {
        propIndex: options?.propIndex,
                propName: "word",
        ariaHidden: options?.ariaHidden,
      });

      if (measuredWord.noSpaceBefore) {
        noSpaceBeforeSet.add(wordSpan);
      }

      if (splitChars) {
        // Fast path: check if any char has ancestors before grouping
        const hasAnyAncestors = measuredWord.chars.some(c => c.ancestors.length > 0);

        if (!hasAnyAncestors) {
          // No ancestors - skip grouping, create char spans directly
          measuredWord.chars.forEach((measuredChar, charIndexInWord) => {
            const charSpan = createSpan(charClass, globalCharIndex, "inline-block", {
              propIndex: options?.propIndex,
                            propName: "char",
              ariaHidden: options?.ariaHidden,
            });
            charSpan.textContent = measuredChar.char;
            globalCharIndex++;

            // Wrap char in mask wrapper if mask === "chars"
            if (options?.mask === "chars") {
              const charWrapper = createMaskWrapper("inline-block");
              charWrapper.appendChild(charSpan);
              wordSpan.appendChild(charWrapper);
            } else {
              wordSpan.appendChild(charSpan);
            }
            allChars.push(charSpan);
          });
        } else {
          // Has ancestors - use grouping logic
          const charGroups = groupCharsByAncestors(measuredWord.chars);

          // Check if all chars share the same ancestors (single group with ancestors)
          const hasWordLevelAncestors = charGroups.length === 1 && charGroups[0].ancestors.length > 0;

          if (hasWordLevelAncestors) {
            // Store word-level ancestors - we'll wrap at word level later
            wordLevelAncestors.set(wordSpan, charGroups[0].ancestors);
          }

          charGroups.forEach((group) => {
            group.chars.forEach((measuredChar) => {
              const charSpan = createSpan(charClass, globalCharIndex, "inline-block", {
                propIndex: options?.propIndex,
                                propName: "char",
              });
              charSpan.textContent = measuredChar.char;
              globalCharIndex++;

              // Wrap char in mask wrapper if mask === "chars"
              if (options?.mask === "chars") {
                const charWrapper = createMaskWrapper("inline-block");
                charWrapper.appendChild(charSpan);
                wordSpan.appendChild(charWrapper);
              } else {
                wordSpan.appendChild(charSpan);
              }
              allChars.push(charSpan);
            });

            // Only wrap at char-group level if there are mixed ancestors within the word
            if (!hasWordLevelAncestors && group.ancestors.length > 0) {
              // Mixed ancestors within word - wrap this char group
              const charsToWrap = Array.from(wordSpan.childNodes);
              const lastNChars = charsToWrap.slice(-group.chars.length);

              // Remove them from wordSpan
              lastNChars.forEach((node) => wordSpan.removeChild(node));

              // Wrap them in ancestors
              const fragment = document.createDocumentFragment();
              lastNChars.forEach((node) => fragment.appendChild(node));
              const wrapped = wrapInAncestors(fragment, group.ancestors);
              wordSpan.appendChild(wrapped);
            }
          });
        }
      } else {
        // Fast path: check if any char has ancestors before grouping
        const hasAnyAncestors = measuredWord.chars.some(c => c.ancestors.length > 0);

        if (!hasAnyAncestors) {
          // No ancestors - just set text content directly
          wordSpan.textContent = measuredWord.chars.map((c) => c.char).join("");
        } else {
          // Has ancestors - use grouping logic
          const charGroups = groupCharsByAncestors(measuredWord.chars);

          // Check if all chars share the same ancestors
          const hasWordLevelAncestors = charGroups.length === 1 && charGroups[0].ancestors.length > 0;

          if (hasWordLevelAncestors) {
            // Store word-level ancestors - we'll wrap at word level later
            wordLevelAncestors.set(wordSpan, charGroups[0].ancestors);
            // Just add text content without wrapping
            wordSpan.textContent = measuredWord.chars.map((c) => c.char).join("");
          } else {
            // Mixed ancestors - wrap at char-group level
            charGroups.forEach((group) => {
              const text = group.chars.map((c) => c.char).join("");
              const textNode = document.createTextNode(text);

              if (group.ancestors.length > 0) {
                const wrapped = wrapInAncestors(textNode, group.ancestors);
                wordSpan.appendChild(wrapped);
              } else {
                wordSpan.appendChild(textNode);
              }
            });
          }
        }
      }

      allWords.push(wordSpan);
    });

    // Add words to DOM, grouping adjacent words with same word-level ancestors
    let i = 0;
    while (i < allWords.length) {
      const wordSpan = allWords[i];
      const ancestors = wordLevelAncestors.get(wordSpan);

      if (ancestors && ancestors.length > 0) {
        // Find all adjacent words with the same ancestor chain
        const wordGroup: HTMLSpanElement[] = [wordSpan];
        let j = i + 1;
        while (j < allWords.length) {
          const nextWordSpan = allWords[j];
          const nextAncestors = wordLevelAncestors.get(nextWordSpan);
          // Check if next word has same ancestors AND no space-breaking dash between them
          if (nextAncestors && ancestorChainsEqual(ancestors, nextAncestors)) {
            wordGroup.push(nextWordSpan);
            j++;
          } else {
            break;
          }
        }

        // Create a single ancestor wrapper for the entire group
        const fragment = document.createDocumentFragment();
        wordGroup.forEach((ws, idx) => {
          if (options?.mask === "words") {
            const wordWrapper = createMaskWrapper("inline-block");
            wordWrapper.appendChild(ws);
            fragment.appendChild(wordWrapper);
          } else {
            fragment.appendChild(ws);
          }
          // Add space between words in the group (if not last and no noSpaceBefore)
          if (idx < wordGroup.length - 1 && !noSpaceBeforeSet.has(wordGroup[idx + 1])) {
            fragment.appendChild(document.createTextNode(" "));
          }
        });

        const wrapped = wrapInAncestors(fragment, ancestors);
        element.appendChild(wrapped);

        // Add space after the group if needed
        if (j < allWords.length && !noSpaceBeforeSet.has(allWords[j])) {
          element.appendChild(document.createTextNode(" "));
        }

        i = j;
      } else {
        // No word-level ancestors, add directly
        if (options?.mask === "words") {
          const wordWrapper = createMaskWrapper("inline-block");
          wordWrapper.appendChild(wordSpan);
          element.appendChild(wordWrapper);
        } else {
          element.appendChild(wordSpan);
        }
        // Add space after if needed
        if (i < allWords.length - 1 && !noSpaceBeforeSet.has(allWords[i + 1])) {
          element.appendChild(document.createTextNode(" "));
        }
        i++;
      }
    }

    // Apply kerning compensation (skip if disableKerning is true)
    if (!options?.disableKerning && splitChars && allWords.length > 0) {
      // 1. Measure kerning within each word
      for (const wordSpan of allWords) {
        const wordChars = Array.from(wordSpan.querySelectorAll<HTMLSpanElement>(`.${charClass}`));
        if (wordChars.length < 2) continue;

        // Skip kerning for contextual scripts (Arabic, Hebrew, Thai, etc.)
        // These scripts have letters that change form based on position,
        // making character-by-character kerning measurement inaccurate.
        const charStringsForCheck = wordChars.map(c => c.textContent || '');
        if (hasContextualScript(charStringsForCheck)) continue;

        // Group consecutive chars by computed style to respect nested inline styles.
        const styleGroups: Array<{
          chars: HTMLSpanElement[];
          styleSource: HTMLSpanElement;
          styles: CSSStyleDeclaration;
        }> = [];

        const firstCharStyles = getComputedStyle(wordChars[0]);
        let currentKey = buildKerningStyleKey(firstCharStyles);
        let currentGroup: { chars: HTMLSpanElement[]; styleSource: HTMLSpanElement; styles: CSSStyleDeclaration } = {
          chars: [wordChars[0]],
          styleSource: wordChars[0],
          styles: firstCharStyles,
        };

        for (let i = 1; i < wordChars.length; i++) {
          const char = wordChars[i];
          const charStyles = getComputedStyle(char);
          const key = buildKerningStyleKey(charStyles);
          if (key === currentKey) {
            currentGroup.chars.push(char);
          } else {
            styleGroups.push(currentGroup);
            currentKey = key;
            currentGroup = { chars: [char], styleSource: char, styles: charStyles };
          }
        }
        styleGroups.push(currentGroup);

        // Measure kerning per style group (no kerning across style boundaries)
        for (const group of styleGroups) {
          if (group.chars.length < 2) continue;
          const charStrings = group.chars.map(c => c.textContent || '');
          const kerningMap = measureKerning(element, group.styleSource, charStrings, group.styles);

          // Apply kerning adjustments (negative = tighter, positive = looser)
          for (const [charIndex, kerning] of kerningMap) {
            const charSpan = group.chars[charIndex];
            // Apply with sanity bound (< 20px in either direction)
            if (charSpan && Math.abs(kerning) < 20) {
              // Apply margin to the char span itself
              // (or its mask wrapper parent if present)
              const targetElement = options?.mask === "chars" && charSpan.parentElement
                ? charSpan.parentElement
                : charSpan;
              targetElement.style.marginLeft = `${kerning}px`;
            }
          }
        }
      }

      // 2. Measure kerning across word boundaries (lastChar + space + firstChar)
      for (let wordIdx = 1; wordIdx < allWords.length; wordIdx++) {
        // Skip words that don't have a space before them (dash continuations)
        if (noSpaceBeforeSet.has(allWords[wordIdx])) continue;

        const prevWord = allWords[wordIdx - 1];
        const currWord = allWords[wordIdx];
        const prevChars = Array.from(prevWord.querySelectorAll<HTMLSpanElement>(`.${charClass}`));
        const currChars = Array.from(currWord.querySelectorAll<HTMLSpanElement>(`.${charClass}`));

        if (prevChars.length === 0 || currChars.length === 0) continue;

        const lastCharSpan = prevChars[prevChars.length - 1];
        const firstCharSpan = currChars[0];
        const lastChar = lastCharSpan.textContent || '';
        const firstChar = firstCharSpan.textContent || '';
        if (!lastChar || !firstChar) continue;

        // Skip kerning for contextual scripts
        if (hasContextualScript([lastChar, firstChar])) continue;

        // Measure the full cross-word kerning: "lastChar + space + firstChar"
        // Total kerning = width("X Y") - width("X") - width(" ") - width("Y")
        const styles = getComputedStyle(firstCharSpan);
        const kerningMap = measureKerning(element, firstCharSpan, [lastChar, " ", firstChar], styles);

        // kerningMap will have kerning at index 1 (space) and index 2 (firstChar)
        // We apply the sum to the first char of the next word
        let totalKerning = 0;
        if (kerningMap.has(1)) totalKerning += kerningMap.get(1)!;
        if (kerningMap.has(2)) totalKerning += kerningMap.get(2)!;

        if (Math.abs(totalKerning) > 0.001 && Math.abs(totalKerning) < 20) {
          const targetElement = options?.mask === "chars" && firstCharSpan.parentElement
            ? firstCharSpan.parentElement
            : firstCharSpan;
          targetElement.style.marginLeft = `${totalKerning}px`;
        }
      }
    } else if (!options?.disableKerning && splitWords && allWords.length > 1) {
      // Cross-word kerning for word-only splitting (no char spans)
      // Apply margin to the word span itself
      for (let wordIdx = 1; wordIdx < allWords.length; wordIdx++) {
        if (noSpaceBeforeSet.has(allWords[wordIdx])) continue;

        const prevWord = allWords[wordIdx - 1];
        const currWord = allWords[wordIdx];

        const prevText = prevWord.textContent || '';
        const currText = currWord.textContent || '';
        if (!prevText || !currText) continue;

        // Get last char of previous word and first char of current word
        const lastChar = prevText[prevText.length - 1];
        const firstChar = currText[0];

        // Skip kerning for contextual scripts
        if (hasContextualScript([lastChar, firstChar])) continue;

        // Measure the full cross-word kerning
        const styles = getComputedStyle(currWord);
        const kerningMap = measureKerning(element, currWord, [lastChar, " ", firstChar], styles);

        let totalKerning = 0;
        if (kerningMap.has(1)) totalKerning += kerningMap.get(1)!;
        if (kerningMap.has(2)) totalKerning += kerningMap.get(2)!;

        if (Math.abs(totalKerning) > 0.001 && Math.abs(totalKerning) < 20) {
          const targetElement = options?.mask === "words" && currWord.parentElement
            ? currWord.parentElement
            : currWord;
          targetElement.style.marginLeft = `${totalKerning}px`;
        }
      }
    }

    // Handle line grouping
    if (splitLines) {
      const lineGroups = groupIntoLines(allWords, element);
      element.textContent = "";

      const allLines: HTMLSpanElement[] = [];
      lineGroups.forEach((words, lineIndex) => {
        const lineSpan = createSpan(lineClass, lineIndex, "block", {
          propIndex: options?.propIndex,
                    propName: "line",
          ariaHidden: options?.ariaHidden,
        });

        allLines.push(lineSpan);

        // Add words to line, grouping adjacent words with same word-level ancestors
        let wi = 0;
        while (wi < words.length) {
          const wordSpan = words[wi];
          const ancestors = wordLevelAncestors.get(wordSpan);

          if (ancestors && ancestors.length > 0) {
            // Find all adjacent words in this line with the same ancestor chain
            const wordGroup: HTMLSpanElement[] = [wordSpan];
            let wj = wi + 1;
            while (wj < words.length) {
              const nextWordSpan = words[wj];
              const nextAncestors = wordLevelAncestors.get(nextWordSpan);
              if (nextAncestors && ancestorChainsEqual(ancestors, nextAncestors)) {
                wordGroup.push(nextWordSpan);
                wj++;
              } else {
                break;
              }
            }

            // Create a single ancestor wrapper for the group
            const fragment = document.createDocumentFragment();
            wordGroup.forEach((ws, idx) => {
              if (options?.mask === "words") {
                const wordWrapper = createMaskWrapper("inline-block");
                wordWrapper.appendChild(ws);
                fragment.appendChild(wordWrapper);
              } else {
                fragment.appendChild(ws);
              }
              // Add space between words in the group
              if (idx < wordGroup.length - 1 && !noSpaceBeforeSet.has(wordGroup[idx + 1])) {
                fragment.appendChild(document.createTextNode(" "));
              }
            });

            const wrapped = wrapInAncestors(fragment, ancestors);
            lineSpan.appendChild(wrapped);

            // Add space after the group if needed
            if (wj < words.length && !noSpaceBeforeSet.has(words[wj])) {
              lineSpan.appendChild(document.createTextNode(" "));
            }

            wi = wj;
          } else {
            // No word-level ancestors, add directly
            if (options?.mask === "words") {
              const wordWrapper = createMaskWrapper("inline-block");
              wordWrapper.appendChild(wordSpan);
              lineSpan.appendChild(wordWrapper);
            } else {
              lineSpan.appendChild(wordSpan);
            }
            // Add space after if needed
            if (wi < words.length - 1 && !noSpaceBeforeSet.has(words[wi + 1])) {
              lineSpan.appendChild(document.createTextNode(" "));
            }
            wi++;
          }
        }

        // Wrap line in mask wrapper if mask === "lines"
        if (options?.mask === "lines") {
          const lineWrapper = createMaskWrapper("block");
          lineWrapper.appendChild(lineSpan);
          element.appendChild(lineWrapper);
        } else {
          element.appendChild(lineSpan);
        }
      });

      // Apply initial styles after kerning, before returning
      if (options?.initialStyles) {
        const { chars, words, lines } = options.initialStyles;
        if (chars) applyInitialStyles(allChars, chars);
        if (words) applyInitialStyles(allWords, words);
        if (lines) applyInitialStyles(allLines, lines);
      }

      // Apply initial classes
      if (options?.initialClasses) {
        const { chars, words, lines } = options.initialClasses;
        if (chars) applyInitialClasses(allChars, chars);
        if (words) applyInitialClasses(allWords, words);
        if (lines) applyInitialClasses(allLines, lines);
      }

      // Return only what user requested (words might have been created internally for spacing)
      return {
        chars: allChars,
        words: splitWords ? allWords : [],
        lines: allLines,
      };
    }

    // Apply initial styles after kerning, before returning
    if (options?.initialStyles) {
      const { chars, words } = options.initialStyles;
      if (chars) applyInitialStyles(allChars, chars);
      if (words) applyInitialStyles(allWords, words);
    }

    // Apply initial classes
    if (options?.initialClasses) {
      const { chars, words } = options.initialClasses;
      if (chars) applyInitialClasses(allChars, chars);
      if (words) applyInitialClasses(allWords, words);
    }

    // Return only what user requested (words might have been created internally for spacing)
    return {
      chars: allChars,
      words: splitWords ? allWords : [],
      lines: [],
    };
  } else {
    // ========== PATH 2: LINES ONLY (no chars, no words) ==========

    if (splitLines) {
        // Create text nodes and group into lines
        interface WordWrapper {
          wrapper: HTMLSpanElement;
          wordIndex: number;
        }
        const wordWrappers: WordWrapper[] = [];

        measuredWords.forEach((measuredWord, idx) => {
          const textNode = document.createTextNode(
            measuredWord.chars.map((c) => c.char).join("")
          );

          // Wrap each word for measurement
          const wrapper = document.createElement("span");
          wrapper.style.display = "inline";
          wrapper.appendChild(textNode);
          element.appendChild(wrapper);

          wordWrappers.push({ wrapper, wordIndex: idx });

          // Add space after wrapper
          if (
            idx < measuredWords.length - 1 &&
            !measuredWords[idx + 1].noSpaceBefore
          ) {
            const spaceNode = document.createTextNode(" ");
            element.appendChild(spaceNode);
          }
        });

        // Group into lines
        const lineGroups = groupIntoLines(wordWrappers.map(w => w.wrapper), element);
        element.textContent = "";

        const allLines: HTMLSpanElement[] = [];
        lineGroups.forEach((wrappers, lineIndex) => {
          const lineSpan = createSpan(lineClass, lineIndex, "block", {
            propIndex: options?.propIndex,
                        propName: "line",
          });

          allLines.push(lineSpan);

          // Extract text from wrappers and add spaces
          wrappers.forEach((wrapper, wrapperIdx) => {
            // Extract text node from wrapper
            while (wrapper.firstChild) {
              lineSpan.appendChild(wrapper.firstChild);
            }

            // Add space after if needed
            if (wrapperIdx < wrappers.length - 1) {
              const nextWrapper = wrappers[wrapperIdx + 1];
              const nextWordInfo = wordWrappers.find(w => w.wrapper === nextWrapper);

              if (nextWordInfo && !measuredWords[nextWordInfo.wordIndex].noSpaceBefore) {
                lineSpan.appendChild(document.createTextNode(" "));
              }
            }
          });

          // Wrap line in mask wrapper if mask === "lines"
          if (options?.mask === "lines") {
            const lineWrapper = createMaskWrapper("block");
            lineWrapper.appendChild(lineSpan);
            element.appendChild(lineWrapper);
          } else {
            element.appendChild(lineSpan);
          }
        });

      // Apply initial styles for lines only
      if (options?.initialStyles?.lines) {
        applyInitialStyles(allLines, options.initialStyles.lines);
      }

      // Apply initial classes for lines only
      if (options?.initialClasses?.lines) {
        applyInitialClasses(allLines, options.initialClasses.lines);
      }

      return { chars: [], words: [], lines: allLines };
    } else {
      // Just text - nothing to split
      const fullText = measuredWords
        .map((w) => w.chars.map((c) => c.char).join(""))
        .join(" ");
      element.textContent = fullText;

      return { chars: [], words: [], lines: [] };
    }
  }
}

/**
 * Split text into characters, words, and lines with kerning compensation.
 *
 * Fetta measures character positions before splitting, then applies margin adjustments
 * after splitting to preserve the original kerning (letter spacing). This prevents
 * the visual "jumping" that occurs with naive text splitting.
 *
 * @param element - The HTML element containing text to split. Must have text content.
 * @param options - Configuration options for splitting behavior
 * @returns Object containing arrays of split elements and a revert function
 *
 * @throws {Error} If element is not an HTMLElement
 *
 * @example
 * ```typescript
 * import { splitText } from "fetta";
 * import { animate, stagger } from "motion";
 *
 * // Basic usage
 * const { chars, words, lines, revert } = splitText(element);
 *
 * // Animate words
 * animate(words, { opacity: [0, 1], y: [20, 0] }, { delay: stagger(0.05) });
 *
 * // Revert to original HTML when done
 * revert();
 * ```
 *
 * @example
 * ```typescript
 * // Auto-revert after animation completes
 * splitText(element, {
 *   onSplit: ({ words }) => animate(words, { opacity: [0, 1] }),
 *   revertOnComplete: true,
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Responsive re-splitting
 * splitText(element, {
 *   autoSplit: true,
 *   onResize: ({ lines }) => {
 *     // Re-animate after resize
 *     animate(lines, { opacity: [0, 1] });
 *   },
 * });
 * ```
 */
export function splitText(
  element: HTMLElement,
  {
    type = "chars,words,lines",
    charClass = "split-char",
    wordClass = "split-word",
    lineClass = "split-line",
    mask,
    autoSplit = false,
    onResize,
    onSplit,
    revertOnComplete = false,
    propIndex = false,
    disableKerning = false,
    initialStyles,
    initialClasses,
  }: SplitTextOptions = {}
): SplitTextResult {
  // Validation
  if (!(element instanceof HTMLElement)) {
    throw new Error("splitText: element must be an HTMLElement");
  }

  const text = element.textContent?.trim();
  if (!text) {
    console.warn("splitText: element has no text content");
    return {
      chars: [],
      words: [],
      lines: [],
      revert: () => {},
    };
  }

  if (autoSplit && !element.parentElement) {
    console.warn(
      "splitText: autoSplit requires a parent element. AutoSplit will not work."
    );
  }

  // Store original HTML for revert
  const originalHTML = element.innerHTML;
  const originalAriaLabel = element.getAttribute("aria-label");

  // Parse type option into flags
  let splitChars = type.includes("chars");
  let splitWords = type.includes("words");
  let splitLines = type.includes("lines");

  // Validate at least one type is selected
  if (!splitChars && !splitWords && !splitLines) {
    console.warn(
      'splitText: type must include at least one of: chars, words, lines. Defaulting to "chars,words,lines".'
    );
    splitChars = splitWords = splitLines = true;
  }

  // State management (closure-based)
  let isActive = true;
  let resizeObserver: ResizeObserver | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastWidth: number | null = null;

  // Store current split result (needed for autoSplit)
  let currentChars: HTMLSpanElement[] = [];
  let currentWords: HTMLSpanElement[] = [];
  let currentLines: HTMLSpanElement[] = [];
  let useAriaLabel = false;

  const applyData = (data: SplitTextData) => {
    const rendered = renderSplitTextData(element, data);
    currentChars = rendered.chars;
    currentWords = rendered.words;
    currentLines = rendered.lines;
    useAriaLabel = data.meta.useAriaLabel;

    if (useAriaLabel) {
      if (data.meta.ariaLabel != null) {
        element.setAttribute("aria-label", data.meta.ariaLabel);
      } else {
        element.removeAttribute("aria-label");
      }
    } else if (originalAriaLabel !== null) {
      element.setAttribute("aria-label", originalAriaLabel);
    }

    // If splitting chars, force disable ligatures for consistency
    if (splitChars) {
      element.style.fontVariantLigatures = "none";
    }
  };

  const initialData = splitTextData(element, {
    type,
    charClass,
    wordClass,
    lineClass,
    mask,
    propIndex,
    disableKerning,
    initialStyles,
    initialClasses,
  });
  applyData(initialData);

  // Cleanup function to disconnect observers and timers
  const dispose = () => {
    if (!isActive) return;

    // Disconnect observer
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }

    // Clear debounce timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    isActive = false;
  };

  // Revert function with automatic disposal
  const revert = () => {
    if (!isActive) return;

    element.innerHTML = originalHTML;

    // aria-hidden wrapper and sr-copy are removed by innerHTML reset
    // Restore original aria-label state for supported elements
    if (useAriaLabel) {
      if (originalAriaLabel !== null) {
        element.setAttribute("aria-label", originalAriaLabel);
      } else {
        element.removeAttribute("aria-label");
      }
    }

    // Keep ligatures disabled if we split chars (prevents visual shift on revert)
    if (splitChars) {
      element.style.fontVariantLigatures = "none";
    }

    // Auto-dispose when reverted
    dispose();
  };

  // Setup autoSplit if enabled
  if (autoSplit) {
    const target = element.parentElement;

    if (!target) {
      console.warn(
        "SplitText: autoSplit enabled but no parent element found. AutoSplit will not work."
      );
    } else {
      let skipFirst = true;

      // Helper to get line structure fingerprint (text content of each line)
      const getLineFingerprint = (lines: HTMLSpanElement[]): string => {
        return lines.map((line) => line.textContent || "").join("\n");
      };

      const handleResize = () => {
        if (!isActive) return;

        // Auto-dispose if element was removed from DOM
        if (!element.isConnected) {
          dispose();
          return;
        }

        const currentWidth = target.offsetWidth;
        if (currentWidth === lastWidth) return;
        lastWidth = currentWidth;

        // Capture current line structure before re-splitting
        const previousFingerprint = getLineFingerprint(currentLines);

        // Restore original HTML
        element.innerHTML = originalHTML;

        // Re-split after layout is complete
        requestAnimationFrame(() => {
          if (!isActive) return;
          const nextData = splitTextData(element, {
            type,
            charClass,
            wordClass,
            lineClass,
            mask,
            propIndex,
            disableKerning,
            initialStyles,
            initialClasses,
          });
          applyData(nextData);

          // Only trigger callback if lines actually changed
          const newFingerprint = getLineFingerprint(currentLines);
          if (onResize && newFingerprint !== previousFingerprint) {
            onResize({
              chars: currentChars,
              words: currentWords,
              lines: currentLines,
            });
          }
        });
      };

      resizeObserver = new ResizeObserver(() => {
        if (skipFirst) {
          skipFirst = false;
          return;
        }

        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(handleResize, 200);
      });

      resizeObserver.observe(target);
      lastWidth = target.offsetWidth;
    }
  }

  // Call onSplit callback and handle revertOnComplete
  if (onSplit) {
    const animationResult = onSplit({
      chars: currentChars,
      words: currentWords,
      lines: currentLines,
    });

    if (revertOnComplete) {
      const promise = normalizeToPromise(animationResult);
      if (promise) {
        promise
          .then(() => {
            if (isActive) {
              revert();
            }
          })
          .catch(() => {
            console.warn("[fetta] Animation rejected, text not reverted");
          });
      }
    }
  }

  return {
    chars: currentChars,
    words: currentWords,
    lines: currentLines,
    revert,
  };
}
