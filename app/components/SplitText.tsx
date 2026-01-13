"use client";

import { splitText } from "motion-plus";
import {
  cloneElement,
  isValidElement,
  ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

interface SplitTextOptions {
  charClass?: string;
  wordClass?: string;
  lineClass?: string;
  splitBy?: string;
}

interface SplitResult {
  chars: Element[];
  words: Element[];
  lines: Element[];
}

interface SplitTextProps {
  children: ReactElement;
  /** Return a promise to revert to original HTML when it resolves */
  onSplit: (result: SplitResult) => void | Promise<unknown>;
  options?: SplitTextOptions;
  autoSplit?: boolean;
}

interface OriginalWordData {
  relativeLefts: number[];
}

/**
 * Measure relative char positions within each word in original text.
 */
function measureOriginalPositions(element: HTMLElement): OriginalWordData[] {
  const range = document.createRange();
  const words: OriginalWordData[] = [];

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node: Text | null;

  let currentWord: number[] = [];
  let wordStartLeft: number | null = null;

  while ((node = walker.nextNode() as Text | null)) {
    const text = node.textContent || "";
    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (char === " " || char === "\n" || char === "\t") {
        // End of word
        if (currentWord.length > 0) {
          words.push({ relativeLefts: currentWord });
          currentWord = [];
          wordStartLeft = null;
        }
        continue;
      }

      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const rect = range.getBoundingClientRect();

      if (wordStartLeft === null) {
        wordStartLeft = rect.left;
      }

      currentWord.push(rect.left - wordStartLeft);
    }
  }

  // Don't forget the last word
  if (currentWord.length > 0) {
    words.push({ relativeLefts: currentWord });
  }

  return words;
}

/**
 * Apply kerning compensation using gap-based approach.
 * Measures gaps between consecutive characters and applies margins to match original.
 * This allows single-pass measurement since each margin only affects its own gap.
 */
function applyCompensation(
  wordElements: HTMLElement[],
  originalWords: OriginalWordData[]
): void {
  for (let w = 0; w < wordElements.length && w < originalWords.length; w++) {
    const wordEl = wordElements[w];
    const originalPositions = originalWords[w].relativeLefts;

    const chars = Array.from(
      wordEl.querySelectorAll<HTMLElement>('[class*="split-char"]')
    );

    if (chars.length < 2) continue;

    // Single pass: measure all current positions upfront
    const positions = chars.map((c) => c.getBoundingClientRect().left);

    // Calculate and apply margins based on gap differences
    for (let i = 1; i < chars.length && i < originalPositions.length; i++) {
      // Calculate original gap between consecutive chars
      const originalGap = originalPositions[i] - originalPositions[i - 1];

      // If original gap is negative (line break in original), skip remaining chars
      if (originalGap < -5) break;

      const currentGap = positions[i] - positions[i - 1];
      const delta = originalGap - currentGap;

      // Apply reasonable kerning adjustments (round to avoid float issues)
      if (Math.abs(delta) < 20) {
        const roundedDelta = Math.round(delta * 100) / 100;
        chars[i].style.marginLeft = `${roundedDelta}px`;
      }
    }
  }
}

/**
 * Split word elements at em-dashes/en-dashes into separate word elements.
 * Returns updated word elements array and a Set of elements that should NOT
 * have space before them (because they're the continuation of a dash-split word).
 */
function splitWordsAtDashes(
  wordElements: HTMLElement[],
  wordClass: string
): { words: HTMLElement[]; noSpaceBefore: Set<HTMLElement> } {
  const result: HTMLElement[] = [];
  const noSpaceBefore = new Set<HTMLElement>();

  wordElements.forEach((wordEl) => {
    const text = wordEl.textContent || "";

    // Check if word contains em-dash or en-dash
    if (!text.includes("—") && !text.includes("–")) {
      result.push(wordEl);
      return;
    }

    // Get all char elements
    const chars = Array.from(
      wordEl.querySelectorAll<HTMLElement>('[class*="split-char"]')
    );

    // Find split points (after dashes)
    const splitIndices: number[] = [0]; // Start with 0
    chars.forEach((char, idx) => {
      const charText = char.textContent || "";
      if (charText === "—" || charText === "–") {
        splitIndices.push(idx + 1); // Split AFTER the dash
      }
    });
    splitIndices.push(chars.length); // End

    // Create word elements for each segment
    const newWordsFromThisWord: HTMLElement[] = [];
    let isFirst = true;

    for (let i = 0; i < splitIndices.length - 1; i++) {
      const startIdx = splitIndices[i];
      const endIdx = splitIndices[i + 1];

      if (startIdx >= endIdx) continue;

      const newWordEl = document.createElement("span");
      newWordEl.className = wordClass || "split-word";
      newWordEl.style.display = "inline-block";

      for (let j = startIdx; j < endIdx; j++) {
        newWordEl.appendChild(chars[j]);
      }

      if (newWordEl.childNodes.length > 0) {
        newWordsFromThisWord.push(newWordEl);
        result.push(newWordEl);
        // Mark continuation segments (not the first) as needing no space before
        if (!isFirst) {
          noSpaceBefore.add(newWordEl);
        }
        isFirst = false;
      }
    }

    // Replace original word element in parent with new word elements
    if (wordEl.parentNode && newWordsFromThisWord.length > 0) {
      const parent = wordEl.parentNode;
      const insertBefore = wordEl.nextSibling;
      wordEl.remove();

      // Insert new word elements where the old one was
      newWordsFromThisWord.forEach((w) => {
        if (insertBefore) {
          parent.insertBefore(w, insertBefore);
        } else {
          parent.appendChild(w);
        }
      });
    }
  });

  return { words: result, noSpaceBefore };
}

/**
 * Re-detect lines after compensation by checking word Y positions,
 * then re-wrap words into correct line groupings.
 */
function redetectAndWrapLines(
  element: HTMLElement,
  wordElements: HTMLElement[],
  lineClass: string,
  noSpaceBefore: Set<HTMLElement>
): HTMLElement[] {
  // First, flatten the structure - move all words out of line wrappers
  const oldLines = element.querySelectorAll<HTMLElement>(
    '[class*="split-line"]'
  );

  // Collect all words
  const allWords: HTMLElement[] = [];
  oldLines.forEach((line) => {
    const words = Array.from(
      line.querySelectorAll<HTMLElement>('[class*="split-word"]')
    );
    allWords.push(...words);
  });

  // Remove old lines
  oldLines.forEach((line) => line.remove());

  // Temporarily add words directly to element to measure their positions
  allWords.forEach((word, idx) => {
    element.appendChild(word);
    // Add space between words, except for dash-split continuations
    if (idx < allWords.length - 1 && !noSpaceBefore.has(allWords[idx + 1])) {
      element.appendChild(document.createTextNode(" "));
    }
  });

  // Now detect which words are on which line by Y position
  const lineGroups: HTMLElement[][] = [];
  let currentLine: HTMLElement[] = [];
  let currentY: number | null = null;

  allWords.forEach((word) => {
    const rect = word.getBoundingClientRect();
    const wordY = Math.round(rect.top);

    if (currentY === null) {
      currentY = wordY;
      currentLine.push(word);
    } else if (Math.abs(wordY - currentY) < 5) {
      currentLine.push(word);
    } else {
      lineGroups.push(currentLine);
      currentLine = [word];
      currentY = wordY;
    }
  });

  if (currentLine.length > 0) {
    lineGroups.push(currentLine);
  }

  // Clear the element
  element.innerHTML = "";

  // Create new line wrappers
  const newLines: HTMLElement[] = [];
  lineGroups.forEach((words) => {
    const lineEl = document.createElement("span");
    lineEl.className = lineClass || "split-line";
    lineEl.style.display = "block";

    words.forEach((word, idx) => {
      lineEl.appendChild(word);
      // Add space between words, except for dash-split continuations
      if (idx < words.length - 1 && !noSpaceBefore.has(words[idx + 1])) {
        lineEl.appendChild(document.createTextNode(" "));
      }
    });

    element.appendChild(lineEl);
    newLines.push(lineEl);
  });

  return newLines;
}

export function SplitText({
  children,
  onSplit,
  options,
  autoSplit = false,
}: SplitTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [childElement, setChildElement] = useState<HTMLElement | null>(null);

  // Stable refs for callbacks and options (prevents unnecessary effect re-runs)
  const onSplitRef = useRef(onSplit);
  const optionsRef = useRef(options);

  // Keep refs in sync with latest props (useLayoutEffect to update before other effects)
  useLayoutEffect(() => {
    onSplitRef.current = onSplit;
    optionsRef.current = options;
  });

  // Refs for autoSplit (no re-renders needed)
  const originalHtmlRef = useRef<string | null>(null);
  const lastWidthRef = useRef<number | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasSplitRef = useRef(false);
  const hasRevertedRef = useRef(false);

  const childRefCallback = useCallback((node: HTMLElement | null) => {
    setChildElement(node);
  }, []);

  // Initial split and animation
  useEffect(() => {
    if (!childElement) return;

    // Guard against double-execution in Strict Mode
    if (hasSplitRef.current) return;

    // Track mounted state for async cleanup
    let isMounted = true;

    document.fonts.ready.then(() => {
      // Bail out if unmounted or already split
      if (!isMounted || hasSplitRef.current) return;
      if (!containerRef.current) return;

      // Store original HTML before first split
      if (originalHtmlRef.current === null) {
        originalHtmlRef.current = childElement.innerHTML;
      }

      // Measure original positions BEFORE splitting
      const originalMeasurements = measureOriginalPositions(childElement);

      const splitResult = splitText(childElement, optionsRef.current);

      // Apply per-word compensation (kerning)
      applyCompensation(
        splitResult.words as HTMLElement[],
        originalMeasurements
      );

      // Split words at dashes so they can wrap naturally
      const wordClass = optionsRef.current?.wordClass || "split-word";
      const { words: updatedWords, noSpaceBefore } = splitWordsAtDashes(
        splitResult.words as HTMLElement[],
        wordClass
      );

      // Re-detect lines and re-wrap words
      const lineClass = optionsRef.current?.lineClass || "split-line";
      const newLines = redetectAndWrapLines(
        childElement,
        updatedWords,
        lineClass,
        noSpaceBefore
      );

      // Create result with updated words and lines
      const result: SplitResult = {
        chars: splitResult.chars,
        words: updatedWords,
        lines: newLines,
      };

      // Mark as split to prevent re-runs
      hasSplitRef.current = true;

      // Track initial width (for autoSplit)
      lastWidthRef.current = childElement.offsetWidth;

      // Reveal the container after splitting
      containerRef.current.style.visibility = "visible";

      // Invoke the callback with split elements
      const maybePromise = onSplitRef.current(result);

      // If onSplit returns a promise, revert to original HTML when it resolves
      if (maybePromise instanceof Promise) {
        maybePromise.then(() => {
          if (!isMounted || originalHtmlRef.current === null) return;
          childElement.innerHTML = originalHtmlRef.current;
          childElement.removeAttribute("aria-label");
          hasRevertedRef.current = true;
        });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [childElement]);

  // ResizeObserver for autoSplit
  useEffect(() => {
    if (!autoSplit || !childElement || !containerRef.current) return;

    const container = containerRef.current;

    const handleResize = () => {
      // Skip if we've reverted to original HTML
      if (hasRevertedRef.current) return;
      if (originalHtmlRef.current === null) return;

      // Skip if container width hasn't changed
      const currentWidth = container.offsetWidth;
      if (currentWidth === lastWidthRef.current) return;
      lastWidthRef.current = currentWidth;

      // Restore original HTML
      childElement.innerHTML = originalHtmlRef.current;

      // Wait for layout to complete before measuring and splitting
      requestAnimationFrame(() => {
        if (hasRevertedRef.current) return;

        // Measure original positions BEFORE splitting
        const originalMeasurements = measureOriginalPositions(childElement);

        const result = splitText(childElement, optionsRef.current);

        // Apply per-word compensation (kerning)
        applyCompensation(result.words as HTMLElement[], originalMeasurements);

        // Split words at dashes so they can wrap naturally
        const wordClass = optionsRef.current?.wordClass || "split-word";
        const { words: updatedWords, noSpaceBefore } = splitWordsAtDashes(
          result.words as HTMLElement[],
          wordClass
        );

        // Re-detect lines and re-wrap words
        const lineClass = optionsRef.current?.lineClass || "split-line";
        redetectAndWrapLines(
          childElement,
          updatedWords,
          lineClass,
          noSpaceBefore
        );
      });
    };

    let skipFirst = true;

    // Observe the CONTAINER, not the child - the container resizes with the
    // viewport while the child's width depends on its content
    const resizeObserver = new ResizeObserver(() => {
      // Skip the initial callback that fires immediately on observe
      if (skipFirst) {
        skipFirst = false;
        return;
      }

      // Debounce: clear pending timer and set new one
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(handleResize, 100);
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [autoSplit, childElement]);

  if (!isValidElement(children)) {
    console.error("SplitText: children must be a single valid React element");
    return null;
  }

  // Clone the child and attach our callback ref
  const clonedChild = cloneElement(children, {
    ref: childRefCallback,
  } as Record<string, unknown>);

  return (
    <div ref={containerRef} style={{ visibility: "hidden" }}>
      {clonedChild}
    </div>
  );
}
