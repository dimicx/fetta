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
    const { unmount, container } = render(
      <SplitText>
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
  });

  it("handles revertOnComplete with animation promise", async () => {
    let resolveAnimation: () => void;
    const animationPromise = new Promise<void>((resolve) => {
      resolveAnimation = resolve;
    });

    const { container } = render(
      <SplitText
        onSplit={() => ({ finished: animationPromise })}
        revertOnComplete
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
});
