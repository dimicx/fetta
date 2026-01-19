import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, cleanup, act } from "@testing-library/react";
import { SplitText } from "../../react/SplitText";
import {
  getLastIntersectionObserver,
  resetIntersectionObserver,
} from "../setup";
import React from "react";

describe("SplitText inView", () => {
  beforeEach(() => {
    resetIntersectionObserver();
  });

  afterEach(() => {
    cleanup();
  });

  it("sets up IntersectionObserver when inView is true", async () => {
    render(
      <SplitText inView>
        <p>Hello World</p>
      </SplitText>
    );

    await waitFor(() => {
      const observer = getLastIntersectionObserver();
      expect(observer).not.toBeNull();
    });
  });

  it("sets up IntersectionObserver with custom options", async () => {
    render(
      <SplitText inView={{ amount: 0.5, margin: "100px" }}>
        <p>Hello World</p>
      </SplitText>
    );

    await waitFor(() => {
      const observer = getLastIntersectionObserver();
      expect(observer).not.toBeNull();
      // Asymmetric thresholds: [0, amount] for enter at amount, leave at 0
      expect(observer?.options.threshold).toEqual([0, 0.5]);
      expect(observer?.options.rootMargin).toBe("100px");
    });
  });

  it("calls onInView when element enters viewport", async () => {
    const onInView = vi.fn();

    render(
      <SplitText inView onInView={onInView}>
        <p>Hello World</p>
      </SplitText>
    );

    await waitFor(() => {
      const observer = getLastIntersectionObserver();
      expect(observer).not.toBeNull();
    });

    const observer = getLastIntersectionObserver();

    // Simulate entering viewport
    act(() => {
      observer?.trigger([
        {
          isIntersecting: true,
          intersectionRatio: 1,
        },
      ]);
    });

    await waitFor(() => {
      expect(onInView).toHaveBeenCalledWith(
        expect.objectContaining({
          chars: expect.any(Array),
          words: expect.any(Array),
          lines: expect.any(Array),
          revert: expect.any(Function),
        })
      );
    });
  });

  it("calls onLeaveView when element exits viewport", async () => {
    const onLeaveView = vi.fn();

    render(
      <SplitText inView onLeaveView={onLeaveView}>
        <p>Hello World</p>
      </SplitText>
    );

    await waitFor(() => {
      const observer = getLastIntersectionObserver();
      expect(observer).not.toBeNull();
    });

    const observer = getLastIntersectionObserver();

    // First enter viewport
    act(() => {
      observer?.trigger([
        {
          isIntersecting: true,
          intersectionRatio: 1,
        },
      ]);
    });

    // Then leave viewport
    act(() => {
      observer?.trigger([
        {
          isIntersecting: false,
          intersectionRatio: 0,
        },
      ]);
    });

    await waitFor(() => {
      expect(onLeaveView).toHaveBeenCalled();
    });
  });

  it("only triggers onInView once when once option is true", async () => {
    const onInView = vi.fn();

    render(
      <SplitText inView={{ once: true }} onInView={onInView}>
        <p>Hello World</p>
      </SplitText>
    );

    await waitFor(() => {
      const observer = getLastIntersectionObserver();
      expect(observer).not.toBeNull();
    });

    const observer = getLastIntersectionObserver();

    // Enter viewport first time
    act(() => {
      observer?.trigger([
        {
          isIntersecting: true,
          intersectionRatio: 1,
        },
      ]);
    });

    await waitFor(() => {
      expect(onInView).toHaveBeenCalledTimes(1);
    });

    // Leave viewport
    act(() => {
      observer?.trigger([
        {
          isIntersecting: false,
          intersectionRatio: 0,
        },
      ]);
    });

    // Enter viewport second time
    act(() => {
      observer?.trigger([
        {
          isIntersecting: true,
          intersectionRatio: 1,
        },
      ]);
    });

    // Should still only be called once
    expect(onInView).toHaveBeenCalledTimes(1);
  });

  it("does not call onLeaveView when once is true after trigger", async () => {
    const onLeaveView = vi.fn();

    render(
      <SplitText inView={{ once: true }} onLeaveView={onLeaveView}>
        <p>Hello World</p>
      </SplitText>
    );

    await waitFor(() => {
      const observer = getLastIntersectionObserver();
      expect(observer).not.toBeNull();
    });

    const observer = getLastIntersectionObserver();

    // Enter viewport
    act(() => {
      observer?.trigger([
        {
          isIntersecting: true,
          intersectionRatio: 1,
        },
      ]);
    });

    // Leave viewport
    act(() => {
      observer?.trigger([
        {
          isIntersecting: false,
          intersectionRatio: 0,
        },
      ]);
    });

    // onLeaveView should not be called when once is true
    expect(onLeaveView).not.toHaveBeenCalled();
  });

  it("reverts after onInView animation completes with revertOnComplete", async () => {
    let resolveAnimation: () => void;
    const animationPromise = new Promise<void>((resolve) => {
      resolveAnimation = resolve;
    });

    const { container } = render(
      <SplitText
        inView
        onInView={() => ({ finished: animationPromise })}
        revertOnComplete
      >
        <p>Hello</p>
      </SplitText>
    );

    await waitFor(() => {
      const observer = getLastIntersectionObserver();
      expect(observer).not.toBeNull();
    });

    const observer = getLastIntersectionObserver();

    // Trigger entering viewport
    act(() => {
      observer?.trigger([
        {
          isIntersecting: true,
          intersectionRatio: 1,
        },
      ]);
    });

    // Verify split is in effect
    await waitFor(() => {
      const chars = container.querySelectorAll(".split-char");
      expect(chars.length).toBeGreaterThan(0);
    });

    // Resolve the animation
    resolveAnimation!();

    // Wait for revert
    await waitFor(() => {
      const p = container.querySelector("p");
      expect(p?.textContent).toBe("Hello");
    });
  });

  it("disconnects IntersectionObserver on unmount", async () => {
    const { unmount } = render(
      <SplitText inView>
        <p>Hello World</p>
      </SplitText>
    );

    await waitFor(() => {
      const observer = getLastIntersectionObserver();
      expect(observer).not.toBeNull();
    });

    const observer = getLastIntersectionObserver();
    expect(observer?.elements.size).toBe(1);

    unmount();

    expect(observer?.elements.size).toBe(0);
  });

  it("does not set up observer when inView is false", async () => {
    render(
      <SplitText inView={false}>
        <p>Hello World</p>
      </SplitText>
    );

    // Wait for component to mount and potentially set up observer
    await new Promise((resolve) => setTimeout(resolve, 100));

    const observer = getLastIntersectionObserver();
    // Observer should not have any elements
    expect(observer?.elements.size ?? 0).toBe(0);
  });
});
