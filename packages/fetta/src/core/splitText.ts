/**
 * Custom splitText implementation with built-in kerning compensation.
 * Measures character positions before splitting, applies compensation,
 * then detects lines based on actual rendered positions.
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
  /** Add will-change: transform, opacity to split elements for better animation performance */
  willChange?: boolean;
}

export interface SplitTextResult {
  chars: HTMLSpanElement[];
  words: HTMLSpanElement[];
  lines: HTMLSpanElement[];
  /** Revert the element to its original state and cleanup observers */
  revert: () => void;
}

interface MeasuredChar {
  char: string;
  left: number;
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

/**
 * Normalize various animation return types to a Promise.
 * Handles: Animation objects with .finished (Motion), thenables (GSAP), arrays, raw Promises.
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

/**
 * Segment text into grapheme clusters (properly handles emoji, accented chars, etc.)
 * Uses Intl.Segmenter for modern browsers.
 */
function segmentGraphemes(text: string): string[] {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return [...segmenter.segment(text)].map((s) => s.segment);
}

/**
 * Measure character positions in the original text using Range API.
 * Splits at whitespace AND after em-dashes/en-dashes for natural wrapping.
 */
function measureOriginalText(element: HTMLElement, splitChars: boolean): MeasuredWord[] {
  const range = document.createRange();
  const words: MeasuredWord[] = [];

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

  while ((node = walker.nextNode() as Text | null)) {
    const text = node.textContent || "";

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

        currentWord.push({ char: grapheme, left: rect.left });
      } else {
        // If not splitting chars, just collect the characters without measuring
        currentWord.push({ char: grapheme, left: 0 });
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
  options?: { propIndex?: boolean; willChange?: boolean; propName?: string }
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

  // Add will-change hint for better animation performance
  if (options?.willChange) {
    span.style.willChange = "transform, opacity";
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
  options?: { propIndex?: boolean; willChange?: boolean; mask?: "lines" | "words" | "chars" }
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

    // Global character index counter (for propIndex across all words)
    let globalCharIndex = 0;

    // Create word spans (with char spans or text content)
    measuredWords.forEach((measuredWord, wordIndex) => {
      const wordSpan = createSpan(wordClass, wordIndex, "inline-block", {
        propIndex: options?.propIndex,
        willChange: options?.willChange,
        propName: "word",
      });

      if (measuredWord.noSpaceBefore) {
        noSpaceBeforeSet.add(wordSpan);
      }

      if (splitChars) {
        // Add char spans to word span
        measuredWord.chars.forEach((measuredChar, charIndex) => {
          const charSpan = createSpan(charClass, globalCharIndex, "inline-block", {
            propIndex: options?.propIndex,
            willChange: options?.willChange,
            propName: "char",
          });
          charSpan.textContent = measuredChar.char;
          globalCharIndex++;

          // Store expected gap for kerning compensation
          if (charIndex > 0) {
            const prevCharLeft = measuredWord.chars[charIndex - 1].left;
            const gap = measuredChar.left - prevCharLeft;
            charSpan.dataset.expectedGap = gap.toString();
          }

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
        // Add text directly to word span
        wordSpan.textContent = measuredWord.chars.map((c) => c.char).join("");
      }

      allWords.push(wordSpan);
    });

    // Add words to DOM with proper spacing
    allWords.forEach((wordSpan, idx) => {
      // Wrap word in mask wrapper if mask === "words"
      if (options?.mask === "words") {
        const wordWrapper = createMaskWrapper("inline-block");
        wordWrapper.appendChild(wordSpan);
        element.appendChild(wordWrapper);
      } else {
        element.appendChild(wordSpan);
      }
      if (
        idx < allWords.length - 1 &&
        !noSpaceBeforeSet.has(allWords[idx + 1])
      ) {
        element.appendChild(document.createTextNode(" "));
      }
    });

    // Apply kerning compensation (if splitting chars)
    if (splitChars) {
      allWords.forEach((wordSpan) => {
        // When mask === "chars", wordSpan.children are wrappers, not charSpans
        const children = Array.from(wordSpan.children) as HTMLSpanElement[];
        if (children.length < 2) return;

        // Get actual charSpans (unwrap if masked)
        const charSpans = options?.mask === "chars"
          ? children.map(wrapper => wrapper.firstElementChild as HTMLSpanElement)
          : children;

        const positions = children.map((c) => c.getBoundingClientRect().left);

        for (let i = 1; i < children.length; i++) {
          const charSpan = charSpans[i];
          const targetElement = children[i]; // Apply margin to wrapper or charSpan
          const expectedGap = charSpan.dataset.expectedGap;

          if (expectedGap !== undefined) {
            const originalGap = parseFloat(expectedGap);
            const currentGap = positions[i] - positions[i - 1];
            const delta = originalGap - currentGap;

            if (Math.abs(delta) < 20) {
              const roundedDelta = Math.round(delta * 100) / 100;
              targetElement.style.marginLeft = `${roundedDelta}px`;
            }

            delete charSpan.dataset.expectedGap;
          }
        }
      });
    }

    // Handle line grouping
    if (splitLines) {
      const lineGroups = groupIntoLines(allWords, element);
      element.textContent = "";

      const allLines: HTMLSpanElement[] = [];
      lineGroups.forEach((words, lineIndex) => {
        const lineSpan = createSpan(lineClass, lineIndex, "block", {
          propIndex: options?.propIndex,
          willChange: options?.willChange,
          propName: "line",
        });

        allLines.push(lineSpan);

        words.forEach((wordSpan, wordIdx) => {
          // Wrap word in mask wrapper if mask === "words"
          if (options?.mask === "words") {
            const wordWrapper = createMaskWrapper("inline-block");
            wordWrapper.appendChild(wordSpan);
            lineSpan.appendChild(wordWrapper);
          } else {
            lineSpan.appendChild(wordSpan);
          }
          if (
            wordIdx < words.length - 1 &&
            !noSpaceBeforeSet.has(words[wordIdx + 1])
          ) {
            lineSpan.appendChild(document.createTextNode(" "));
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
            willChange: options?.willChange,
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
    willChange = false,
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

  // Set aria-label for accessibility
  element.setAttribute("aria-label", text);

  // If splitting chars, force disable ligatures for consistency
  // Ligatures can't span multiple char elements anyway
  if (splitChars) {
    element.style.fontVariantLigatures = "none";
  }

  // STEP 1: Measure original character positions BEFORE modifying DOM
  const measuredWords = measureOriginalText(element, splitChars);

  // Perform the split
  const { chars, words, lines } = performSplit(
    element,
    measuredWords,
    charClass,
    wordClass,
    lineClass,
    splitChars,
    splitWords,
    splitLines,
    { propIndex, willChange, mask }
  );

  // Store initial result
  currentChars = chars;
  currentWords = words;
  currentLines = lines;

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
    element.removeAttribute("aria-label");

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

          // Re-measure and re-split
          const newMeasuredWords = measureOriginalText(element, splitChars);
          const result = performSplit(
            element,
            newMeasuredWords,
            charClass,
            wordClass,
            lineClass,
            splitChars,
            splitWords,
            splitLines,
            { propIndex, willChange, mask }
          );

          // Update current result
          currentChars = result.chars;
          currentWords = result.words;
          currentLines = result.lines;

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
