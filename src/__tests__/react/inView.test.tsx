import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, cleanup, act } from "@testing-library/react";
import { SplitText } from "../../react/SplitText";
import {
  getLastIntersectionObserver,
  resetIntersectionObserver,
} from "../setup";
import React from "react";

describe("SplitText viewport", () => {
  beforeEach(() => {
    resetIntersectionObserver();
  });

  afterEach(() => {
    cleanup();
  });

  it("sets up IntersectionObserver when viewport is provided", async () => {
    render(
      <SplitText viewport={{}}>
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
      <SplitText viewport={{ amount: 0.5, margin: "100px" }}>
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

  it("calls onViewportEnter when element enters viewport", async () => {
    const onViewportEnter = vi.fn();

    render(
      <SplitText viewport={{}} onViewportEnter={onViewportEnter}>
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
      expect(onViewportEnter).toHaveBeenCalledWith(
        expect.objectContaining({
          chars: expect.any(Array),
          words: expect.any(Array),
          lines: expect.any(Array),
          revert: expect.any(Function),
        })
      );
    });
  });

  it("calls onViewportLeave when element exits viewport", async () => {
    const onViewportLeave = vi.fn();

    render(
      <SplitText viewport={{}} onViewportLeave={onViewportLeave}>
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
      expect(onViewportLeave).toHaveBeenCalled();
    });
  });

  it("calls onViewportLeave when ratio drops below leave threshold", async () => {
    const onViewportLeave = vi.fn();

    render(
      <SplitText
        viewport={{ amount: 0.6, leave: 0.4 }}
        onViewportLeave={onViewportLeave}
      >
        <p>Hello World</p>
      </SplitText>
    );

    await waitFor(() => {
      const observer = getLastIntersectionObserver();
      expect(observer).not.toBeNull();
    });

    const observer = getLastIntersectionObserver();

    // Enter viewport (>= amount)
    act(() => {
      observer?.trigger([
        {
          isIntersecting: true,
          intersectionRatio: 0.7,
        },
      ]);
    });

    // Drop below leave threshold but still intersecting
    act(() => {
      observer?.trigger([
        {
          isIntersecting: true,
          intersectionRatio: 0.3,
        },
      ]);
    });

    await waitFor(() => {
      expect(onViewportLeave).toHaveBeenCalled();
    });
  });

  it("only triggers onViewportEnter once when once option is true", async () => {
    const onViewportEnter = vi.fn();

    render(
      <SplitText viewport={{ once: true }} onViewportEnter={onViewportEnter}>
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
      expect(onViewportEnter).toHaveBeenCalledTimes(1);
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
    expect(onViewportEnter).toHaveBeenCalledTimes(1);
  });

  it("does not call onViewportLeave when once is true after trigger", async () => {
    const onViewportLeave = vi.fn();

    render(
      <SplitText viewport={{ once: true }} onViewportLeave={onViewportLeave}>
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

    // onViewportLeave should not be called when once is true
    expect(onViewportLeave).not.toHaveBeenCalled();
  });

  it("reverts after onViewportEnter animation completes with revertOnComplete", async () => {
    const onRevert = vi.fn();
    let resolveAnimation: () => void;
    const animationPromise = new Promise<void>((resolve) => {
      resolveAnimation = resolve;
    });

    const { container } = render(
      <SplitText
        viewport={{}}
        onViewportEnter={() => ({ finished: animationPromise })}
        revertOnComplete
        onRevert={onRevert}
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
    expect(onRevert).toHaveBeenCalledTimes(1);
  });

  it("disconnects IntersectionObserver on unmount", async () => {
    const { unmount } = render(
      <SplitText viewport={{}}>
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

  it("does not set up observer when no viewport props are provided", async () => {
    render(
      <SplitText>
        <p>Hello World</p>
      </SplitText>
    );

    // Wait for component to mount and potentially set up observer
    await new Promise((resolve) => setTimeout(resolve, 100));

    const observer = getLastIntersectionObserver();
    // Observer should not have any elements
    expect(observer?.elements.size ?? 0).toBe(0);
  });

  it("reapplies numeric initialStyles on viewport leave", async () => {
    const { container } = render(
      <SplitText
        viewport={{}}
        resetOnViewportLeave
        initialStyles={{ chars: { opacity: 0 } }}
        onViewportEnter={({ chars }) => {
          if (chars[0]) chars[0].style.opacity = "1";
        }}
      >
        <p>Hello</p>
      </SplitText>
    );

    await waitFor(() => {
      const observer = getLastIntersectionObserver();
      expect(observer).not.toBeNull();
    });

    const observer = getLastIntersectionObserver();

    // Enter viewport to mutate styles
    act(() => {
      observer?.trigger([
        {
          isIntersecting: true,
          intersectionRatio: 1,
        },
      ]);
    });

    const char = container.querySelector(".split-char") as HTMLElement | null;

    await waitFor(() => {
      expect(char).not.toBeNull();
      expect(char?.style.opacity).toBe("1");
    });

    // Leave viewport to reapply initial styles
    act(() => {
      observer?.trigger([
        {
          isIntersecting: false,
          intersectionRatio: 0,
        },
      ]);
    });

    await waitFor(() => {
      expect(char?.style.opacity).toBe("0");
    });
  });
});
