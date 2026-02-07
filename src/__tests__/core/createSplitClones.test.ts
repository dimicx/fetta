import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { splitText } from "../../core/splitText";
import { createSplitClones } from "../../helpers/createSplitClones";

describe("createSplitClones", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("creates clones in the current parent when wrap is false", () => {
    const element = document.createElement("p");
    element.textContent = "Hello";
    container.appendChild(element);

    const split = splitText(element, { type: "chars", mask: "chars" });
    const result = createSplitClones(split, { unit: "chars" });

    expect(result.tracks).toHaveLength(0);
    expect(result.clones).toHaveLength(split.chars.length);

    result.items.forEach((item) => {
      expect(item.track).toBeNull();
      expect(item.clone.parentElement).toBe(item.original.parentElement);
    });
  });

  it("wraps originals and appends clones to the wrapped parent when wrap is true", () => {
    const element = document.createElement("p");
    element.textContent = "Hello";
    container.appendChild(element);

    const split = splitText(element, { type: "chars", mask: "chars" });
    const result = createSplitClones(split, { unit: "chars", wrap: true });

    expect(result.tracks).toHaveLength(split.chars.length);
    expect(result.clones).toHaveLength(split.chars.length);

    result.items.forEach((item) => {
      expect(item.track).not.toBeNull();
      expect(item.track?.contains(item.original)).toBe(true);
      expect(item.track?.contains(item.clone)).toBe(true);
      expect(item.clone.parentElement).toBe(item.original.parentElement);
    });
  });

  it("selects only the requested unit", () => {
    const element = document.createElement("p");
    element.textContent = "Hello World";
    container.appendChild(element);

    const split = splitText(element);
    const result = createSplitClones(split, { unit: "words" });

    expect(result.originals).toHaveLength(split.words.length);
    expect(result.clones).toHaveLength(split.words.length);
  });

  it("applies default and configured clone offsets", () => {
    const element = document.createElement("p");
    element.textContent = "Hello";
    container.appendChild(element);

    const split = splitText(element, { type: "chars" });

    const defaultOffset = createSplitClones(split, { unit: "chars" });
    expect(defaultOffset.clones[0].style.position).toBe("absolute");
    expect(defaultOffset.clones[0].style.left).toBe("0px");
    expect(defaultOffset.clones[0].style.top).toBe("-100%");
    defaultOffset.cleanup();

    const yEnd = createSplitClones(split, {
      unit: "chars",
      cloneOffset: { axis: "y", direction: "end" },
    });
    expect(yEnd.clones[0].style.left).toBe("0px");
    expect(yEnd.clones[0].style.top).toBe("100%");
    yEnd.cleanup();

    const xStart = createSplitClones(split, {
      unit: "chars",
      cloneOffset: { axis: "x", direction: "start" },
    });
    expect(xStart.clones[0].style.top).toBe("0px");
    expect(xStart.clones[0].style.left).toBe("-100%");
    xStart.cleanup();

    const xEnd = createSplitClones(split, {
      unit: "chars",
      cloneOffset: { axis: "x", direction: "end" },
    });
    expect(xEnd.clones[0].style.top).toBe("0px");
    expect(xEnd.clones[0].style.left).toBe("100%");
    xEnd.cleanup();
  });

  it("restores split-state DOM exactly on cleanup when wrapped", () => {
    const element = document.createElement("p");
    element.textContent = "Hello";
    container.appendChild(element);

    const split = splitText(element, { type: "chars", mask: "chars" });
    const splitHtml = element.innerHTML;

    const result = createSplitClones(split, { unit: "chars", wrap: true });
    expect(element.innerHTML).not.toBe(splitHtml);

    result.cleanup();
    expect(element.innerHTML).toBe(splitHtml);
    result.items.forEach((item) => {
      expect(item.track?.isConnected).toBe(false);
      expect(item.clone.isConnected).toBe(false);
    });
  });

  it("can call split.revert via cleanup option and remains idempotent", () => {
    const element = document.createElement("p");
    element.textContent = "Hello";
    container.appendChild(element);

    const split = splitText(element, { type: "chars" });
    const revertSpy = vi.spyOn(split, "revert");
    const result = createSplitClones(split, { unit: "chars", wrap: true });

    result.cleanup({ revertSplit: true });
    result.cleanup({ revertSplit: true });

    expect(revertSpy).toHaveBeenCalledTimes(1);
  });

  it("applies class and style callbacks to tracks and clones", () => {
    const element = document.createElement("p");
    element.textContent = "Hello";
    container.appendChild(element);

    const split = splitText(element, { type: "chars" });
    const result = createSplitClones(split, {
      unit: "chars",
      wrap: true,
      trackClassName: ({ index }) => `track-${index}`,
      cloneClassName: "clone-layer",
      trackStyle: { zIndex: "1" },
      cloneStyle: ({ index }) => ({
        opacity: "0.5",
        transform: `translateY(${index}px)`,
      }),
    });

    expect(result.tracks[0].classList.contains("track-0")).toBe(true);
    expect(result.tracks[0].style.zIndex).toBe("1");
    expect(result.clones[0].classList.contains("clone-layer")).toBe(true);
    expect(result.clones[0].style.opacity).toBe("0.5");
    expect(result.clones[1].style.transform).toBe("translateY(1px)");
  });

  it("works with nested inline markup without breaking ancestry", () => {
    const element = document.createElement("p");
    element.innerHTML = 'Click <a href="/link"><em>here</em></a>';
    container.appendChild(element);

    const split = splitText(element, { type: "chars", mask: "chars" });
    const result = createSplitClones(split, { unit: "chars" });

    expect(result.clones.some((clone) => clone.closest("a"))).toBe(true);
    expect(result.clones.some((clone) => clone.closest("em"))).toBe(true);
  });
});
