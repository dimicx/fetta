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
  wordWidth: number;
}

/**
 * Measure relative char positions within each word in original text,
 * plus the total width of each word.
 */
function measureOriginalPositions(element: HTMLElement): OriginalWordData[] {
  const range = document.createRange();
  const words: OriginalWordData[] = [];

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node: Text | null;

  let currentWord: number[] = [];
  let wordStartLeft: number | null = null;
  let wordEndRight: number | null = null;

  while ((node = walker.nextNode() as Text | null)) {
    const text = node.textContent || "";
    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (char === " " || char === "\n" || char === "\t") {
        // End of word
        if (
          currentWord.length > 0 &&
          wordStartLeft !== null &&
          wordEndRight !== null
        ) {
          words.push({
            relativeLefts: currentWord,
            wordWidth: wordEndRight - wordStartLeft,
          });
          currentWord = [];
          wordStartLeft = null;
          wordEndRight = null;
        }
        continue;
      }

      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const rect = range.getBoundingClientRect();

      if (wordStartLeft === null) {
        wordStartLeft = rect.left;
      }
      wordEndRight = rect.right;

      currentWord.push(rect.left - wordStartLeft);
    }
  }

  // Don't forget the last word
  if (
    currentWord.length > 0 &&
    wordStartLeft !== null &&
    wordEndRight !== null
  ) {
    words.push({
      relativeLefts: currentWord,
      wordWidth: wordEndRight - wordStartLeft,
    });
  }

  return words;
}

/**
 * Apply compensation to match original text layout:
 * 1. Character kerning within words
 * 2. Word width compensation
 */
function applyCompensation(
  wordElements: HTMLElement[],
  originalWords: OriginalWordData[]
): void {
  for (let w = 0; w < wordElements.length && w < originalWords.length; w++) {
    const wordEl = wordElements[w];
    const originalPositions = originalWords[w].relativeLefts;
    const originalWordWidth = originalWords[w].wordWidth;

    const chars = Array.from(
      wordEl.querySelectorAll<HTMLElement>('[class*="split-char"]')
    );

    if (chars.length === 0) continue;

    // Get the first char's position as reference
    const wordStartLeft = chars[0].getBoundingClientRect().left;

    // Apply character position compensation (kerning) to ALL characters
    for (let i = 1; i < chars.length && i < originalPositions.length; i++) {
      const currentRelativeLeft =
        chars[i].getBoundingClientRect().left - wordStartLeft;
      const originalRelativeLeft = originalPositions[i];
      const delta = originalRelativeLeft - currentRelativeLeft;
      chars[i].style.marginLeft = `${delta}px`;
    }

    // Apply word width compensation
    // Measure current word width after kerning compensation
    const lastChar = chars[chars.length - 1];
    const currentWordWidth =
      lastChar.getBoundingClientRect().right - wordStartLeft;
    const widthDelta = originalWordWidth - currentWordWidth;
    lastChar.style.marginRight = `${widthDelta}px`;
  }
}

/**
 * Re-detect lines after compensation by checking word Y positions,
 * then re-wrap words into correct line groupings.
 */
function redetectAndWrapLines(
  element: HTMLElement,
  wordElements: HTMLElement[],
  lineClass: string
): HTMLElement[] {
  // First, flatten the structure - move all words out of line wrappers
  // and remove the old line elements
  const oldLines = element.querySelectorAll<HTMLElement>(
    '[class*="split-line"]'
  );

  // Collect all words and spaces between them
  const wordsWithSpaces: (HTMLElement | Text)[] = [];
  oldLines.forEach((line) => {
    const children = Array.from(line.childNodes);
    children.forEach((child) => {
      wordsWithSpaces.push(child as HTMLElement | Text);
    });
  });

  // Remove old lines
  oldLines.forEach((line) => line.remove());

  // Temporarily add words directly to element to measure their positions
  wordsWithSpaces.forEach((item) => element.appendChild(item));

  // Now detect which words are on which line by Y position
  const lineGroups: HTMLElement[][] = [];
  let currentLine: HTMLElement[] = [];
  let currentY: number | null = null;

  wordElements.forEach((word) => {
    const rect = word.getBoundingClientRect();
    const wordY = Math.round(rect.top); // Round to avoid floating point issues

    if (currentY === null) {
      currentY = wordY;
      currentLine.push(word);
    } else if (Math.abs(wordY - currentY) < 5) {
      // Same line (within 5px tolerance)
      currentLine.push(word);
    } else {
      // New line
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

  // Create new line wrappers with correct groupings
  const newLines: HTMLElement[] = [];
  lineGroups.forEach((words) => {
    const lineEl = document.createElement("span");
    lineEl.className = lineClass || "split-line";
    lineEl.style.display = "block";

    words.forEach((word, idx) => {
      lineEl.appendChild(word);
      // Add space between words (except after last word)
      if (idx < words.length - 1) {
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
      console.log("Before split:", childElement.scrollWidth);

      const splitResult = splitText(childElement, optionsRef.current);
      console.log(
        "After split, before compensation:",
        childElement.scrollWidth
      );

      // Apply per-word compensation (kerning + word width)
      applyCompensation(
        splitResult.words as HTMLElement[],
        originalMeasurements
      );
      console.log("After compensation:", childElement.scrollWidth);

      // Re-detect lines after compensation and re-wrap words
      const lineClass = optionsRef.current?.lineClass || "split-line";
      const newLines = redetectAndWrapLines(
        childElement,
        splitResult.words as HTMLElement[],
        lineClass
      );
      console.log(
        "After line re-detection:",
        childElement.scrollWidth,
        "lines:",
        newLines.length
      );

      // Create result with corrected lines
      const result: SplitResult = {
        chars: splitResult.chars,
        words: splitResult.words,
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

      // Restore original HTML and re-split
      childElement.innerHTML = originalHtmlRef.current;

      // Measure original positions BEFORE splitting
      const originalMeasurements = measureOriginalPositions(childElement);

      const result = splitText(childElement, optionsRef.current);

      // Apply per-word compensation (kerning + word width)
      applyCompensation(result.words as HTMLElement[], originalMeasurements);

      // Re-detect lines after compensation and re-wrap words
      const lineClass = optionsRef.current?.lineClass || "split-line";
      redetectAndWrapLines(
        childElement,
        result.words as HTMLElement[],
        lineClass
      );
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
    <div ref={containerRef} style={{ visibility: "hidden", display: "flex" }}>
      {clonedChild}
    </div>
  );
}
