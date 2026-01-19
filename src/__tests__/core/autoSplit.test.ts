import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { splitText } from "../../core/splitText";
import { getLastResizeObserver, resetResizeObserver } from "../setup";

describe("splitText autoSplit", () => {
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

  it("does not create ResizeObserver when autoSplit is false", () => {
    const element = document.createElement("p");
    element.textContent = "Hello World";
    parentElement.appendChild(element);

    splitText(element, { autoSplit: false });

    const observer = getLastResizeObserver();
    // Observer should not have been created (or at least not observing)
    expect(observer?.elements.size ?? 0).toBe(0);
  });

  it("debounces resize events with 200ms delay", () => {
    const element = document.createElement("p");
    element.textContent = "Hello World";
    parentElement.appendChild(element);

    const onResize = vi.fn();
    splitText(element, { autoSplit: true, onResize });

    const observer = getLastResizeObserver();
    expect(observer).not.toBeNull();

    // Trigger multiple rapid resize events
    observer!.trigger([{ contentRect: { width: 100 } }]);
    observer!.trigger([{ contentRect: { width: 150 } }]);
    observer!.trigger([{ contentRect: { width: 200 } }]);

    // onResize should not have been called yet (debounce pending)
    expect(onResize).not.toHaveBeenCalled();

    // Advance timers by 200ms
    vi.advanceTimersByTime(200);

    // Need to run requestAnimationFrame callback
    vi.runAllTimers();
  });

  it("skips first resize event (initial observation)", () => {
    const element = document.createElement("p");
    element.textContent = "Hello World";
    parentElement.appendChild(element);

    const onResize = vi.fn();
    splitText(element, { autoSplit: true, onResize });

    const observer = getLastResizeObserver();

    // First trigger should be skipped
    observer!.trigger([{ contentRect: { width: 100 } }]);

    vi.advanceTimersByTime(200);
    vi.runAllTimers();

    // Should not have called onResize because first event is skipped
    expect(onResize).not.toHaveBeenCalled();
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

  it("does not trigger onResize when width stays the same", () => {
    const element = document.createElement("p");
    element.textContent = "Hello World";
    parentElement.appendChild(element);

    // Mock offsetWidth to return consistent value
    Object.defineProperty(parentElement, "offsetWidth", {
      value: 500,
      writable: true,
    });

    const onResize = vi.fn();
    splitText(element, { autoSplit: true, onResize });

    const observer = getLastResizeObserver();

    // Skip first event
    observer!.trigger([{ contentRect: { width: 500 } }]);

    // Second event with same width
    observer!.trigger([{ contentRect: { width: 500 } }]);

    vi.advanceTimersByTime(200);
    vi.runAllTimers();

    // onResize should not be called since width didn't change
    expect(onResize).not.toHaveBeenCalled();
  });

  it("auto-disposes when element is removed from DOM", () => {
    const element = document.createElement("p");
    element.textContent = "Hello World";
    parentElement.appendChild(element);

    const onResize = vi.fn();
    splitText(element, { autoSplit: true, onResize });

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

    // onResize should not be called since element is disconnected
    expect(onResize).not.toHaveBeenCalled();
  });
});
