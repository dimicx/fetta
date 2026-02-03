import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, cleanup, act } from "@testing-library/react";
import React from "react";
import {
  getLastIntersectionObserver,
  resetIntersectionObserver,
} from "../setup";

vi.mock("motion", () => ({
  animate: vi.fn(() => ({ finished: Promise.resolve(), stop: vi.fn() })),
  hover: vi.fn(() => vi.fn()),
  scroll: vi.fn(() => vi.fn()),
}));

vi.mock("motion/react", () => ({
  usePresence: () => [true, vi.fn()],
}));

import { SplitText } from "../../react-motion/SplitText";

describe("SplitText viewport (react-motion)", () => {
  beforeEach(() => {
    resetIntersectionObserver();
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
});
