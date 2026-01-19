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

vi.stubGlobal(
  "ResizeObserver",
  vi.fn((callback: ResizeObserverCallback) => {
    lastResizeObserver = new MockResizeObserver(callback);
    return lastResizeObserver;
  })
);

export function getLastResizeObserver(): MockResizeObserver | null {
  return lastResizeObserver;
}

export function resetResizeObserver() {
  lastResizeObserver = null;
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

// Mock document.fonts.ready
Object.defineProperty(document, "fonts", {
  value: {
    ready: Promise.resolve(),
  },
  writable: true,
});

// Mock Range API for getBoundingClientRect
const originalCreateRange = document.createRange.bind(document);

vi.spyOn(document, "createRange").mockImplementation(() => {
  const range = originalCreateRange();

  // Mock getBoundingClientRect to return predictable positions
  let charIndex = 0;
  const originalSetStart = range.setStart.bind(range);
  const originalSetEnd = range.setEnd.bind(range);

  range.setStart = (node: Node, offset: number) => {
    charIndex = offset;
    return originalSetStart(node, offset);
  };

  range.setEnd = (node: Node, offset: number) => {
    return originalSetEnd(node, offset);
  };

  range.getBoundingClientRect = () => ({
    top: 0,
    right: charIndex * 10 + 10,
    bottom: 20,
    left: charIndex * 10,
    width: 10,
    height: 20,
    x: charIndex * 10,
    y: 0,
    toJSON: () => ({}),
  });

  return range;
});

// Mock element.getBoundingClientRect for line detection
const originalGetBoundingClientRect =
  Element.prototype.getBoundingClientRect.bind;

vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
  function (this: Element) {
    // Return predictable bounding rect based on element's text content length
    const text = this.textContent || "";
    const dataIndex = this.getAttribute("data-index");
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
});
