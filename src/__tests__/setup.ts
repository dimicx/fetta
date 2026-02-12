import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock ResizeObserver
export class MockResizeObserver {
  callback: ResizeObserverCallback;
  elements: Set<Element> = new Set();

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(element: Element) {
    this.elements.add(element);
  }

  unobserve(element: Element) {
    this.elements.delete(element);
  }

  disconnect() {
    this.elements.clear();
  }

  // Helper to trigger resize
  trigger(entries: Partial<ResizeObserverEntry>[]) {
    this.callback(entries as ResizeObserverEntry[], this);
  }
}

// Store the last created observer for test access
let lastResizeObserver: MockResizeObserver | null = null;
let resizeObservers: MockResizeObserver[] = [];

vi.stubGlobal(
  "ResizeObserver",
  vi.fn((callback: ResizeObserverCallback) => {
    lastResizeObserver = new MockResizeObserver(callback);
    resizeObservers.push(lastResizeObserver);
    return lastResizeObserver;
  })
);

export function getLastResizeObserver(): MockResizeObserver | null {
  return lastResizeObserver;
}

export function getResizeObservers(): MockResizeObserver[] {
  return [...resizeObservers];
}

export function resetResizeObserver() {
  lastResizeObserver = null;
  resizeObservers = [];
}

// Mock IntersectionObserver
export class MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  elements: Set<Element> = new Set();
  options: IntersectionObserverInit;

  constructor(
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit
  ) {
    this.callback = callback;
    this.options = options || {};
  }

  observe(element: Element) {
    this.elements.add(element);
  }

  unobserve(element: Element) {
    this.elements.delete(element);
  }

  disconnect() {
    this.elements.clear();
  }

  // Helper to simulate intersection
  trigger(entries: Partial<IntersectionObserverEntry>[]) {
    this.callback(entries as IntersectionObserverEntry[], this);
  }
}

// Store the last created observer for test access
let lastIntersectionObserver: MockIntersectionObserver | null = null;

vi.stubGlobal(
  "IntersectionObserver",
  vi.fn(
    (
      callback: IntersectionObserverCallback,
      options?: IntersectionObserverInit
    ) => {
      lastIntersectionObserver = new MockIntersectionObserver(
        callback,
        options
      );
      return lastIntersectionObserver;
    }
  )
);

export function getLastIntersectionObserver(): MockIntersectionObserver | null {
  return lastIntersectionObserver;
}

export function resetIntersectionObserver() {
  lastIntersectionObserver = null;
}

type MockDocumentFonts = { ready?: Promise<unknown> } | undefined;

function setDocumentFonts(value: MockDocumentFonts) {
  Object.defineProperty(document, "fonts", {
    value,
    writable: true,
    configurable: true,
  });
}

export function setDocumentFontsReady(ready: Promise<unknown>) {
  setDocumentFonts({ ready });
}

export function resetDocumentFontsReady() {
  setDocumentFontsReady(Promise.resolve());
}

export function removeDocumentFonts() {
  setDocumentFonts(undefined);
}

resetDocumentFontsReady();

// Mock Range API for getBoundingClientRect
const originalCreateRange = document.createRange.bind(document);

vi.spyOn(document, "createRange").mockImplementation(() => {
  const range = originalCreateRange();

  // Track the selected content for width calculation
  let selectedText = "";
  let charIndex = 0;
  const originalSetStart = range.setStart.bind(range);
  const originalSetEnd = range.setEnd.bind(range);
  const originalSelectNodeContents = range.selectNodeContents.bind(range);

  range.setStart = (node: Node, offset: number) => {
    charIndex = offset;
    return originalSetStart(node, offset);
  };

  range.setEnd = (node: Node, offset: number) => {
    return originalSetEnd(node, offset);
  };

  range.selectNodeContents = (node: Node) => {
    selectedText = node.textContent || "";
    try {
      return originalSelectNodeContents(node);
    } catch {
      // jsdom may throw if node is not in document; ignore
    }
  };

  range.getBoundingClientRect = () => {
    // When selectNodeContents was used, return width based on text length
    // This matches the text.length * 10 pattern used by Element.getBoundingClientRect mock
    const width = selectedText ? selectedText.length * 10 : 10;
    return {
      top: 0,
      right: charIndex * 10 + width,
      bottom: 20,
      left: charIndex * 10,
      width,
      height: 20,
      x: charIndex * 10,
      y: 0,
      toJSON: () => ({}),
    };
  };

  return range;
});

// Mock element.getBoundingClientRect for line detection
const originalGetBoundingClientRect =
  Element.prototype.getBoundingClientRect.bind;

vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
  function (this: Element) {
    // Return predictable bounding rect based on element's text content length
    const text = this.textContent || "";
    const dataIndex =
      this.getAttribute("data-char-index") ||
      this.getAttribute("data-word-index") ||
      this.getAttribute("data-line-index");
    const index = dataIndex ? parseInt(dataIndex, 10) : 0;

    return {
      top: 0,
      right: text.length * 10,
      bottom: 20,
      left: index * 10,
      width: text.length * 10,
      height: 20,
      x: index * 10,
      y: 0,
      toJSON: () => ({}),
    };
  }
);

// Reset mocks between tests
beforeEach(() => {
  resetResizeObserver();
  resetIntersectionObserver();
  resetDocumentFontsReady();
});
