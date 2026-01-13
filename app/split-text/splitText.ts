/**
 * Custom splitText implementation with built-in kerning compensation.
 * Measures character positions before splitting, applies compensation,
 * then detects lines based on actual rendered positions.
 */

export interface SplitTextOptions {
  splitBy?: string;
  charClass?: string;
  wordClass?: string;
  lineClass?: string;
}

export interface SplitResult {
  chars: HTMLSpanElement[];
  words: HTMLSpanElement[];
  lines: HTMLSpanElement[];
  /** Revert the element to its original state */
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
const BREAK_CHARS = new Set(["—", "–"]);

/**
 * Measure character positions in the original text using Range API.
 * Splits at whitespace AND after em-dashes/en-dashes for natural wrapping.
 */
function measureOriginalText(element: HTMLElement): MeasuredWord[] {
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

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // Whitespace = word boundary (with space before next word)
      if (char === " " || char === "\n" || char === "\t") {
        pushWord();
        continue;
      }

      // Measure character position
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const rect = range.getBoundingClientRect();

      if (wordStartLeft === null) {
        wordStartLeft = rect.left;
      }

      currentWord.push({ char, left: rect.left });

      // Break AFTER dash characters (dash stays with preceding text)
      if (BREAK_CHARS.has(char)) {
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
  display: "inline-block" | "block" = "inline-block"
): HTMLSpanElement {
  const span = document.createElement("span");

  if (className) {
    span.className = className;
  }

  if (index !== undefined) {
    span.dataset.index = index.toString();
  }

  span.style.display = display;

  return span;
}

/**
 * Split text into characters, words, and lines with kerning compensation.
 */
export function splitText(
  element: HTMLElement,
  {
    charClass = "split-char",
    wordClass = "split-word",
    lineClass = "split-line",
  }: SplitTextOptions = {}
): SplitResult {
  // Store original HTML for revert
  const originalHTML = element.innerHTML;
  const text = element.textContent || "";

  // Set aria-label for accessibility
  element.setAttribute("aria-label", text);

  // Disable ligatures permanently - this ensures consistent appearance
  // before split, during split, and after revert (ligatures can't span multiple elements)
  element.style.fontVariantLigatures = "none";

  // STEP 1: Measure original character positions BEFORE modifying DOM
  const measuredWords = measureOriginalText(element);

  // Clear element
  element.textContent = "";

  // Track created elements
  const allChars: HTMLSpanElement[] = [];
  const allWords: HTMLSpanElement[] = [];

  // Track which words shouldn't have space before them
  const noSpaceBeforeSet = new Set<HTMLSpanElement>();

  // STEP 2: Create word and character spans
  measuredWords.forEach((measuredWord, wordIndex) => {
    const wordSpan = createSpan(wordClass, wordIndex);

    if (measuredWord.noSpaceBefore) {
      noSpaceBeforeSet.add(wordSpan);
    }

    measuredWord.chars.forEach((measuredChar, charIndex) => {
      const charSpan = createSpan(charClass, charIndex);
      charSpan.textContent = measuredChar.char;

      // Store expected gap from previous character (skip first char)
      if (charIndex > 0) {
        const prevCharLeft = measuredWord.chars[charIndex - 1].left;
        const gap = measuredChar.left - prevCharLeft;
        charSpan.dataset.expectedGap = gap.toString();
      }

      wordSpan.appendChild(charSpan);
      allChars.push(charSpan);
    });

    allWords.push(wordSpan);
  });

  // STEP 3: Add words to DOM with spaces (skip space before dash continuations)
  allWords.forEach((wordSpan, idx) => {
    element.appendChild(wordSpan);
    // Add space after, unless next word is a dash continuation
    if (idx < allWords.length - 1 && !noSpaceBeforeSet.has(allWords[idx + 1])) {
      element.appendChild(document.createTextNode(" "));
    }
  });

  // STEP 4: Apply kerning compensation (now that elements are in DOM)
  // Gap-based approach: measure gap between consecutive chars, apply margin to correct each gap
  // This allows single-pass measurement since each margin only affects its own gap
  allWords.forEach((wordSpan) => {
    const chars = Array.from(wordSpan.children) as HTMLSpanElement[];
    if (chars.length < 2) return;

    // Single pass: measure all current positions upfront
    const positions = chars.map((c) => c.getBoundingClientRect().left);

    // Calculate and apply margins based on gap differences
    for (let i = 1; i < chars.length; i++) {
      const charSpan = chars[i];
      const expectedGap = charSpan.dataset.expectedGap;

      if (expectedGap !== undefined) {
        const originalGap = parseFloat(expectedGap);
        const currentGap = positions[i] - positions[i - 1];
        const delta = originalGap - currentGap;

        // Apply reasonable kerning adjustments (round to 2 decimals to avoid float issues)
        if (Math.abs(delta) < 20) {
          const roundedDelta = Math.round(delta * 100) / 100;
          charSpan.style.marginLeft = `${roundedDelta}px`;
        }

        // Clean up data attribute
        delete charSpan.dataset.expectedGap;
      }
    }
  });

  // STEP 5: Detect lines by Y position (AFTER compensation)
  const lineGroups: HTMLSpanElement[][] = [];
  let currentLine: HTMLSpanElement[] = [];
  let currentY: number | null = null;

  allWords.forEach((wordSpan) => {
    const rect = wordSpan.getBoundingClientRect();
    const wordY = Math.round(rect.top);

    if (currentY === null) {
      currentY = wordY;
      currentLine.push(wordSpan);
    } else if (Math.abs(wordY - currentY) < 5) {
      currentLine.push(wordSpan);
    } else {
      lineGroups.push(currentLine);
      currentLine = [wordSpan];
      currentY = wordY;
    }
  });

  if (currentLine.length > 0) {
    lineGroups.push(currentLine);
  }

  // STEP 6: Wrap words in line spans
  element.textContent = "";

  const allLines: HTMLSpanElement[] = [];

  lineGroups.forEach((words, lineIndex) => {
    const lineSpan = createSpan(lineClass, lineIndex, "block");
    allLines.push(lineSpan);

    words.forEach((wordSpan, wordIdx) => {
      lineSpan.appendChild(wordSpan);
      // Add space after, unless next word is a dash continuation
      if (
        wordIdx < words.length - 1 &&
        !noSpaceBeforeSet.has(words[wordIdx + 1])
      ) {
        lineSpan.appendChild(document.createTextNode(" "));
      }
    });

    element.appendChild(lineSpan);
  });

  return {
    chars: allChars,
    words: allWords,
    lines: allLines,
    revert: () => {
      element.innerHTML = originalHTML;
      element.removeAttribute("aria-label");
      // Keep ligatures disabled for consistent appearance
      element.style.fontVariantLigatures = "none";
    },
  };
}
