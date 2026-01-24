/**
 * Custom splitText implementation with built-in kerning compensation.
 * Measures character positions before splitting, applies compensation,
 * then detects lines based on actual rendered positions.
 */

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
}

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
  left: number;
  ancestors: AncestorInfo[];  // ancestor chain from innermost to outermost
}

interface MeasuredWord {
  chars: MeasuredChar[];
  startLeft: number;
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

// Inline elements that should be preserved when splitting text
const INLINE_ELEMENTS = new Set([
  'a', 'abbr', 'acronym', 'b', 'bdi', 'bdo', 'big', 'cite', 'code',
  'data', 'del', 'dfn', 'em', 'i', 'ins', 'kbd', 'mark', 'q', 's',
  'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var',
]);

// Safari detection - still used for revertOnComplete font-kerning workaround
const isSafari = typeof navigator !== 'undefined' &&
  /Safari/.test(navigator.userAgent) &&
  !/Chrome/.test(navigator.userAgent);

/**
 * Measure kerning between character pairs using Canvas API.
 * Kerning = pair width - char1 width - char2 width
 * This is more consistent across browsers than Range API position measurements.
 * Returns a Map of character index -> kerning adjustment (negative = tighten).
 */
function measureKerningWithCanvas(
  element: HTMLElement,
  chars: string[]
): Map<number, number> {
  const kerningMap = new Map<number, number>();

  if (chars.length < 2) return kerningMap;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return kerningMap;

  const styles = getComputedStyle(element);
  ctx.font = `${styles.fontStyle} ${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`;

  // Measure kerning for each adjacent pair
  for (let i = 0; i < chars.length - 1; i++) {
    const char1 = chars[i];
    const char2 = chars[i + 1];
    const pair = char1 + char2;

    const pairWidth = ctx.measureText(pair).width;
    const char1Width = ctx.measureText(char1).width;
    const char2Width = ctx.measureText(char2).width;

    // Kerning = actual pair width - sum of individual widths
    // Negative value means characters should be closer (typical kerning)
    const kerning = pairWidth - char1Width - char2Width;

    // Only store negative kerning (tightening) that's significant (< -0.1px)
    // Positive values would push letters apart, which kerning never does
    if (kerning < -0.1) {
      // Store kerning adjustment for the second character (index i+1)
      kerningMap.set(i + 1, kerning);
    }
  }

  return kerningMap;
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
 * Measure character positions in the original text using Range API.
 * Splits at whitespace AND after em-dashes/en-dashes for natural wrapping.
 * Preserves ancestor chain for each character to support nested inline elements.
 *
 * @param trackAncestors - When false, skips ancestor chain building for better performance
 */
function measureOriginalText(
  element: HTMLElement,
  splitChars: boolean,
  trackAncestors: boolean
): MeasuredWord[] {
  const range = document.createRange();
  const words: MeasuredWord[] = [];

  // Only create ancestor cache if we need to track ancestors
  const ancestorCache = trackAncestors ? new WeakMap<Element, AncestorInfo>() : null;

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node: Text | null;

  let currentWord: MeasuredChar[] = [];
  let wordStartLeft: number | null = null;
  let noSpaceBeforeNext = false;

  const pushWord = () => {
    if (currentWord.length > 0) {
      words.push({
        chars: currentWord,
        startLeft: wordStartLeft ?? 0,
        noSpaceBefore: noSpaceBeforeNext,
      });
      currentWord = [];
      wordStartLeft = null;
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
    let charOffset = 0;

    for (const grapheme of graphemes) {
      // Whitespace = word boundary (with space before next word)
      if (grapheme === " " || grapheme === "\n" || grapheme === "\t") {
        pushWord();
        charOffset += grapheme.length;
        continue;
      }

      if (splitChars) {
        // Measure character position using Range API (only if splitting chars)
        range.setStart(node, charOffset);
        range.setEnd(node, charOffset + grapheme.length);
        const rect = range.getBoundingClientRect();

        if (wordStartLeft === null) {
          wordStartLeft = rect.left;
        }

        currentWord.push({ char: grapheme, left: rect.left, ancestors });
      } else {
        // If not splitting chars, just collect the characters without measuring
        currentWord.push({ char: grapheme, left: 0, ancestors });
      }

      // Break AFTER dash characters (dash stays with preceding text)
      if (BREAK_CHARS.has(grapheme)) {
        pushWord();
        noSpaceBeforeNext = true; // Next word continues without space
      }

      charOffset += grapheme.length;
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

  if (index !== undefined) {
    span.dataset.index = index.toString();

    // Add CSS custom property if propIndex enabled
    if (options?.propIndex && options?.propName) {
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
  options?: { propIndex?: boolean; mask?: "lines" | "words" | "chars"; ariaHidden?: boolean }
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
              // Calculate original char index within the word for kerning
              const charIndexInWord = measuredWord.chars.indexOf(measuredChar);

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

    // Apply kerning compensation using Canvas API
    // Canvas measures kerning consistently across browsers (including Safari)
    if (splitChars && allChars.length > 1) {
      // Get all characters as strings
      const charStrings = allChars.map(c => c.textContent || '');

      // Measure kerning for each pair using canvas
      const kerningMap = measureKerningWithCanvas(element, charStrings);

      // Apply kerning adjustments (negative only - kerning tightens letter spacing)
      for (const [charIndex, kerning] of kerningMap) {
        const charSpan = allChars[charIndex];
        // Only apply negative kerning (tightening) with sanity bound
        if (charSpan && kerning < 0 && kerning > -20) {
          // Apply margin to the char span itself
          // (or its mask wrapper parent if present)
          const targetElement = options?.mask === "chars" && charSpan.parentElement
            ? charSpan.parentElement
            : charSpan;
          targetElement.style.marginLeft = `${kerning}px`;
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

      // Return only what user requested (words might have been created internally for spacing)
      return {
        chars: allChars,
        words: splitWords ? allWords : [],
        lines: allLines,
      };
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

  // Parse type option into flags
  let splitChars = type.includes('chars');
  let splitWords = type.includes('words');
  let splitLines = type.includes('lines');

  // Validate at least one type is selected
  if (!splitChars && !splitWords && !splitLines) {
    console.warn('splitText: type must include at least one of: chars, words, lines. Defaulting to "chars,words,lines".');
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

  // If splitting chars, force disable ligatures for consistency
  // Ligatures can't span multiple char elements anyway
  if (splitChars) {
    element.style.fontVariantLigatures = "none";
  }

  // Safari workaround: disable font kerning when using revertOnComplete with chars
  // Since we can't compensate for kerning in Safari, disabling it ensures
  // the text doesn't shift when reverting to original HTML
  if (isSafari && splitChars && revertOnComplete) {
    element.style.fontKerning = "none";
  }

  // Check once if we need to track nested inline elements (performance optimization)
  const trackAncestors = hasInlineDescendants(element);

  // Collect text structure (kerning is measured separately via canvas)
  const measuredWords = measureOriginalText(element, false, trackAncestors);

  // Perform the split
  // For simple text, add aria-hidden to each span (GSAP-style approach)
  // For nested elements, we'll wrap in a container instead
  const { chars, words, lines } = performSplit(
    element,
    measuredWords,
    charClass,
    wordClass,
    lineClass,
    splitChars,
    splitWords,
    splitLines,
    { propIndex, mask, ariaHidden: !trackAncestors }
  );

  // Store initial result
  currentChars = chars;
  currentWords = words;
  currentLines = lines;

  // Accessibility: Set up screen reader access based on content complexity
  if (trackAncestors) {
    // Complex content with nested elements: wrap in aria-hidden + add sr-only copy
    injectSrOnlyStyles();

    const visualWrapper = document.createElement('span');
    visualWrapper.setAttribute('aria-hidden', 'true');
    visualWrapper.dataset.fettaVisual = 'true';

    while (element.firstChild) {
      visualWrapper.appendChild(element.firstChild);
    }
    element.appendChild(visualWrapper);
    element.appendChild(createScreenReaderCopy(originalHTML));
  } else {
    // Simple text: aria-hidden on each span + aria-label on parent
    element.setAttribute("aria-label", text);
  }

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
    // Only remove aria-label for simple text case (it wasn't set for nested elements)
    if (!trackAncestors) {
      element.removeAttribute("aria-label");
    }

    // Keep ligatures disabled if we split chars (prevents visual shift on revert)
    if (splitChars) {
      element.style.fontVariantLigatures = "none";
    }

    // Keep font kerning disabled in Safari (prevents visual shift on revert)
    if (isSafari && splitChars && revertOnComplete) {
      element.style.fontKerning = "none";
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

          // Re-measure and re-split (trackAncestors is stable since originalHTML doesn't change)
          const newMeasuredWords = measureOriginalText(element, false, trackAncestors);
          const result = performSplit(
            element,
            newMeasuredWords,
            charClass,
            wordClass,
            lineClass,
            splitChars,
            splitWords,
            splitLines,
            { propIndex, mask, ariaHidden: !trackAncestors }
          );

          // Update current result
          currentChars = result.chars;
          currentWords = result.words;
          currentLines = result.lines;

          // Re-apply accessibility structure for nested elements only
          if (trackAncestors) {
            const visualWrapper = document.createElement('span');
            visualWrapper.setAttribute('aria-hidden', 'true');
            visualWrapper.dataset.fettaVisual = 'true';

            while (element.firstChild) {
              visualWrapper.appendChild(element.firstChild);
            }
            element.appendChild(visualWrapper);
            element.appendChild(createScreenReaderCopy(originalHTML));
          }

          // Only trigger callback if lines actually changed
          const newFingerprint = getLineFingerprint(result.lines);
          if (onResize && newFingerprint !== previousFingerprint) {
            onResize({
              chars: result.chars,
              words: result.words,
              lines: result.lines,
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
