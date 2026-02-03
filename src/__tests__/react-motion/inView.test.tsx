import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, cleanup, act } from "@testing-library/react";
import React from "react";
import {
  getLastIntersectionObserver,
  resetIntersectionObserver,
} from "../setup";

type HoverHandler = () => void | (() => void);
let hoverHandler: HoverHandler | null = null;

vi.mock("motion", () => ({
  animate: vi.fn(() => ({ finished: Promise.resolve(), stop: vi.fn() })),
  hover: vi.fn((_el: Element, handler: HoverHandler) => {
    hoverHandler = handler;
    return vi.fn();
  }),
  scroll: vi.fn(() => vi.fn()),
}));

vi.mock("motion/react", () => ({
  usePresence: () => [true, vi.fn()],
}));

import { SplitText } from "../../react-motion/SplitText";

describe("SplitText viewport (react-motion)", () => {
  beforeEach(() => {
    resetIntersectionObserver();
    hoverHandler = null;
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

  it("reuses index maps for function variants across hover triggers", async () => {
    const { animate } = await import("motion");
    const animateMock = animate as unknown as ReturnType<typeof vi.fn>;
    const containsSpy = vi.spyOn(Element.prototype, "contains");

    render(
      <SplitText
        variants={{
          hover: (info) => ({ opacity: info.index }),
        }}
        whileHover="hover"
        options={{ type: "chars,words,lines" }}
      >
        <p>Hello World</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(hoverHandler).not.toBeNull();
    });

    act(() => {
      hoverHandler?.();
    });

    await waitFor(() => {
      expect(animateMock).toHaveBeenCalled();
    });

    const countAfterFirst = containsSpy.mock.calls.length;

    act(() => {
      hoverHandler?.();
    });

    await waitFor(() => {
      expect(animateMock.mock.calls.length).toBeGreaterThan(1);
    });

    const countAfterSecond = containsSpy.mock.calls.length;

    expect(countAfterSecond).toBe(countAfterFirst);
    containsSpy.mockRestore();
  });

  it("animates whileOutOfView when ratio falls below leave threshold", async () => {
    const { animate } = await import("motion");
    const animateMock = animate as unknown as ReturnType<typeof vi.fn>;

    render(
      <SplitText
        variants={{
          in: { opacity: 1 },
          out: { opacity: 0 },
        }}
        initial={false}
        whileInView="in"
        whileOutOfView="out"
        viewport={{ amount: 0.6, leave: 0.4 }}
      >
        <p>Hello World</p>
      </SplitText>
    );

    await waitFor(() => {
      const observer = getLastIntersectionObserver();
      expect(observer).not.toBeNull();
    });

    const observer = getLastIntersectionObserver();

    // Enter view (>= amount)
    act(() => {
      observer?.trigger([
        {
          isIntersecting: true,
          intersectionRatio: 0.7,
        },
      ]);
    });

    await waitFor(() => {
      expect(animateMock).toHaveBeenCalled();
    });

    const callsAfterEnter = animateMock.mock.calls.length;

    // Leave view (< leave threshold) while still intersecting
    act(() => {
      observer?.trigger([
        {
          isIntersecting: true,
          intersectionRatio: 0.3,
        },
      ]);
    });

    await waitFor(() => {
      expect(animateMock.mock.calls.length).toBeGreaterThan(callsAfterEnter);
    });
  });

  it("reverts hover back to whileInView when in view", async () => {
    const { animate } = await import("motion");
    const animateMock = animate as unknown as ReturnType<typeof vi.fn>;

    const variants = {
      idle: { opacity: 0.2 },
      inView: { opacity: 0.8 },
      hover: { opacity: 1 },
    };

    render(
      <SplitText
        variants={variants}
        initial="idle"
        whileInView="inView"
        whileHover="hover"
        viewport={{ amount: 0 }}
      >
        <p>Hello World</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(hoverHandler).not.toBeNull();
      expect(getLastIntersectionObserver()).not.toBeNull();
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
      expect(animateMock).toHaveBeenCalled();
    });

    const callsAfterInView = animateMock.mock.calls.length;

    let hoverEnd: void | (() => void);
    act(() => {
      hoverEnd = hoverHandler?.();
    });

    await waitFor(() => {
      expect(animateMock.mock.calls.length).toBeGreaterThan(callsAfterInView);
    });

    const callsAfterHoverStart = animateMock.mock.calls.length;

    act(() => {
      if (typeof hoverEnd === "function") hoverEnd();
    });

    await waitFor(() => {
      expect(animateMock.mock.calls.length).toBeGreaterThan(
        callsAfterHoverStart
      );
    });

    const lastCall = animateMock.mock.calls[animateMock.mock.calls.length - 1];
    expect(lastCall[1]).toMatchObject(variants.inView);
  });
});
