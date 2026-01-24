import { describe, bench, beforeAll, afterAll } from "vitest";

// DOM-based kerning measurement (current implementation)
function measureKerningDOM(
  element: HTMLElement,
  chars: string[]
): Map<number, number> {
  const kerningMap = new Map<number, number>();
  if (chars.length < 2) return kerningMap;

  const measurer = document.createElement("span");
  measurer.style.cssText = `position: absolute; visibility: hidden; white-space: pre;`;

  const styles = getComputedStyle(element);
  measurer.style.font = styles.font;
  measurer.style.letterSpacing = styles.letterSpacing;
  measurer.style.wordSpacing = styles.wordSpacing;
  measurer.style.fontKerning = styles.fontKerning;
  measurer.style.fontVariantLigatures = "none";

  // @ts-expect-error - webkit property
  const webkitSmoothing = styles.webkitFontSmoothing;
  // @ts-expect-error - moz property
  const mozSmoothing = styles.MozOsxFontSmoothing;
  if (webkitSmoothing) {
    // @ts-expect-error - webkit property
    measurer.style.webkitFontSmoothing = webkitSmoothing;
  }
  if (mozSmoothing) {
    // @ts-expect-error - moz property
    measurer.style.MozOsxFontSmoothing = mozSmoothing;
  }

  element.appendChild(measurer);

  for (let i = 0; i < chars.length - 1; i++) {
    const char1 = chars[i];
    const char2 = chars[i + 1];
    const pair = char1 + char2;

    measurer.textContent = pair;
    const pairWidth = measurer.getBoundingClientRect().width;

    measurer.textContent = char1;
    const char1Width = measurer.getBoundingClientRect().width;

    measurer.textContent = char2;
    const char2Width = measurer.getBoundingClientRect().width;

    const kerning = pairWidth - char1Width - char2Width;
    if (Math.abs(kerning) > 0.01) {
      kerningMap.set(i + 1, kerning);
    }
  }

  element.removeChild(measurer);
  return kerningMap;
}

// Canvas-based kerning measurement (previous implementation)
function measureKerningCanvas(
  element: HTMLElement,
  chars: string[]
): Map<number, number> {
  const kerningMap = new Map<number, number>();
  if (chars.length < 2) return kerningMap;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  const styles = getComputedStyle(element);
  ctx.font = styles.font;

  for (let i = 0; i < chars.length - 1; i++) {
    const char1 = chars[i];
    const char2 = chars[i + 1];
    const pair = char1 + char2;

    const pairWidth = ctx.measureText(pair).width;
    const char1Width = ctx.measureText(char1).width;
    const char2Width = ctx.measureText(char2).width;

    const kerning = pairWidth - char1Width - char2Width;
    if (Math.abs(kerning) > 0.01) {
      kerningMap.set(i + 1, kerning);
    }
  }

  return kerningMap;
}

// Range API-based measurement (original implementation)
function measureKerningRange(
  element: HTMLElement,
  chars: string[]
): Map<number, number> {
  const kerningMap = new Map<number, number>();
  if (chars.length < 2) return kerningMap;

  // Create text node for measurement
  const textNode = document.createTextNode(chars.join(""));
  const wrapper = document.createElement("span");
  wrapper.style.cssText = `position: absolute; visibility: hidden; white-space: pre;`;

  const styles = getComputedStyle(element);
  wrapper.style.font = styles.font;
  wrapper.style.letterSpacing = styles.letterSpacing;
  wrapper.style.fontKerning = styles.fontKerning;
  wrapper.style.fontVariantLigatures = "none";

  wrapper.appendChild(textNode);
  element.appendChild(wrapper);

  const range = document.createRange();
  const positions: number[] = [];

  let offset = 0;
  for (let i = 0; i < chars.length; i++) {
    range.setStart(textNode, offset);
    range.setEnd(textNode, offset + chars[i].length);
    const rect = range.getBoundingClientRect();
    positions.push(rect.left);
    offset += chars[i].length;
  }

  // Calculate expected positions (sum of individual widths)
  let expectedX = positions[0];
  for (let i = 0; i < chars.length - 1; i++) {
    range.setStart(textNode, 0);
    range.setEnd(textNode, chars.slice(0, i + 1).join("").length);
    const charEndX = range.getBoundingClientRect().right;

    const actualNextX = positions[i + 1];
    const expectedNextX = charEndX;
    const kerning = actualNextX - expectedNextX;

    if (Math.abs(kerning) > 0.01) {
      kerningMap.set(i + 1, kerning);
    }
    expectedX = charEndX;
  }

  element.removeChild(wrapper);
  return kerningMap;
}

describe("Kerning Measurement Performance", () => {
  let container: HTMLDivElement;
  let testElement: HTMLParagraphElement;

  const shortText = "Hello World";
  const mediumText =
    "The quick brown fox jumps over the lazy dog. Typography matters.";
  const longText =
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.";

  beforeAll(() => {
    container = document.createElement("div");
    container.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      font-family: "Inter", system-ui, sans-serif;
      font-size: 16px;
      -webkit-font-smoothing: antialiased;
    `;
    document.body.appendChild(container);

    testElement = document.createElement("p");
    testElement.style.cssText = `font-family: inherit; font-size: inherit;`;
    container.appendChild(testElement);
  });

  afterAll(() => {
    document.body.removeChild(container);
  });

  describe("Short text (11 chars)", () => {
    const chars = [...shortText];

    bench("DOM-based", () => {
      measureKerningDOM(testElement, chars);
    });

    bench("Canvas-based", () => {
      measureKerningCanvas(testElement, chars);
    });

    bench("Range API", () => {
      measureKerningRange(testElement, chars);
    });
  });

  describe("Medium text (64 chars)", () => {
    const chars = [...mediumText];

    bench("DOM-based", () => {
      measureKerningDOM(testElement, chars);
    });

    bench("Canvas-based", () => {
      measureKerningCanvas(testElement, chars);
    });

    bench("Range API", () => {
      measureKerningRange(testElement, chars);
    });
  });

  describe("Long text (228 chars)", () => {
    const chars = [...longText];

    bench("DOM-based", () => {
      measureKerningDOM(testElement, chars);
    });

    bench("Canvas-based", () => {
      measureKerningCanvas(testElement, chars);
    });

    bench("Range API", () => {
      measureKerningRange(testElement, chars);
    });
  });
});
