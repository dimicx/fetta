import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { splitText } from "../../core/splitText";
import { getLastResizeObserver, resetResizeObserver } from "../setup";

describe("splitText resize behavior", () => {
  let container: HTMLDivElement;
  let parentElement: HTMLDivElement;

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
    expect(observer?.elements.has(parentElement)).toBe(true);
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

  it("debounces resize events with 200ms delay", () => {
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

    // Advance timers by 200ms
    vi.advanceTimersByTime(200);

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

    vi.advanceTimersByTime(200);
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

    // Mock offsetWidth to return consistent value
    Object.defineProperty(parentElement, "offsetWidth", {
      value: 500,
      writable: true,
    });

    const onResplit = vi.fn();
    splitText(element, { autoSplit: true, onResplit });

    const observer = getLastResizeObserver();

    // Skip first event
    observer!.trigger([{ contentRect: { width: 500 } }]);

    // Second event with same width
    observer!.trigger([{ contentRect: { width: 500 } }]);

    vi.advanceTimersByTime(200);
    vi.runAllTimers();

    // onResplit should not be called since width didn't change
    expect(onResplit).not.toHaveBeenCalled();
  });

  it("auto-disposes when element is removed from DOM", () => {
    const element = document.createElement("p");
    element.textContent = "Hello World";
    parentElement.appendChild(element);

    const onResplit = vi.fn();
    splitText(element, { autoSplit: true, onResplit });

    const observer = getLastResizeObserver();

    // Skip first event
    observer!.trigger([{ contentRect: { width: 100 } }]);

    // Remove element from DOM
    parentElement.removeChild(element);

    // Trigger resize after element removed
    Object.defineProperty(parentElement, "offsetWidth", {
      value: 600,
      writable: true,
    });
    observer!.trigger([{ contentRect: { width: 600 } }]);

    vi.advanceTimersByTime(200);
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
    vi.advanceTimersByTime(200);
    vi.runAllTimers();

    const firstCharAfter = element.querySelector<HTMLSpanElement>(".split-char");
    const firstWordAfter = element.querySelector<HTMLSpanElement>(".split-word");
    expect(firstCharAfter).toBe(firstCharBefore);
    expect(firstWordAfter).toBe(firstWordBefore);
    expect(onResplit).not.toHaveBeenCalled();
  });

  it("runs full resplit when style changes and lines are enabled", () => {
    const element = document.createElement("p");
    element.textContent = "Hello World";
    parentElement.appendChild(element);
    element.style.fontSize = "20px";

    splitText(element, {
      autoSplit: false,
      type: "chars,words,lines",
    });

    const firstLineBefore = element.querySelector<HTMLSpanElement>(".split-line");
    expect(firstLineBefore).toBeTruthy();

    element.style.fontSize = "32px";
    window.dispatchEvent(new Event("resize"));
    vi.advanceTimersByTime(200);
    vi.runAllTimers();

    const firstLineAfter = element.querySelector<HTMLSpanElement>(".split-line");
    expect(firstLineAfter).toBeTruthy();
    expect(firstLineAfter).not.toBe(firstLineBefore);
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
    vi.advanceTimersByTime(200);
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
