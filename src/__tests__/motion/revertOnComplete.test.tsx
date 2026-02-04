import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import React from "react";

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
  };
});

import { SplitText } from "../../motion/SplitText";

function getMotionByClass(className: string) {
  return motionElements.filter((entry) => {
    const value = entry.props.className;
    return typeof value === "string" && value.includes(className);
  });
}

describe("SplitText revertOnComplete (motion)", () => {
  beforeEach(() => {
    motionElements.length = 0;
  });

  afterEach(() => {
    cleanup();
  });

  it("reverts after all split elements complete", async () => {
    const { container } = render(
      <SplitText
        variants={{ show: { opacity: 1 } }}
        animate="show"
        revertOnComplete
        options={{ type: "words" }}
      >
        <p>Hello world</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(getMotionByClass("split-word").length).toBeGreaterThan(0);
    });

    const words = getMotionByClass("split-word");
    const first = words[0]?.props.onAnimationComplete as
      | ((definition?: string | object) => void)
      | undefined;

    act(() => {
      first?.("show");
    });

    await waitFor(() => {
      expect(container.querySelectorAll(".split-word").length).toBeGreaterThan(0);
    });

    act(() => {
      for (const entry of words) {
        const handler = entry.props.onAnimationComplete as
          | ((definition?: string | object) => void)
          | undefined;
        handler?.("show");
      }
    });

    await waitFor(() => {
      expect(container.querySelectorAll(".split-word").length).toBe(0);
    });
  });
});
