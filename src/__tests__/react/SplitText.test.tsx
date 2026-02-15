import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, cleanup, act } from "@testing-library/react";
import { SplitText } from "../../react/SplitText";
import {
  resetResizeObserver,
  getLastResizeObserver,
  removeDocumentFonts,
  setDocumentFontsReady,
} from "../setup";
import React, { StrictMode } from "react";

describe("SplitText React Component", () => {
  beforeEach(() => {
    resetResizeObserver();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders children and makes them visible after split", async () => {
    const { container } = render(
      <SplitText>
        <h1>Hello World</h1>
      </SplitText>
    );

    // Wait for fonts.ready and split to complete
    await waitFor(() => {
      // Get the SplitText wrapper div (has visibility style)
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper?.style.visibility).toBe("visible");
    });

    // Text should be split into chars
    expect(container.querySelectorAll(".split-char").length).toBeGreaterThan(0);
  });

  it("calls onSplit callback with split elements", async () => {
    const onSplit = vi.fn();

    render(
      <SplitText onSplit={onSplit}>
        <p>Hello</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(onSplit).toHaveBeenCalled();
    });

    expect(onSplit).toHaveBeenCalledWith(
      expect.objectContaining({
        chars: expect.any(Array),
        words: expect.any(Array),
        lines: expect.any(Array),
        revert: expect.any(Function),
      })
    );
  });

  it("splits text into character spans", async () => {
    const { container } = render(
      <SplitText options={{ type: "chars", charClass: "my-char" }}>
        <p>Hi</p>
      </SplitText>
    );

    await waitFor(() => {
      const chars = container.querySelectorAll(".my-char");
      expect(chars.length).toBe(2);
    });
  });

  it("applies custom options", async () => {
    const { container } = render(
      <SplitText
        options={{
          type: "words",
          wordClass: "custom-word",
        }}
      >
        <p>Hello World</p>
      </SplitText>
    );

    await waitFor(() => {
      const words = container.querySelectorAll(".custom-word");
      expect(words.length).toBe(2);
    });
  });

  it("sets up ResizeObserver when autoSplit is true", async () => {
    render(
      <SplitText autoSplit>
        <p>Hello World</p>
      </SplitText>
    );

    await waitFor(() => {
      const observer = getLastResizeObserver();
      expect(observer).not.toBeNull();
    });
  });

  it("respects options.resplitDebounceMs for autoSplit resplits", async () => {
    const onResplit = vi.fn();
    const { container } = render(
      <SplitText
        autoSplit
        options={{ type: "chars,words", resplitDebounceMs: 0 }}
        onResplit={onResplit}
      >
        <p>Hello World</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".split-char").length).toBeGreaterThan(0);
    });

    const observer = getLastResizeObserver();
    expect(observer).not.toBeNull();
    const target = observer
      ? Array.from(observer.elements).find(
          (entry): entry is HTMLElement => entry instanceof HTMLElement
        )
      : null;
    expect(target).toBeTruthy();

    try {
      vi.useFakeTimers();

      observer!.trigger([{ target: target!, contentRect: { width: 320 } }]);
      observer!.trigger([{ target: target!, contentRect: { width: 420 } }]);

      expect(onResplit).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("updates kerning without replacing nodes when lines are disabled", async () => {
    const onResplit = vi.fn();
    const { container } = render(
      <SplitText
        options={{ type: "chars,words" }}
        onResplit={onResplit}
      >
        <p style={{ fontSize: "20px" }}>Hello World</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".split-char").length).toBeGreaterThan(0);
    });

    const firstCharBefore = container.querySelector(".split-char");
    const childElement = container.querySelector("p") as HTMLElement | null;
    expect(firstCharBefore).toBeTruthy();
    expect(childElement).toBeTruthy();

    await act(async () => {
      childElement!.style.fontSize = "32px";
      window.dispatchEvent(new Event("resize"));
      await new Promise((resolve) => setTimeout(resolve, 160));
    });

    const firstCharAfter = container.querySelector(".split-char");
    expect(firstCharAfter).toBe(firstCharBefore);
    expect(onResplit).not.toHaveBeenCalled();
  });

  it("does not run full resplit in line mode when typography style changes and autoSplit is false", async () => {
    const onResplit = vi.fn();
    const { container } = render(
      <SplitText options={{ type: "chars,words,lines" }} onResplit={onResplit}>
        <p style={{ fontSize: "20px" }}>Hello World</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".split-line").length).toBeGreaterThan(0);
    });

    const firstLineBefore = container.querySelector(".split-line");
    const childElement = container.querySelector("p") as HTMLElement | null;
    expect(firstLineBefore).toBeTruthy();
    expect(childElement).toBeTruthy();

    await act(async () => {
      childElement!.style.fontSize = "32px";
      window.dispatchEvent(new Event("resize"));
      await new Promise((resolve) => setTimeout(resolve, 160));
    });

    const firstLineAfter = container.querySelector(".split-line");
    expect(firstLineAfter).toBeTruthy();
    expect(firstLineAfter).toBe(firstLineBefore);
    expect(onResplit).not.toHaveBeenCalled();
  });

  it("runs full resplit in line mode when typography style changes and autoSplit is true", async () => {
    const onResplit = vi.fn();
    const { container } = render(
      <SplitText autoSplit options={{ type: "chars,words,lines" }} onResplit={onResplit}>
        <p style={{ fontSize: "20px" }}>Hello World</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".split-line").length).toBeGreaterThan(0);
    });

    const firstLineBefore = container.querySelector(".split-line");
    const childElement = container.querySelector("p") as HTMLElement | null;
    expect(firstLineBefore).toBeTruthy();
    expect(childElement).toBeTruthy();

    await act(async () => {
      childElement!.style.fontSize = "32px";
      window.dispatchEvent(new Event("resize"));
      await new Promise((resolve) => setTimeout(resolve, 160));
    });

    await waitFor(() => {
      expect(onResplit).toHaveBeenCalledTimes(1);
    });

    const lineFromCallback = onResplit.mock.calls[0]?.[0]?.lines?.[0] as
      | HTMLElement
      | undefined;
    const firstLineAfter = container.querySelector(".split-line");

    expect(firstLineAfter).toBeTruthy();
    expect(firstLineAfter).not.toBe(firstLineBefore);
    expect(lineFromCallback).toBeTruthy();
    expect(lineFromCallback).not.toBe(firstLineBefore);
  });

  it("skips width-driven full resplit when line grouping is unchanged", async () => {
    const onResplit = vi.fn();
    const { container } = render(
      <SplitText autoSplit options={{ type: "chars,words,lines" }} onResplit={onResplit}>
        <p>Hi</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".split-line").length).toBe(1);
    });

    const firstLineBefore = container.querySelector(".split-line");
    expect(firstLineBefore).toBeTruthy();

    const observer = getLastResizeObserver();
    expect(observer).not.toBeNull();
    const target = observer ? Array.from(observer.elements)[0] : null;
    expect(target instanceof HTMLElement).toBe(true);

    Object.defineProperty(target as HTMLElement, "offsetWidth", {
      value: 320,
      writable: true,
      configurable: true,
    });
    observer!.trigger([{ contentRect: { width: 320 } }]);

    Object.defineProperty(target as HTMLElement, "offsetWidth", {
      value: 420,
      writable: true,
      configurable: true,
    });
    observer!.trigger([{ contentRect: { width: 420 } }]);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 160));
    });

    const firstLineAfter = container.querySelector(".split-line");
    expect(firstLineAfter).toBe(firstLineBefore);
    expect(onResplit).not.toHaveBeenCalled();
  });

  it("waits for fonts by default before splitting", async () => {
    let resolveFonts: () => void = () => {};
    const fontsReady = new Promise<void>((resolve) => {
      resolveFonts = resolve;
    });
    setDocumentFontsReady(fontsReady);

    const { container } = render(
      <SplitText>
        <p>Hello</p>
      </SplitText>
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(container.querySelectorAll(".split-char").length).toBe(0);

    await act(async () => {
      resolveFonts();
      await fontsReady;
    });

    await waitFor(() => {
      expect(container.querySelectorAll(".split-char").length).toBeGreaterThan(0);
    });
  });

  it("skips waiting for fonts when waitForFonts is false", async () => {
    const fontsReady = new Promise<void>(() => {
      // Keep pending so we can assert split happens without waiting.
    });
    setDocumentFontsReady(fontsReady);

    const { container } = render(
      <SplitText waitForFonts={false}>
        <p>Hello</p>
      </SplitText>
    );
    const wrapper = container.firstChild as HTMLElement | null;
    expect(wrapper?.style.visibility).toBe("visible");

    await waitFor(() => {
      expect(container.querySelectorAll(".split-char").length).toBeGreaterThan(0);
    });
  });

  it("splits when document.fonts is unavailable", async () => {
    removeDocumentFonts();

    const { container } = render(
      <SplitText>
        <p>Hello</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".split-char").length).toBeGreaterThan(0);
    });
  });

  it("continues splitting when document.fonts.ready rejects", async () => {
    const fontsReady = new Promise<void>((_resolve, reject) => {
      queueMicrotask(() => reject(new Error("font loading failed")));
    });
    setDocumentFontsReady(fontsReady);

    const { container } = render(
      <SplitText>
        <p>Hello</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".split-char").length).toBeGreaterThan(0);
    });
  });

  it("reverts on unmount", async () => {
    const onRevert = vi.fn();
    const { unmount, container } = render(
      <SplitText onRevert={onRevert}>
        <p id="test-element">Hello</p>
      </SplitText>
    );

    await waitFor(() => {
      const chars = container.querySelectorAll(".split-char");
      expect(chars.length).toBeGreaterThan(0);
    });

    unmount();

    // After unmount, the element should be cleaned up from container
    expect(container.querySelector("#test-element")).toBeNull();
    expect(onRevert).toHaveBeenCalledTimes(1);
  });

  it("handles revertOnComplete with animation promise", async () => {
    const onRevert = vi.fn();
    let resolveAnimation: () => void;
    const animationPromise = new Promise<void>((resolve) => {
      resolveAnimation = resolve;
    });

    const { container } = render(
      <SplitText
        onSplit={() => ({ finished: animationPromise })}
        revertOnComplete
        onRevert={onRevert}
      >
        <p>Hello</p>
      </SplitText>
    );

    await waitFor(() => {
      const chars = container.querySelectorAll(".split-char");
      expect(chars.length).toBeGreaterThan(0);
    });

    // Resolve the animation
    await act(async () => {
      resolveAnimation!();
      await animationPromise;
    });

    await waitFor(() => {
      const p = container.querySelector("p");
      // After revert, text should be back to original
      expect(p?.textContent).toBe("Hello");
    });
    expect(onRevert).toHaveBeenCalledTimes(1);
  });

  it("fires onRevert once when revert is called manually", async () => {
    const onRevert = vi.fn();
    let splitResult: {
      revert: () => void;
    } | null = null;

    const { container } = render(
      <SplitText
        onSplit={(result) => {
          splitResult = result;
        }}
        onRevert={onRevert}
      >
        <p>Hello</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(splitResult).not.toBeNull();
      expect(container.querySelectorAll(".split-char").length).toBeGreaterThan(0);
    });

    act(() => {
      splitResult?.revert();
    });

    await waitFor(() => {
      expect(container.querySelectorAll(".split-char").length).toBe(0);
    });

    expect(onRevert).toHaveBeenCalledTimes(1);

    act(() => {
      splitResult?.revert();
    });
    expect(onRevert).toHaveBeenCalledTimes(1);
  });

  it("does not double-split in StrictMode", async () => {
    const onSplit = vi.fn();

    render(
      <StrictMode>
        <SplitText onSplit={onSplit}>
          <p>Hello</p>
        </SplitText>
      </StrictMode>
    );

    await waitFor(() => {
      expect(onSplit).toHaveBeenCalled();
    });

    // In StrictMode, effects run twice, but we should only split once
    // due to the hasSplitRef guard
    expect(onSplit).toHaveBeenCalledTimes(1);
  });

  it("logs error for invalid children", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <SplitText>
        {"plain string" as unknown as React.ReactElement}
      </SplitText>
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("children must be a single valid React element")
    );

    consoleSpy.mockRestore();
  });

  it("forwards ref to container div", async () => {
    const ref = React.createRef<HTMLDivElement>();

    render(
      <SplitText ref={ref}>
        <p>Hello</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  it("handles callback ref", async () => {
    const callbackRef = vi.fn();

    render(
      <SplitText ref={callbackRef}>
        <p>Hello</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(callbackRef).toHaveBeenCalledWith(expect.any(HTMLDivElement));
    });
  });

  it("forwards common wrapper HTML attributes", async () => {
    const { container } = render(
      <SplitText
        id="headline"
        role="heading"
        tabIndex={2}
        data-testid="split-wrapper"
        aria-label="Split heading"
      >
        <p>Hello</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".split-char").length).toBeGreaterThan(0);
    });

    const wrapper = container.firstElementChild as HTMLElement | null;
    expect(wrapper?.id).toBe("headline");
    expect(wrapper?.getAttribute("role")).toBe("heading");
    expect(wrapper?.tabIndex).toBe(2);
    expect(wrapper?.getAttribute("data-testid")).toBe("split-wrapper");
    expect(wrapper?.getAttribute("aria-label")).toBe("Split heading");
  });

  it("forwards wrapper event handlers", async () => {
    const onClick = vi.fn();
    const { container } = render(
      <SplitText onClick={onClick}>
        <p>Hello</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".split-char").length).toBeGreaterThan(0);
    });

    const wrapper = container.firstElementChild as HTMLElement | null;
    wrapper?.click();

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
