import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, cleanup, act } from "@testing-library/react";
import React from "react";
import {
  getLastIntersectionObserver,
  resetIntersectionObserver,
  setDocumentFontsReady,
} from "../setup";

const motionElements: Array<{ tag: string; props: Record<string, unknown> }> = [];

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
          motionElements.push({ tag, props });
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

function getMotionByClass(className: string) {
  return motionElements.filter((entry) => {
    const value = entry.props.className;
    return typeof value === "string" && value.includes(className);
  });
}

function getLatestSplitCharEntry(index: number) {
  const entries = getMotionByClass("split-char").filter(
    (entry) => entry.props["data-char-index"] === String(index)
  );
  return entries[entries.length - 1];
}

describe("SplitText viewport (motion)", () => {
  beforeEach(() => {
    resetIntersectionObserver();
    motionElements.length = 0;
  });

  afterEach(() => {
    cleanup();
  });

  it("sets up observer for viewport callbacks in variant mode without whileInView", async () => {
    const onViewportEnter = vi.fn();

    render(
      <SplitText variants={{}} onViewportEnter={onViewportEnter}>
        <p>Hello World</p>
      </SplitText>
    );

    await waitFor(() => {
      const observer = getLastIntersectionObserver();
      expect(observer).not.toBeNull();
      expect(observer?.elements.size).toBe(1);
    });

    const observer = getLastIntersectionObserver();

    act(() => {
      observer?.trigger([
        {
          isIntersecting: true,
          intersectionRatio: 1,
        },
      ]);
    });

    await waitFor(() => {
      expect(onViewportEnter).toHaveBeenCalled();
    });
  });

  it("sets up observer for resetOnViewportLeave in variant mode without whileInView", async () => {
    render(
      <SplitText variants={{}} resetOnViewportLeave>
        <p>Hello World</p>
      </SplitText>
    );

    await waitFor(() => {
      const observer = getLastIntersectionObserver();
      expect(observer).not.toBeNull();
      expect(observer?.elements.size).toBe(1);
    });
  });

  it("passes VariantInfo to custom for char variants", async () => {
    render(
      <SplitText
        variants={{
          reveal: ({ index, wordIndex }) => ({
            opacity: index + wordIndex,
          }),
        }}
        initial="reveal"
        options={{ type: "chars,words" }}
      >
        <p>Hi all</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(getMotionByClass("split-char").length).toBeGreaterThan(0);
    });

    const charEntries = getMotionByClass("split-char");
    const customByIndex = new Map<number, unknown>();

    for (const entry of charEntries) {
      const dataIndex = entry.props["data-char-index"];
      const index = typeof dataIndex === "string" ? Number(dataIndex) : null;
      if (index == null || Number.isNaN(index)) continue;
      customByIndex.set(index, entry.props.custom);
    }

    const first = customByIndex.get(0) as
      | { index: number; wordIndex: number }
      | undefined;
    const second = customByIndex.get(1) as
      | { index: number; wordIndex: number }
      | undefined;
    const third = customByIndex.get(2) as
      | { index: number; wordIndex: number }
      | undefined;

    expect(first?.index).toBe(0);
    expect(first?.wordIndex).toBe(0);
    expect(second?.index).toBe(1);
    expect(second?.wordIndex).toBe(0);
    expect(third?.index).toBe(0);
    expect(third?.wordIndex).toBe(1);
  });

  it("wires whileScroll to motion scroll", async () => {
    const { animate, scroll } = await import("motion");
    const animateMock = animate as unknown as ReturnType<typeof vi.fn>;
    const scrollMock = scroll as unknown as ReturnType<typeof vi.fn>;

    render(
      <SplitText
        variants={{
          progress: { opacity: 1 },
        }}
        whileScroll="progress"
        options={{ type: "words" }}
      >
        <p>Hello World</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(animateMock).toHaveBeenCalled();
    });

    expect(scrollMock).toHaveBeenCalled();
  });

  it("supports inline whileScroll object variants without variants map", async () => {
    const { animate, scroll } = await import("motion");
    const animateMock = animate as unknown as ReturnType<typeof vi.fn>;
    const scrollMock = scroll as unknown as ReturnType<typeof vi.fn>;
    animateMock.mockClear();
    scrollMock.mockClear();

    render(
      <SplitText
        whileScroll={{
          chars: { opacity: 1 },
        }}
        options={{ type: "chars" }}
      >
        <p>Hello</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(animateMock).toHaveBeenCalled();
    });

    expect(scrollMock).toHaveBeenCalled();
  });

  it("supports inline whileInView object variants without variants map", async () => {
    render(
      <SplitText
        whileInView={{
          chars: { opacity: 1 },
        }}
        options={{ type: "chars" }}
      >
        <p>Hello</p>
      </SplitText>
    );

    await waitFor(() => {
      const observer = getLastIntersectionObserver();
      expect(observer).not.toBeNull();
    });

    const observer = getLastIntersectionObserver();

    act(() => {
      observer?.trigger([
        {
          isIntersecting: true,
          intersectionRatio: 1,
        },
      ]);
    });

    await waitFor(() => {
      expect(getLatestSplitCharEntry(0)?.props.animate).toBe(
        "__fetta_whileInView__"
      );
    });
  });

  it("applies inline whileOutOfView variant after first viewport entry and leave", async () => {
    render(
      <SplitText
        animate={{
          chars: { opacity: 0.5 },
        }}
        whileOutOfView={{
          chars: { opacity: 0.1 },
        }}
        options={{ type: "chars" }}
      >
        <p>Hello</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(getLatestSplitCharEntry(0)?.props.animate).toBe("__fetta_animate__");
    });

    const observer = getLastIntersectionObserver();

    act(() => {
      observer?.trigger([
        {
          isIntersecting: true,
          intersectionRatio: 1,
        },
      ]);
    });

    act(() => {
      observer?.trigger([
        {
          isIntersecting: false,
          intersectionRatio: 0,
        },
      ]);
    });

    await waitFor(() => {
      expect(getLatestSplitCharEntry(0)?.props.animate).toBe(
        "__fetta_whileOutOfView__"
      );
    });
  });

  it("compiles whileScroll delays into timeline at offsets", async () => {
    const { animate } = await import("motion");
    const animateMock = animate as unknown as ReturnType<typeof vi.fn>;
    animateMock.mockClear();

    render(
      <SplitText
        variants={{
          progress: { opacity: 1 },
        }}
        whileScroll="progress"
        options={{ type: "chars" }}
        transition={{
          duration: 0.3,
          delay: (index: number) => index * 0.05,
        }}
      >
        <p>ABCD</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(animateMock).toHaveBeenCalled();
    });

    const latestCall = animateMock.mock.calls[animateMock.mock.calls.length - 1];
    const sequence = latestCall?.[0] as
      | Array<[unknown, unknown, Record<string, unknown>]>
      | undefined;

    expect(Array.isArray(sequence)).toBe(true);
    expect((sequence || []).length).toBeGreaterThan(1);

    const ats = (sequence || []).map(([, , options]) => options?.at);
    expect(ats.every((value) => typeof value === "number")).toBe(true);
    expect(ats[0]).toBe(0);
    expect(Math.max(...(ats as number[]))).toBeGreaterThan(0);
    expect(
      (sequence || []).every(([, , options]) => !("delay" in options))
    ).toBe(true);
  });

  it("preserves explicit at offsets in inline whileScroll function variants", async () => {
    const { animate } = await import("motion");
    const animateMock = animate as unknown as ReturnType<typeof vi.fn>;
    animateMock.mockClear();

    render(
      <SplitText
        initialStyles={{
          chars: { opacity: 0.2 },
        }}
        whileScroll={{
          chars: ({ globalIndex }) => ({
            opacity: [0.2, 1],
            transition: {
              duration: 0.3,
              at: globalIndex * 0.025,
            },
          }),
        }}
        options={{ type: "chars" }}
      >
        <p>ABCD</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(animateMock).toHaveBeenCalled();
    });

    const latestCall = animateMock.mock.calls[animateMock.mock.calls.length - 1];
    const sequence = latestCall?.[0] as
      | Array<[unknown, unknown, Record<string, unknown>]>
      | undefined;

    expect(Array.isArray(sequence)).toBe(true);
    expect((sequence || []).length).toBeGreaterThan(1);

    const ats = (sequence || []).map(([, , options]) => options?.at);
    expect(ats[0]).toBe(0);
    expect(Math.max(...(ats as number[]))).toBeGreaterThan(0);
  });

  it("does not call animate for whileScroll flat variants when no split targets exist", async () => {
    const { animate, scroll } = await import("motion");
    const animateMock = animate as unknown as ReturnType<typeof vi.fn>;
    const scrollMock = scroll as unknown as ReturnType<typeof vi.fn>;
    animateMock.mockClear();
    scrollMock.mockClear();

    render(
      <SplitText
        variants={{
          progress: { opacity: 1 },
        }}
        whileScroll="progress"
        options={{ type: "chars" }}
      >
        <p />
      </SplitText>
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(animateMock).not.toHaveBeenCalled();
    expect(scrollMock).not.toHaveBeenCalled();
  });

  it("waits for fonts by default before splitting", async () => {
    let resolveFonts: () => void = () => {};
    const fontsReady = new Promise<void>((resolve) => {
      resolveFonts = resolve;
    });
    setDocumentFontsReady(fontsReady);

    const { container } = render(
      <SplitText
        variants={{ show: { opacity: 1 } }}
        animate="show"
        options={{ type: "words" }}
      >
        <p>Hello World</p>
      </SplitText>
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(container.querySelectorAll(".split-word").length).toBe(0);

    await act(async () => {
      resolveFonts();
      await fontsReady;
    });

    await waitFor(() => {
      expect(container.querySelectorAll(".split-word").length).toBeGreaterThan(0);
    });
  });

  it("skips waiting for fonts when waitForFonts is false", async () => {
    const fontsReady = new Promise<void>(() => {
      // Keep pending so we can assert split happens without waiting.
    });
    setDocumentFontsReady(fontsReady);

    const { container } = render(
      <SplitText
        variants={{ show: { opacity: 1 } }}
        animate="show"
        waitForFonts={false}
        options={{ type: "words" }}
      >
        <p>Hello World</p>
      </SplitText>
    );
    const wrapper = container.firstChild as HTMLElement | null;
    expect(wrapper?.style.visibility).toBe("visible");

    await waitFor(() => {
      expect(container.querySelectorAll(".split-word").length).toBeGreaterThan(0);
    });
  });

  it("re-runs onSplit effect when variants are added after initial split", async () => {
    const onSplit = vi.fn();

    const { rerender } = render(
      <SplitText onSplit={onSplit}>
        <p>Hello World</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(onSplit.mock.calls.length).toBeGreaterThan(0);
    });
    const baselineCalls = onSplit.mock.calls.length;

    rerender(
      <SplitText
        onSplit={onSplit}
        variants={{
          show: { opacity: 1 },
        }}
      >
        <p>Hello World</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(onSplit.mock.calls.length).toBeGreaterThan(baselineCalls);
    });
  });

  it("re-runs viewport leave effect with latest hasVariants value", async () => {
    const onViewportLeave = vi.fn();

    const { rerender } = render(
      <SplitText viewport={{ amount: 0.2 }} onViewportLeave={onViewportLeave}>
        <p>Hello World</p>
      </SplitText>
    );

    await waitFor(() => {
      const observer = getLastIntersectionObserver();
      expect(observer).not.toBeNull();
    });

    const observer = getLastIntersectionObserver();

    act(() => {
      observer?.trigger([
        {
          isIntersecting: true,
          intersectionRatio: 1,
        },
      ]);
    });

    act(() => {
      observer?.trigger([
        {
          isIntersecting: false,
          intersectionRatio: 0,
        },
      ]);
    });

    await waitFor(() => {
      expect(onViewportLeave).toHaveBeenCalledTimes(1);
    });
    const baselineCalls = onViewportLeave.mock.calls.length;

    rerender(
      <SplitText
        viewport={{ amount: 0.2 }}
        onViewportLeave={onViewportLeave}
        variants={{
          show: { opacity: 1 },
        }}
      >
        <p>Hello World</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(onViewportLeave.mock.calls.length).toBeGreaterThan(baselineCalls);
    });
  });
});
