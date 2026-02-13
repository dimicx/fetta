import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, cleanup, act } from "@testing-library/react";
import React from "react";
import { getResizeObservers, resetResizeObserver } from "../setup";

vi.mock("motion", () => ({
  animate: vi.fn(() => ({ finished: Promise.resolve(), stop: vi.fn() })),
  scroll: vi.fn(() => vi.fn()),
}));

vi.mock("motion/react", async () => {
  const React = await import("react");

  const motion = new Proxy(
    {},
    {
      get: (_target, tag: string) =>
        React.forwardRef<HTMLElement, Record<string, unknown>>((props, ref) => {
          const {
            variants: _variants,
            custom: _custom,
            initial: _initial,
            animate: _animate,
            exit: _exit,
            transition: _transition,
            whileHover: _whileHover,
            onTapStart: _onTapStart,
            onTapCancel: _onTapCancel,
            onTap: _onTap,
            onFocus: _onFocus,
            onBlur: _onBlur,
            onHoverStart: _onHoverStart,
            onHoverEnd: _onHoverEnd,
            onAnimationComplete: _onAnimationComplete,
            ...rest
          } = props;
          return React.createElement(tag, { ...rest, ref }, props.children);
        }),
    }
  );

  return {
    motion,
    usePresence: () => [true, vi.fn()],
    useReducedMotion: () => false,
  };
});

import { SplitText } from "../../motion/SplitText";

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

async function triggerTypographyResize(element: HTMLElement, fontSize: string) {
  const prevFontSize = getComputedStyle(element).fontSize;
  await act(async () => {
    vi.useFakeTimers();
    element.style.fontSize = fontSize;
    const observers = getResizeObservers();
    const kerningObserver = observers.find((observer) =>
      Array.from(observer.elements).some(
        (entry) =>
          entry instanceof HTMLElement &&
          entry.isConnected &&
          entry.tagName === element.tagName
      )
    );
    kerningObserver?.trigger([{ target: element }]);
    window.dispatchEvent(new Event("resize"));
    vi.advanceTimersByTime(200);
    vi.runAllTimers();
    await Promise.resolve();
  });
  vi.useRealTimers();
  const nextFontSize = getComputedStyle(element).fontSize;
  expect(nextFontSize).not.toBe(prevFontSize);
}

async function triggerAutoSplitWidthResize(
  childElement: HTMLElement,
  width: number,
  targetIndex = 0
) {
  const observers = getResizeObservers();
  const widthObserver = observers.find((observer) =>
    Array.from(observer.elements).some(
      (entry) =>
        entry instanceof HTMLElement &&
        entry !== childElement &&
        entry.contains(childElement)
    )
  );
  const targets = widthObserver
    ? Array.from(widthObserver.elements).filter(
        (entry): entry is HTMLElement =>
          entry instanceof HTMLElement &&
          entry !== childElement &&
          entry.contains(childElement)
      )
    : [];
  const target = targets[targetIndex] ?? null;
  expect(widthObserver).toBeTruthy();
  expect(target).toBeTruthy();

  await act(async () => {
    vi.useFakeTimers();
    Object.defineProperty(target!, "offsetWidth", {
      value: width,
      writable: true,
      configurable: true,
    });
    widthObserver!.trigger([{ target: target!, contentRect: createRect(width) }]);
    vi.advanceTimersByTime(200);
    vi.runAllTimers();
    await Promise.resolve();
  });
  vi.useRealTimers();
}

function getAutoSplitTargets(childElement: HTMLElement): HTMLElement[] {
  const observers = getResizeObservers();
  const widthObserver = observers.find((observer) =>
    Array.from(observer.elements).some(
      (entry) =>
        entry instanceof HTMLElement &&
        entry !== childElement &&
        entry.contains(childElement)
    )
  );
  expect(widthObserver).toBeTruthy();

  return widthObserver
    ? Array.from(widthObserver.elements).filter(
        (entry): entry is HTMLElement =>
          entry instanceof HTMLElement &&
          entry !== childElement &&
          entry.contains(childElement)
      )
    : [];
}

describe("SplitText motion autoSplit kerning parity", () => {
  beforeEach(() => {
    resetResizeObserver();
  });

  afterEach(() => {
    cleanup();
  });

  it("updates kerning in non-line mode without remount", async () => {
    const onResplit = vi.fn();
    const onSplit = vi.fn();
    const { container } = render(
      <SplitText
        options={{ type: "chars,words" }}
        onSplit={onSplit}
        onResplit={onResplit}
      >
        <p style={{ fontSize: "20px" }}>Hello World</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".split-char").length).toBeGreaterThan(0);
      expect(onSplit).toHaveBeenCalledTimes(1);
    });

    const firstCharBefore = container.querySelector(".split-char");
    const childElement = container.querySelector("p") as HTMLElement | null;
    expect(firstCharBefore).toBeTruthy();
    expect(childElement).toBeTruthy();

    await triggerTypographyResize(childElement!, "32px");

    const firstCharAfter = container.querySelector(".split-char");
    expect(firstCharAfter).toBe(firstCharBefore);
    expect(onResplit).not.toHaveBeenCalled();
    expect(onSplit).toHaveBeenCalledTimes(1);
  });

  it("does not full-resplit in line mode on style change when autoSplit is false", async () => {
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

    await triggerTypographyResize(childElement!, "32px");

    const firstLineAfter = container.querySelector(".split-line");
    expect(firstLineAfter).toBe(firstLineBefore);
    expect(onResplit).not.toHaveBeenCalled();
  });

  it("full-resplits in line mode on style change when autoSplit is true", async () => {
    const onResplit = vi.fn();
    const { container } = render(
      <SplitText
        autoSplit
        options={{ type: "chars,words,lines" }}
        onResplit={onResplit}
      >
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

    await triggerTypographyResize(childElement!, "32px");

    await waitFor(() => {
      expect(onResplit).toHaveBeenCalledTimes(1);
    });

    const firstLineAfter = container.querySelector(".split-line");
    const callbackLine = onResplit.mock.calls[0]?.[0]?.lines?.[0] as
      | HTMLElement
      | undefined;
    expect(firstLineAfter).not.toBe(firstLineBefore);
    expect(callbackLine).toBeTruthy();
    expect(callbackLine).not.toBe(firstLineBefore);
  });

  it("fires onResplit on full replacement even when line grouping is unchanged", async () => {
    const onResplit = vi.fn();
    const { container } = render(
      <SplitText
        autoSplit
        options={{ type: "chars,words,lines" }}
        onResplit={onResplit}
      >
        <p style={{ fontSize: "20px" }}>Hi</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".split-line").length).toBe(1);
    });

    const firstLineBefore = container.querySelector(".split-line");
    const childElement = container.querySelector("p") as HTMLElement | null;
    expect(firstLineBefore).toBeTruthy();
    expect(childElement).toBeTruthy();

    await triggerTypographyResize(childElement!, "21px");

    await waitFor(() => {
      expect(onResplit).toHaveBeenCalledTimes(1);
    });

    const callbackLine = onResplit.mock.calls[0]?.[0]?.lines?.[0] as
      | HTMLElement
      | undefined;
    expect(callbackLine).toBeTruthy();
    expect(callbackLine).not.toBe(firstLineBefore);
  });

  it("does not full-resplit on width-only changes when lines stay unchanged", async () => {
    const onResplit = vi.fn();
    const { container } = render(
      <SplitText
        autoSplit
        options={{ type: "chars,words,lines" }}
        onResplit={onResplit}
      >
        <p style={{ fontSize: "20px" }}>Hi</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".split-line").length).toBe(1);
    });

    const childElement = container.querySelector("p") as HTMLElement | null;
    const firstLineBefore = container.querySelector(".split-line");
    expect(childElement).toBeTruthy();
    expect(firstLineBefore).toBeTruthy();

    // First observer callback is skipped by design.
    await triggerAutoSplitWidthResize(childElement!, 320);
    await triggerAutoSplitWidthResize(childElement!, 420);

    const firstLineAfter = container.querySelector(".split-line");
    expect(firstLineAfter).toBe(firstLineBefore);
    expect(onResplit).not.toHaveBeenCalled();
  });

  it("full-resplits when the immediate parent width changes", async () => {
    const onResplit = vi.fn();
    const { container } = render(
      <SplitText autoSplit options={{ type: "chars,words" }} onResplit={onResplit}>
        <p style={{ fontSize: "20px" }}>Hello World</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".split-char").length).toBeGreaterThan(0);
    });

    const childElement = container.querySelector("p") as HTMLElement | null;
    expect(childElement).toBeTruthy();
    const targets = getAutoSplitTargets(childElement!);
    expect(targets.length).toBeGreaterThan(1);

    await triggerAutoSplitWidthResize(childElement!, 320, 0);
    await triggerAutoSplitWidthResize(childElement!, 420, 0);

    await waitFor(() => {
      expect(onResplit).toHaveBeenCalledTimes(1);
    });
  });

  it("full-resplits when the promoted ancestor width changes", async () => {
    const onResplit = vi.fn();
    const { container } = render(
      <SplitText autoSplit options={{ type: "chars,words" }} onResplit={onResplit}>
        <p style={{ fontSize: "20px" }}>Hello World</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".split-char").length).toBeGreaterThan(0);
    });

    const childElement = container.querySelector("p") as HTMLElement | null;
    expect(childElement).toBeTruthy();
    const targets = getAutoSplitTargets(childElement!);
    expect(targets.length).toBeGreaterThan(1);

    await triggerAutoSplitWidthResize(childElement!, 320, 1);
    await triggerAutoSplitWidthResize(childElement!, 420, 1);

    await waitFor(() => {
      expect(onResplit).toHaveBeenCalledTimes(1);
    });
  });

  it("full-resplits on subpixel width changes", async () => {
    const onResplit = vi.fn();
    const { container } = render(
      <SplitText autoSplit options={{ type: "chars,words" }} onResplit={onResplit}>
        <p style={{ fontSize: "20px" }}>Hello World</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".split-char").length).toBeGreaterThan(0);
    });

    const childElement = container.querySelector("p") as HTMLElement | null;
    expect(childElement).toBeTruthy();

    await triggerAutoSplitWidthResize(childElement!, 300.1, 0);
    await triggerAutoSplitWidthResize(childElement!, 300.7, 0);

    await waitFor(() => {
      expect(onResplit).toHaveBeenCalledTimes(1);
    });
  });

  it("uses rendered child width for line-mode resize probes when target width differs", async () => {
    const { container } = render(
      <SplitText autoSplit options={{ type: "chars,words,lines" }}>
        <p style={{ fontSize: "20px" }}>
          This text reflows naturally at any width.
        </p>
      </SplitText>
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".split-line").length).toBeGreaterThan(0);
    });

    const childElement = container.querySelector("p") as HTMLElement | null;
    expect(childElement).toBeTruthy();
    const measuredHost = childElement?.parentElement;
    expect(measuredHost).toBeTruthy();

    const originalAppendChild = measuredHost!.appendChild.bind(measuredHost);
    const probeWidths: string[] = [];
    const appendSpy = vi
      .spyOn(measuredHost!, "appendChild")
      .mockImplementation((node: Node) => {
        if (
          node instanceof HTMLElement &&
          node.dataset.fettaAutoSplitProbe === "true"
        ) {
          probeWidths.push(node.style.width);
        }
        return originalAppendChild(node);
      });

    const childRectSpy = vi
      .spyOn(childElement!, "getBoundingClientRect")
      .mockReturnValue(createRect(388));

    // First callback is skipped by design.
    await triggerAutoSplitWidthResize(childElement!, 320);
    await triggerAutoSplitWidthResize(childElement!, 420);

    expect(probeWidths.length).toBeGreaterThan(0);
    expect(probeWidths[probeWidths.length - 1]).toBe("388px");

    childRectSpy.mockRestore();
    appendSpy.mockRestore();
  });

  it("keeps onSplit initial-only across full resplits", async () => {
    const onSplit = vi.fn();
    const { container } = render(
      <SplitText autoSplit options={{ type: "chars,words,lines" }} onSplit={onSplit}>
        <p style={{ fontSize: "20px" }}>Hello World</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(onSplit).toHaveBeenCalledTimes(1);
    });

    const childElement = container.querySelector("p") as HTMLElement | null;
    expect(childElement).toBeTruthy();

    await triggerTypographyResize(childElement!, "32px");

    await act(async () => {
      await Promise.resolve();
    });

    expect(onSplit).toHaveBeenCalledTimes(1);
  });

  it("rebinds whileScroll after line-mode full resplit", async () => {
    const motion = await import("motion");
    const animateMock = motion.animate as unknown as ReturnType<typeof vi.fn>;
    const scrollMock = motion.scroll as unknown as ReturnType<typeof vi.fn>;
    animateMock.mockClear();
    scrollMock.mockClear();

    const { container } = render(
      <SplitText
        autoSplit
        variants={{ progress: { opacity: 1 } }}
        whileScroll="progress"
        options={{ type: "chars,lines" }}
      >
        <p style={{ fontSize: "20px" }}>Hello World</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(animateMock).toHaveBeenCalled();
      expect(scrollMock).toHaveBeenCalled();
    });
    const animateCallsBefore = animateMock.mock.calls.length;
    const scrollCallsBefore = scrollMock.mock.calls.length;

    const childElement = container.querySelector("p") as HTMLElement | null;
    expect(childElement).toBeTruthy();

    await triggerTypographyResize(childElement!, "32px");

    await waitFor(() => {
      expect(animateMock.mock.calls.length).toBeGreaterThan(animateCallsBefore);
      expect(scrollMock.mock.calls.length).toBeGreaterThan(scrollCallsBefore);
    });
  });

  it("keeps callback-mode scroll runtime active across line full-resplits", async () => {
    const motion = await import("motion");
    const animateMock = motion.animate as unknown as ReturnType<typeof vi.fn>;
    const scrollMock = motion.scroll as unknown as ReturnType<typeof vi.fn>;
    animateMock.mockClear();
    scrollMock.mockClear();

    const setupScrollRuntime = vi.fn(({ chars }: { chars: HTMLSpanElement[] }) => {
      const animation = motion.animate(
        chars.map((char, i) => [
          char,
          { opacity: 1 },
          { duration: 0.3, at: i * 0.025, ease: "linear" },
        ])
      );
      if (
        animation &&
        typeof animation === "object" &&
        "pause" in animation &&
        typeof (animation as { pause?: unknown }).pause === "function"
      ) {
        (animation as { pause: () => void }).pause();
      }
      motion.scroll(animation, {
        offset: ["start 90%", "start 10%"],
      });
    });

    const { container } = render(
      <SplitText
        autoSplit
        options={{ type: "chars,lines" }}
        initialStyles={{ chars: { opacity: 0.2 } }}
        onSplit={setupScrollRuntime}
        onResplit={setupScrollRuntime}
      >
        <p style={{ fontSize: "20px" }}>
          Smoothly fade in each character as you scroll through this container
        </p>
      </SplitText>
    );

    await waitFor(() => {
      expect(setupScrollRuntime).toHaveBeenCalledTimes(1);
      expect(animateMock).toHaveBeenCalled();
      expect(scrollMock).toHaveBeenCalled();
    });

    const setupCallsBefore = setupScrollRuntime.mock.calls.length;
    const animateCallsBefore = animateMock.mock.calls.length;
    const scrollCallsBefore = scrollMock.mock.calls.length;
    const childElement = container.querySelector("p") as HTMLElement | null;
    expect(childElement).toBeTruthy();

    await triggerTypographyResize(childElement!, "32px");

    await waitFor(() => {
      expect(setupScrollRuntime.mock.calls.length).toBeGreaterThan(
        setupCallsBefore
      );
      expect(animateMock.mock.calls.length).toBeGreaterThan(animateCallsBefore);
      expect(scrollMock.mock.calls.length).toBeGreaterThan(scrollCallsBefore);
    });
  });
});
