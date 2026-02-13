import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { splitText } from "../../core/splitText";
import { getLastResizeObserver, resetResizeObserver } from "../setup";

describe("splitText resize behavior", () => {
  let container: HTMLDivElement;
  let parentElement: HTMLDivElement;

  const getObservedTarget = (): HTMLElement => {
    const observer = getLastResizeObserver();
    const target = observer ? Array.from(observer.elements)[0] : null;
    if (!(target instanceof HTMLElement)) {
      throw new Error("Expected autoSplit observer target");
    }
    return target;
  };

  const createRect = (width: number): DOMRect =>
    ({
      top: 0,
      right: width,
      bottom: 20,
      left: 0,
      width,
      height: 20,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;

  beforeEach(() => {
    vi.useFakeTimers();
    resetResizeObserver();

    container = document.createElement("div");
    document.body.appendChild(container);

    parentElement = document.createElement("div");
    container.appendChild(parentElement);
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.removeChild(container);
  });

  it("creates ResizeObserver when autoSplit is true", () => {
    const element = document.createElement("p");
    element.textContent = "Hello World";
    parentElement.appendChild(element);

    splitText(element, { autoSplit: true });

    const observer = getLastResizeObserver();
    expect(observer).not.toBeNull();
    expect(observer?.elements.size).toBe(1);
    expect(getObservedTarget()).toBe(container);
  });

  it("sets up kerning upkeep observer when autoSplit is false", () => {
    const element = document.createElement("p");
    element.textContent = "Hello World";
    parentElement.appendChild(element);

    splitText(element, { autoSplit: false, type: "chars,words" });

    const observer = getLastResizeObserver();
    expect(observer).not.toBeNull();
    expect(observer?.elements.has(element)).toBe(true);
  });

  it("debounces resize events with 100ms delay", () => {
    const element = document.createElement("p");
    element.textContent = "Hello World";
    parentElement.appendChild(element);

    const onResplit = vi.fn();
    splitText(element, { autoSplit: true, onResplit });

    const observer = getLastResizeObserver();
    expect(observer).not.toBeNull();

    // Trigger multiple rapid resize events
    observer!.trigger([{ contentRect: { width: 100 } }]);
    observer!.trigger([{ contentRect: { width: 150 } }]);
    observer!.trigger([{ contentRect: { width: 200 } }]);

    // onResplit should not have been called yet (debounce pending)
    expect(onResplit).not.toHaveBeenCalled();

    // Advance timers by 100ms
    vi.advanceTimersByTime(100);

    // Need to run requestAnimationFrame callback
    vi.runAllTimers();
  });

  it("skips first resize event (initial observation)", () => {
    const element = document.createElement("p");
    element.textContent = "Hello World";
    parentElement.appendChild(element);

    const onResplit = vi.fn();
    splitText(element, { autoSplit: true, onResplit });

    const observer = getLastResizeObserver();

    // First trigger should be skipped
    observer!.trigger([{ contentRect: { width: 100 } }]);

    vi.advanceTimersByTime(100);
    vi.runAllTimers();

    // Should not have called onResplit because first event is skipped
    expect(onResplit).not.toHaveBeenCalled();
  });

  it("disconnects observer on dispose", () => {
    const element = document.createElement("p");
    element.textContent = "Hello World";
    parentElement.appendChild(element);

    const result = splitText(element, { autoSplit: true });

    const observer = getLastResizeObserver();
    expect(observer?.elements.size).toBe(1);

    // Revert (which calls dispose)
    result.revert();

    // Observer should be disconnected
    expect(observer?.elements.size).toBe(0);
  });

  it("warns when parent element is missing", () => {
    const element = document.createElement("p");
    element.textContent = "Hello World";
    // Don't append to any parent

    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    splitText(element, { autoSplit: true });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("autoSplit requires a parent element")
    );

    consoleSpy.mockRestore();
  });

  it("does not trigger onResplit when width stays the same", () => {
    const element = document.createElement("p");
    element.textContent = "Hello World";
    parentElement.appendChild(element);

    const onResplit = vi.fn();
    splitText(element, { autoSplit: true, onResplit });

    const observer = getLastResizeObserver();
    const target = getObservedTarget();
    Object.defineProperty(target, "offsetWidth", {
      value: 500,
      writable: true,
    });

    // Skip first event
    observer!.trigger([{ contentRect: { width: 500 } }]);

    // Second event with same width
    observer!.trigger([{ contentRect: { width: 500 } }]);

    vi.advanceTimersByTime(100);
    vi.runAllTimers();

    // onResplit should not be called since width didn't change
    expect(onResplit).not.toHaveBeenCalled();
  });

  it("measures line fingerprints using rendered element width when target width differs", () => {
    const element = document.createElement("p");
    element.textContent = "This text reflows naturally at any width.";
    parentElement.appendChild(element);

    Object.defineProperty(parentElement, "offsetWidth", {
      value: 400,
      writable: true,
      configurable: true,
    });

    const parentRectSpy = vi
      .spyOn(parentElement, "getBoundingClientRect")
      .mockReturnValue(createRect(420));
    const elementRectSpy = vi
      .spyOn(element, "getBoundingClientRect")
      .mockReturnValue(createRect(388));

    const originalAppendChild = parentElement.appendChild.bind(parentElement);
    const probeWidths: string[] = [];
    const appendSpy = vi
      .spyOn(parentElement, "appendChild")
      .mockImplementation((node: Node) => {
        if (
          node instanceof HTMLElement &&
          node.dataset.fettaAutoSplitProbe === "true"
        ) {
          probeWidths.push(node.style.width);
        }
        return originalAppendChild(node);
      });

    splitText(element, { autoSplit: true, type: "chars,words,lines" });

    const observer = getLastResizeObserver();
    expect(observer).not.toBeNull();
    expect(getObservedTarget()).toBe(parentElement);

    // First callback is skipped by design.
    observer!.trigger([{ contentRect: { width: 400 } }]);

    Object.defineProperty(parentElement, "offsetWidth", {
      value: 420,
      writable: true,
      configurable: true,
    });
    observer!.trigger([{ contentRect: { width: 420 } }]);

    vi.advanceTimersByTime(100);
    vi.runAllTimers();

    expect(probeWidths.length).toBeGreaterThan(0);
    expect(probeWidths[probeWidths.length - 1]).toBe("388px");

    appendSpy.mockRestore();
    elementRectSpy.mockRestore();
    parentRectSpy.mockRestore();
  });

  it("auto-disposes when element is removed from DOM", () => {
    const element = document.createElement("p");
    element.textContent = "Hello World";
    parentElement.appendChild(element);

    const onResplit = vi.fn();
    splitText(element, { autoSplit: true, onResplit });

    const observer = getLastResizeObserver();
    const target = getObservedTarget();

    // Skip first event
    observer!.trigger([{ contentRect: { width: 100 } }]);

    // Remove element from DOM
    parentElement.removeChild(element);

    // Trigger resize after element removed
    Object.defineProperty(target, "offsetWidth", {
      value: 600,
      writable: true,
    });
    observer!.trigger([{ contentRect: { width: 600 } }]);

    vi.advanceTimersByTime(100);
    vi.runAllTimers();

    // onResplit should not be called since element is disconnected
    expect(onResplit).not.toHaveBeenCalled();
  });

  it("updates kerning-only without rebuilding nodes when lines are disabled", () => {
    const element = document.createElement("p");
    element.textContent = "Hello World";
    parentElement.appendChild(element);
    element.style.fontSize = "20px";

    const onResplit = vi.fn();
    const result = splitText(element, {
      autoSplit: false,
      type: "chars,words",
      onResplit,
    });

    const firstCharBefore = result.chars[0];
    const firstWordBefore = result.words[0];
    expect(firstCharBefore).toBeTruthy();
    expect(firstWordBefore).toBeTruthy();

    element.style.fontSize = "32px";
    window.dispatchEvent(new Event("resize"));
    vi.advanceTimersByTime(100);
    vi.runAllTimers();

    const firstCharAfter = element.querySelector<HTMLSpanElement>(".split-char");
    const firstWordAfter = element.querySelector<HTMLSpanElement>(".split-word");
    expect(firstCharAfter).toBe(firstCharBefore);
    expect(firstWordAfter).toBe(firstWordBefore);
    expect(onResplit).not.toHaveBeenCalled();
  });

  it("does not run full resplit when style changes in line mode and autoSplit is false", () => {
    const element = document.createElement("p");
    element.textContent = "Hello World";
    parentElement.appendChild(element);
    element.style.fontSize = "20px";

    const onResplit = vi.fn();
    splitText(element, {
      autoSplit: false,
      type: "chars,words,lines",
      onResplit,
    });

    const firstLineBefore = element.querySelector<HTMLSpanElement>(".split-line");
    expect(firstLineBefore).toBeTruthy();

    element.style.fontSize = "32px";
    window.dispatchEvent(new Event("resize"));
    vi.advanceTimersByTime(100);
    vi.runAllTimers();

    const firstLineAfter = element.querySelector<HTMLSpanElement>(".split-line");
    expect(firstLineAfter).toBeTruthy();
    expect(firstLineAfter).toBe(firstLineBefore);
    expect(onResplit).not.toHaveBeenCalled();
  });

  it("runs full resplit when style changes in line mode and autoSplit is true", () => {
    const element = document.createElement("p");
    element.textContent = "Hello World";
    parentElement.appendChild(element);
    element.style.fontSize = "20px";

    const onResplit = vi.fn();
    splitText(element, {
      autoSplit: true,
      type: "chars,words,lines",
      onResplit,
    });

    const firstLineBefore = element.querySelector<HTMLSpanElement>(".split-line");
    expect(firstLineBefore).toBeTruthy();

    element.style.fontSize = "32px";
    window.dispatchEvent(new Event("resize"));
    vi.advanceTimersByTime(100);
    vi.runAllTimers();

    const firstLineAfter = element.querySelector<HTMLSpanElement>(".split-line");
    expect(firstLineAfter).toBeTruthy();
    expect(firstLineAfter).not.toBe(firstLineBefore);
    expect(onResplit).toHaveBeenCalledTimes(1);
  });

  it("skips full resplit on width changes when line grouping is unchanged", () => {
    const element = document.createElement("p");
    element.textContent = "Hi";
    parentElement.appendChild(element);

    const onResplit = vi.fn();
    splitText(element, {
      autoSplit: true,
      type: "chars,words,lines",
      onResplit,
    });

    const observer = getLastResizeObserver();
    const target = getObservedTarget();
    Object.defineProperty(target, "offsetWidth", {
      value: 320,
      writable: true,
    });
    expect(observer).not.toBeNull();

    // Skip first observer callback by design.
    observer!.trigger([{ contentRect: { width: 320 } }]);

    // Trigger actual resize with different width while keeping the same one-line content.
    Object.defineProperty(target, "offsetWidth", {
      value: 420,
      writable: true,
    });
    observer!.trigger([{ contentRect: { width: 420 } }]);

    vi.advanceTimersByTime(100);
    vi.runAllTimers();

    expect(onResplit).not.toHaveBeenCalled();
  });

  it("does not resplit when style key is unchanged", () => {
    const element = document.createElement("p");
    element.textContent = "Hello World";
    parentElement.appendChild(element);

    const result = splitText(element, {
      autoSplit: false,
      type: "chars,words",
    });

    const firstCharBefore = result.chars[0];
    window.dispatchEvent(new Event("resize"));
    vi.advanceTimersByTime(100);
    vi.runAllTimers();

    const firstCharAfter = element.querySelector<HTMLSpanElement>(".split-char");
    expect(firstCharAfter).toBe(firstCharBefore);
  });

  it("disconnects kerning observer on revert", () => {
    const element = document.createElement("p");
    element.textContent = "Hello World";
    parentElement.appendChild(element);

    const result = splitText(element, {
      autoSplit: false,
      type: "chars,words",
    });

    const observer = getLastResizeObserver();
    expect(observer?.elements.has(element)).toBe(true);

    result.revert();

    expect(observer?.elements.size).toBe(0);
  });
});
