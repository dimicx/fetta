var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));

// src/core/splitText.ts
var BREAK_CHARS = /* @__PURE__ */ new Set(["\u2014", "\u2013"]);
function segmentGraphemes(text) {
  const segmenter = new Intl.Segmenter(void 0, { granularity: "grapheme" });
  return [...segmenter.segment(text)].map((s) => s.segment);
}
function measureOriginalText(element, splitChars) {
  const range = document.createRange();
  const words = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node;
  let currentWord = [];
  let wordStartLeft = null;
  let noSpaceBeforeNext = false;
  const pushWord = () => {
    if (currentWord.length > 0) {
      words.push({
        chars: currentWord,
        startLeft: wordStartLeft != null ? wordStartLeft : 0,
        noSpaceBefore: noSpaceBeforeNext
      });
      currentWord = [];
      wordStartLeft = null;
      noSpaceBeforeNext = false;
    }
  };
  while (node = walker.nextNode()) {
    const text = node.textContent || "";
    const graphemes = segmentGraphemes(text);
    let charOffset = 0;
    for (const grapheme of graphemes) {
      if (grapheme === " " || grapheme === "\n" || grapheme === "	") {
        pushWord();
        charOffset += grapheme.length;
        continue;
      }
      if (splitChars) {
        range.setStart(node, charOffset);
        range.setEnd(node, charOffset + grapheme.length);
        const rect = range.getBoundingClientRect();
        if (wordStartLeft === null) {
          wordStartLeft = rect.left;
        }
        currentWord.push({ char: grapheme, left: rect.left });
      } else {
        currentWord.push({ char: grapheme, left: 0 });
      }
      if (BREAK_CHARS.has(grapheme)) {
        pushWord();
        noSpaceBeforeNext = true;
      }
      charOffset += grapheme.length;
    }
  }
  pushWord();
  return words;
}
function createSpan(className, index, display = "inline-block", options) {
  const span = document.createElement("span");
  if (className) {
    span.className = className;
  }
  if (index !== void 0) {
    span.dataset.index = index.toString();
    if ((options == null ? void 0 : options.propIndex) && (options == null ? void 0 : options.propName)) {
      span.style.setProperty(`--${options.propName}-index`, index.toString());
    }
  }
  span.style.display = display;
  span.style.position = "relative";
  if (options == null ? void 0 : options.willChange) {
    span.style.willChange = "transform, opacity";
  }
  return span;
}
function groupIntoLines(elements, element) {
  const fontSize = parseFloat(getComputedStyle(element).fontSize);
  const tolerance = Math.max(5, fontSize * 0.3);
  const lineGroups = [];
  let currentLine = [];
  let currentY = null;
  elements.forEach((el) => {
    const rect = el instanceof HTMLElement ? el.getBoundingClientRect() : el.parentElement.getBoundingClientRect();
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
function performSplit(element, measuredWords, charClass, wordClass, lineClass, splitChars, splitWords, splitLines, options) {
  element.textContent = "";
  const allChars = [];
  const allWords = [];
  const needWordWrappers = splitChars || splitWords;
  if (needWordWrappers) {
    const noSpaceBeforeSet = /* @__PURE__ */ new Set();
    measuredWords.forEach((measuredWord, wordIndex) => {
      const wordSpan = createSpan(wordClass, wordIndex, "inline-block", {
        propIndex: options == null ? void 0 : options.propIndex,
        willChange: options == null ? void 0 : options.willChange,
        propName: "word"
      });
      if (measuredWord.noSpaceBefore) {
        noSpaceBeforeSet.add(wordSpan);
      }
      if (splitChars) {
        measuredWord.chars.forEach((measuredChar, charIndex) => {
          const charSpan = createSpan(charClass, charIndex, "inline-block", {
            propIndex: options == null ? void 0 : options.propIndex,
            willChange: options == null ? void 0 : options.willChange,
            propName: "char"
          });
          charSpan.textContent = measuredChar.char;
          if (charIndex > 0) {
            const prevCharLeft = measuredWord.chars[charIndex - 1].left;
            const gap = measuredChar.left - prevCharLeft;
            charSpan.dataset.expectedGap = gap.toString();
          }
          wordSpan.appendChild(charSpan);
          allChars.push(charSpan);
        });
      } else {
        wordSpan.textContent = measuredWord.chars.map((c) => c.char).join("");
      }
      allWords.push(wordSpan);
    });
    allWords.forEach((wordSpan, idx) => {
      element.appendChild(wordSpan);
      if (idx < allWords.length - 1 && !noSpaceBeforeSet.has(allWords[idx + 1])) {
        element.appendChild(document.createTextNode(" "));
      }
    });
    if (splitChars) {
      allWords.forEach((wordSpan) => {
        const chars = Array.from(wordSpan.children);
        if (chars.length < 2) return;
        const positions = chars.map((c) => c.getBoundingClientRect().left);
        for (let i = 1; i < chars.length; i++) {
          const charSpan = chars[i];
          const expectedGap = charSpan.dataset.expectedGap;
          if (expectedGap !== void 0) {
            const originalGap = parseFloat(expectedGap);
            const currentGap = positions[i] - positions[i - 1];
            const delta = originalGap - currentGap;
            if (Math.abs(delta) < 20) {
              const roundedDelta = Math.round(delta * 100) / 100;
              charSpan.style.marginLeft = `${roundedDelta}px`;
            }
            delete charSpan.dataset.expectedGap;
          }
        }
      });
    }
    if (splitLines) {
      const lineGroups = groupIntoLines(allWords, element);
      element.textContent = "";
      const allLines = [];
      lineGroups.forEach((words, lineIndex) => {
        const lineSpan = createSpan(lineClass, lineIndex, "block", {
          propIndex: options == null ? void 0 : options.propIndex,
          willChange: options == null ? void 0 : options.willChange,
          propName: "line"
        });
        allLines.push(lineSpan);
        words.forEach((wordSpan, wordIdx) => {
          lineSpan.appendChild(wordSpan);
          if (wordIdx < words.length - 1 && !noSpaceBeforeSet.has(words[wordIdx + 1])) {
            lineSpan.appendChild(document.createTextNode(" "));
          }
        });
        element.appendChild(lineSpan);
      });
      return {
        chars: allChars,
        words: splitWords ? allWords : [],
        lines: allLines
      };
    }
    return {
      chars: allChars,
      words: splitWords ? allWords : [],
      lines: []
    };
  } else {
    if (splitLines) {
      const wordWrappers = [];
      measuredWords.forEach((measuredWord, idx) => {
        const textNode = document.createTextNode(
          measuredWord.chars.map((c) => c.char).join("")
        );
        const wrapper = document.createElement("span");
        wrapper.style.display = "inline";
        wrapper.appendChild(textNode);
        element.appendChild(wrapper);
        wordWrappers.push({ wrapper, wordIndex: idx });
        if (idx < measuredWords.length - 1 && !measuredWords[idx + 1].noSpaceBefore) {
          const spaceNode = document.createTextNode(" ");
          element.appendChild(spaceNode);
        }
      });
      const lineGroups = groupIntoLines(wordWrappers.map((w) => w.wrapper), element);
      element.textContent = "";
      const allLines = [];
      lineGroups.forEach((wrappers, lineIndex) => {
        const lineSpan = createSpan(lineClass, lineIndex, "block", {
          propIndex: options == null ? void 0 : options.propIndex,
          willChange: options == null ? void 0 : options.willChange,
          propName: "line"
        });
        allLines.push(lineSpan);
        wrappers.forEach((wrapper, wrapperIdx) => {
          while (wrapper.firstChild) {
            lineSpan.appendChild(wrapper.firstChild);
          }
          if (wrapperIdx < wrappers.length - 1) {
            const nextWrapper = wrappers[wrapperIdx + 1];
            const nextWordInfo = wordWrappers.find((w) => w.wrapper === nextWrapper);
            if (nextWordInfo && !measuredWords[nextWordInfo.wordIndex].noSpaceBefore) {
              lineSpan.appendChild(document.createTextNode(" "));
            }
          }
        });
        element.appendChild(lineSpan);
      });
      return { chars: [], words: [], lines: allLines };
    } else {
      const fullText = measuredWords.map((w) => w.chars.map((c) => c.char).join("")).join(" ");
      element.textContent = fullText;
      return { chars: [], words: [], lines: [] };
    }
  }
}
function splitText(element, {
  type = "chars,words,lines",
  charClass = "split-char",
  wordClass = "split-word",
  lineClass = "split-line",
  autoSplit = false,
  onResize,
  revertOnComplete,
  propIndex = false,
  willChange = false
} = {}) {
  var _a;
  if (!(element instanceof HTMLElement)) {
    throw new Error("splitText: element must be an HTMLElement");
  }
  const text = (_a = element.textContent) == null ? void 0 : _a.trim();
  if (!text) {
    console.warn("splitText: element has no text content");
    return {
      chars: [],
      words: [],
      lines: [],
      revert: () => {
      },
      dispose: () => {
      }
    };
  }
  if (autoSplit && !element.parentElement) {
    console.warn(
      "splitText: autoSplit requires a parent element. AutoSplit will not work."
    );
  }
  const originalHTML = element.innerHTML;
  let splitChars = type.includes("chars");
  let splitWords = type.includes("words");
  let splitLines = type.includes("lines");
  if (!splitChars && !splitWords && !splitLines) {
    console.warn('splitText: type must include at least one of: chars, words, lines. Defaulting to "chars,words,lines".');
    splitChars = splitWords = splitLines = true;
  }
  let isActive = true;
  let resizeObserver = null;
  let debounceTimer = null;
  let lastWidth = null;
  let currentChars = [];
  let currentWords = [];
  let currentLines = [];
  element.setAttribute("aria-label", text);
  if (splitChars) {
    element.style.fontVariantLigatures = "none";
  }
  const measuredWords = measureOriginalText(element, splitChars);
  const { chars, words, lines } = performSplit(
    element,
    measuredWords,
    charClass,
    wordClass,
    lineClass,
    splitChars,
    splitWords,
    splitLines,
    { propIndex, willChange }
  );
  currentChars = chars;
  currentWords = words;
  currentLines = lines;
  const dispose = () => {
    if (!isActive) return;
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    isActive = false;
  };
  const revert = () => {
    if (!isActive) return;
    element.innerHTML = originalHTML;
    element.removeAttribute("aria-label");
    if (splitChars) {
      element.style.fontVariantLigatures = "none";
    }
    dispose();
  };
  if (autoSplit) {
    const target = element.parentElement;
    if (!target) {
      console.warn(
        "SplitText: autoSplit enabled but no parent element found. AutoSplit will not work."
      );
    } else {
      let skipFirst = true;
      const handleResize = () => {
        if (!isActive) return;
        const currentWidth = target.offsetWidth;
        if (currentWidth === lastWidth) return;
        lastWidth = currentWidth;
        element.innerHTML = originalHTML;
        requestAnimationFrame(() => {
          if (!isActive) return;
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
            { propIndex, willChange }
          );
          currentChars = result.chars;
          currentWords = result.words;
          currentLines = result.lines;
          if (onResize) {
            onResize({
              chars: result.chars,
              words: result.words,
              lines: result.lines
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
  if (revertOnComplete !== void 0) {
    if (revertOnComplete instanceof Promise) {
      revertOnComplete.then(() => {
        if (isActive) {
          revert();
        }
      }).catch((err) => {
        console.warn("SplitText: revertOnComplete promise rejected:", err);
      });
    } else {
      console.warn(
        "SplitText: revertOnComplete must be a Promise. Pass the animation promise (e.g., animate(...).finished)"
      );
    }
  }
  return {
    chars: currentChars,
    words: currentWords,
    lines: currentLines,
    revert,
    dispose
  };
}

export { __spreadProps, __spreadValues, splitText };
