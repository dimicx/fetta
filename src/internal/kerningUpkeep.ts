/**
 * Shared kerning upkeep utilities used by core and motion SplitText.
 */

export type KerningMask = "lines" | "words" | "chars";

/**
 * Regex to detect scripts with contextual shaping where kerning measurement breaks.
 * Arabic, Hebrew, Thai, Devanagari, and other complex scripts.
 */
const CONTEXTUAL_SCRIPT_REGEX =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF\uFB1D-\uFB4F\u0E00-\u0E7F\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F]/;

function hasContextualScript(chars: string[]): boolean {
  return chars.some((char) => CONTEXTUAL_SCRIPT_REGEX.test(char));
}

/**
 * Text-related CSS properties that can affect glyph metrics/kerning.
 * Keep this list focused to avoid unnecessary work while ensuring accuracy.
 */
const KERNING_STYLE_PROPS = [
  "font",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "font-variant",
  "line-height",
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
  "writing-mode",
  "text-orientation",
  "text-combine-upright",
] as const;
const KERNING_STYLE_PROPS_SET = new Set<string>(KERNING_STYLE_PROPS);

function copyKerningStyles(
  target: HTMLElement,
  styles: CSSStyleDeclaration
): void {
  for (let i = 0; i < styles.length; i++) {
    const prop = styles[i];
    if (!KERNING_STYLE_PROPS_SET.has(prop) && !prop.startsWith("font-")) {
      continue;
    }
    const value = styles.getPropertyValue(prop);
    if (value) target.style.setProperty(prop, value);
  }
}

export function buildKerningStyleKey(styles: CSSStyleDeclaration): string {
  return KERNING_STYLE_PROPS.map((prop) => styles.getPropertyValue(prop)).join(
    "|"
  );
}

// Detect Safari browser (cached)
let isSafariBrowser: boolean | null = null;
function isSafari(): boolean {
  if (isSafariBrowser !== null) return isSafariBrowser;
  if (typeof navigator === "undefined") return false;
  isSafariBrowser = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  return isSafariBrowser;
}

// Shared hidden roots per document for transform-isolated kerning measurement.
const kerningMeasureRoots = new WeakMap<Document, HTMLDivElement>();

function getKerningMeasureRoot(doc: Document): HTMLDivElement | null {
  const existing = kerningMeasureRoots.get(doc);
  if (existing && existing.isConnected) return existing;

  const host = doc.body ?? doc.documentElement;
  if (!host) return null;

  const root = doc.createElement("div");
  root.setAttribute("data-fetta-kerning-root", "true");
  root.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    "visibility:hidden",
    "pointer-events:none",
    "z-index:-2147483647",
    "contain:layout paint",
  ].join(";");

  host.appendChild(root);
  kerningMeasureRoots.set(doc, root);
  return root;
}

/**
 * Measure kerning using DOM elements.
 * Slower but accurate - inherits all styles including -webkit-font-smoothing.
 * Used for Safari where font-smoothing affects glyph metrics.
 */
function measureKerningDOM(
  measureRoot: HTMLElement,
  styleSource: HTMLElement,
  chars: string[],
  styles?: CSSStyleDeclaration
): Map<number, number> {
  const kerningMap = new Map<number, number>();
  if (chars.length < 2) return kerningMap;

  const doc = styleSource.ownerDocument;
  const measurer = doc.createElement("span");
  measurer.style.cssText = `
    position: absolute;
    visibility: hidden;
    white-space: pre;
  `;

  const computedStyles = styles ?? getComputedStyle(styleSource);
  copyKerningStyles(measurer, computedStyles);

  // Copy font smoothing (critical for Safari)
  // @ts-expect-error - webkit property
  const webkitSmoothing =
    computedStyles.webkitFontSmoothing || computedStyles["-webkit-font-smoothing"];
  // @ts-expect-error - moz property
  const mozSmoothing =
    computedStyles.MozOsxFontSmoothing || computedStyles["-moz-osx-font-smoothing"];
  if (webkitSmoothing) {
    // @ts-expect-error - webkit property
    measurer.style.webkitFontSmoothing = webkitSmoothing;
  }
  if (mozSmoothing) {
    // @ts-expect-error - moz property
    measurer.style.MozOsxFontSmoothing = mozSmoothing;
  }

  measureRoot.appendChild(measurer);

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

  measureRoot.removeChild(measurer);
  return kerningMap;
}

/**
 * Measure kerning using Range API on text nodes.
 * Faster than DOM element measurement — avoids box model computation.
 * Used for non-Safari browsers (Chrome, Firefox, Edge).
 */
function measureKerningRange(
  measureRoot: HTMLElement,
  styleSource: HTMLElement,
  chars: string[],
  styles?: CSSStyleDeclaration
): Map<number, number> {
  const kerningMap = new Map<number, number>();
  if (chars.length < 2) return kerningMap;

  const doc = styleSource.ownerDocument;
  const measurer = doc.createElement("span");
  measurer.style.cssText = "position:absolute;visibility:hidden;white-space:pre;";

  const computedStyles = styles ?? getComputedStyle(styleSource);
  copyKerningStyles(measurer, computedStyles);
  measureRoot.appendChild(measurer);

  const range = doc.createRange();
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
  measureRoot.removeChild(measurer);
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
  styles?: CSSStyleDeclaration,
  isolateKerningMeasurement = true
): Map<number, number> {
  if (chars.length < 2) return new Map();

  if (!styleSource.isConnected) {
    console.warn(
      "splitText: kerning measurement requires a connected DOM element. Skipping kerning."
    );
    return new Map();
  }

  const computedStyles = styles ?? getComputedStyle(styleSource);

  if (!isolateKerningMeasurement) {
    if (!container.isConnected) {
      console.warn(
        "splitText: kerning measurement requires a connected DOM element. Skipping kerning."
      );
      return new Map();
    }
    return isSafari()
      ? measureKerningDOM(container, styleSource, chars, computedStyles)
      : measureKerningRange(container, styleSource, chars, computedStyles);
  }

  const measureRoot = getKerningMeasureRoot(styleSource.ownerDocument);

  if (!measureRoot) {
    if (!container.isConnected) {
      console.warn(
        "splitText: kerning measurement requires a connected DOM element. Skipping kerning."
      );
      return new Map();
    }
    // Fallback to local container if no root is available (very rare).
    return isSafari()
      ? measureKerningDOM(container, styleSource, chars, computedStyles)
      : measureKerningRange(container, styleSource, chars, computedStyles);
  }

  // Safari needs DOM-based measurement for font-smoothing accuracy.
  return isSafari()
    ? measureKerningDOM(measureRoot, styleSource, chars, computedStyles)
    : measureKerningRange(measureRoot, styleSource, chars, computedStyles);
}

export interface KerningCompensationOptions {
  disableKerning?: boolean;
  isolateKerningMeasurement?: boolean;
  mask?: KerningMask;
}

function classSelector(className: string): string {
  const tokens = className.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "";
  return `.${tokens.join(".")}`;
}

export function querySplitWords(
  element: HTMLElement,
  wordClass: string
): HTMLSpanElement[] {
  const selector = classSelector(wordClass);
  if (!selector) return [];
  return Array.from(element.querySelectorAll<HTMLSpanElement>(selector));
}

function hasNoSpaceBefore(wordSpan: HTMLSpanElement): boolean {
  return wordSpan.dataset.fettaNoSpaceBefore === "true";
}

function hasHardBreakBefore(wordSpan: HTMLSpanElement): boolean {
  return wordSpan.dataset.fettaHardBreakBefore === "true";
}

function getCharKerningTarget(
  charSpan: HTMLSpanElement,
  mask?: KerningMask
): HTMLElement {
  if (mask === "chars" && charSpan.parentElement) {
    return charSpan.parentElement;
  }
  return charSpan;
}

function getWordKerningTarget(
  wordSpan: HTMLSpanElement,
  mask?: KerningMask
): HTMLElement {
  if (mask === "words" && wordSpan.parentElement) {
    return wordSpan.parentElement;
  }
  return wordSpan;
}

export function clearKerningCompensation(
  allWords: HTMLSpanElement[],
  charClass: string,
  splitChars: boolean,
  splitWords: boolean,
  mask?: KerningMask
): void {
  if (splitChars) {
    const charSelector = classSelector(charClass);
    if (!charSelector) return;
    for (const wordSpan of allWords) {
      const wordChars = Array.from(
        wordSpan.querySelectorAll<HTMLSpanElement>(charSelector)
      );
      for (const charSpan of wordChars) {
        const targetElement = getCharKerningTarget(charSpan, mask);
        targetElement.style.marginLeft = "";
      }
    }
    return;
  }

  if (splitWords) {
    for (const wordSpan of allWords) {
      const targetElement = getWordKerningTarget(wordSpan, mask);
      targetElement.style.marginLeft = "";
    }
  }
}

export function applyKerningCompensation(
  element: HTMLElement,
  allWords: HTMLSpanElement[],
  charClass: string,
  splitChars: boolean,
  splitWords: boolean,
  options?: KerningCompensationOptions
): void {
  if (options?.disableKerning) return;

  if (splitChars && allWords.length > 0) {
    const charSelector = classSelector(charClass);
    if (!charSelector) return;

    // 1. Measure kerning within each word
    for (const wordSpan of allWords) {
      const wordChars = Array.from(
        wordSpan.querySelectorAll<HTMLSpanElement>(charSelector)
      );
      if (wordChars.length < 2) continue;

      // Skip kerning for contextual scripts (Arabic, Hebrew, Thai, etc.)
      // These scripts have letters that change form based on position,
      // making character-by-character kerning measurement inaccurate.
      const charStringsForCheck = wordChars.map((char) => char.textContent || "");
      if (hasContextualScript(charStringsForCheck)) continue;

      // Group consecutive chars by computed style to respect nested inline styles.
      const styleGroups: Array<{
        chars: HTMLSpanElement[];
        styleSource: HTMLSpanElement;
        styles: CSSStyleDeclaration;
      }> = [];

      const firstCharStyles = getComputedStyle(wordChars[0]);
      let currentKey = buildKerningStyleKey(firstCharStyles);
      let currentGroup: {
        chars: HTMLSpanElement[];
        styleSource: HTMLSpanElement;
        styles: CSSStyleDeclaration;
      } = {
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
        const charStrings = group.chars.map((char) => char.textContent || "");
        const kerningMap = measureKerning(
          element,
          group.styleSource,
          charStrings,
          group.styles,
          options?.isolateKerningMeasurement !== false
        );

        // Apply kerning adjustments (negative = tighter, positive = looser)
        for (const [charIndex, kerning] of kerningMap) {
          const charSpan = group.chars[charIndex];
          // Apply with sanity bound (< 20px in either direction)
          if (charSpan && Math.abs(kerning) < 20) {
            const targetElement = getCharKerningTarget(charSpan, options?.mask);
            targetElement.style.marginLeft = `${kerning}px`;
          }
        }
      }
    }

    // 2. Measure kerning across word boundaries (lastChar + space + firstChar)
    for (let wordIdx = 1; wordIdx < allWords.length; wordIdx++) {
      const currWord = allWords[wordIdx];
      // Skip words that don't have a space before them (dash continuations)
      if (hasNoSpaceBefore(currWord) || hasHardBreakBefore(currWord)) {
        continue;
      }

      const prevWord = allWords[wordIdx - 1];
      const prevChars = Array.from(
        prevWord.querySelectorAll<HTMLSpanElement>(charSelector)
      );
      const currChars = Array.from(
        currWord.querySelectorAll<HTMLSpanElement>(charSelector)
      );

      if (prevChars.length === 0 || currChars.length === 0) continue;

      const lastCharSpan = prevChars[prevChars.length - 1];
      const firstCharSpan = currChars[0];
      const lastChar = lastCharSpan.textContent || "";
      const firstChar = firstCharSpan.textContent || "";
      if (!lastChar || !firstChar) continue;

      // Skip kerning for contextual scripts
      if (hasContextualScript([lastChar, firstChar])) continue;

      // Measure the full cross-word kerning: "lastChar + space + firstChar"
      // Total kerning = width("X Y") - width("X") - width(" ") - width("Y")
      const styles = getComputedStyle(firstCharSpan);
      const kerningMap = measureKerning(
        element,
        firstCharSpan,
        [lastChar, " ", firstChar],
        styles,
        options?.isolateKerningMeasurement !== false
      );

      // kerningMap will have kerning at index 1 (space) and index 2 (firstChar)
      // We apply the sum to the first char of the next word
      let totalKerning = 0;
      if (kerningMap.has(1)) totalKerning += kerningMap.get(1)!;
      if (kerningMap.has(2)) totalKerning += kerningMap.get(2)!;

      if (Math.abs(totalKerning) > 0.001 && Math.abs(totalKerning) < 20) {
        const targetElement = getCharKerningTarget(firstCharSpan, options?.mask);
        targetElement.style.marginLeft = `${totalKerning}px`;
      }
    }
    return;
  }

  if (splitWords && allWords.length > 1) {
    // Cross-word kerning for word-only splitting (no char spans)
    // Apply margin to the word span itself
    for (let wordIdx = 1; wordIdx < allWords.length; wordIdx++) {
      const currWord = allWords[wordIdx];
      if (hasNoSpaceBefore(currWord) || hasHardBreakBefore(currWord)) {
        continue;
      }

      const prevWord = allWords[wordIdx - 1];

      const prevText = prevWord.textContent || "";
      const currText = currWord.textContent || "";
      if (!prevText || !currText) continue;

      // Get last char of previous word and first char of current word
      const lastChar = prevText[prevText.length - 1];
      const firstChar = currText[0];

      // Skip kerning for contextual scripts
      if (hasContextualScript([lastChar, firstChar])) continue;

      // Measure the full cross-word kerning
      const styles = getComputedStyle(currWord);
      const kerningMap = measureKerning(
        element,
        currWord,
        [lastChar, " ", firstChar],
        styles,
        options?.isolateKerningMeasurement !== false
      );

      let totalKerning = 0;
      if (kerningMap.has(1)) totalKerning += kerningMap.get(1)!;
      if (kerningMap.has(2)) totalKerning += kerningMap.get(2)!;

      if (Math.abs(totalKerning) > 0.001 && Math.abs(totalKerning) < 20) {
        const targetElement = getWordKerningTarget(currWord, options?.mask);
        targetElement.style.marginLeft = `${totalKerning}px`;
      }
    }
  }
}
