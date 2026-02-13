import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import React from "react";
import { getResizeObservers } from "../setup";

type CapturedMotionElement = { tag: string; props: Record<string, unknown> };

interface MotionReactTestAPI {
  __setPresence: (value: boolean) => void;
  __setReducedMotion: (value: boolean) => void;
  __resetMotionState: () => void;
  __getMotionElements: () => CapturedMotionElement[];
  __getSafeToRemove: () => ReturnType<typeof vi.fn>;
  __getMotionConfigMock: () => ReturnType<typeof vi.fn>;
}

vi.mock("motion", () => ({
  animate: vi.fn(() => ({ finished: Promise.resolve(), stop: vi.fn() })),
  scroll: vi.fn(() => vi.fn()),
}));

vi.mock("motion/react", async () => {
  const React = await import("react");

  const state = {
    motionElements: [] as CapturedMotionElement[],
    isPresent: true,
    reducedMotion: false,
    safeToRemove: vi.fn(),
  };

  const MotionConfig = vi.fn(
    (props: { reducedMotion?: string; children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, props.children)
  );

  const motion = new Proxy(
    {},
    {
      get: (_target, tag: string) =>
        React.forwardRef<HTMLElement, Record<string, unknown>>((props, ref) => {
          state.motionElements.push({ tag, props });
          const {
            variants: _variants,
            custom: _custom,
            initial: _initial,
            animate: _animate,
            exit: _exit,
            transition: _transition,
            whileHover: _whileHover,
            whileTap: _whileTap,
            whileFocus: _whileFocus,
            layout: _layout,
            drag: _drag,
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
          return React.createElement(
            tag,
            { ...rest, ref },
            props.children as React.ReactNode
          );
        }),
    }
  );

  return {
    motion,
    MotionConfig,
    usePresence: () => [state.isPresent, state.safeToRemove],
    useReducedMotion: () => state.reducedMotion,
    __setPresence: (value: boolean) => {
      state.isPresent = value;
    },
    __setReducedMotion: (value: boolean) => {
      state.reducedMotion = value;
    },
    __resetMotionState: () => {
      state.motionElements.length = 0;
      state.safeToRemove.mockClear();
      MotionConfig.mockClear();
      state.isPresent = true;
      state.reducedMotion = false;
    },
    __getMotionElements: () => state.motionElements,
    __getSafeToRemove: () => state.safeToRemove,
    __getMotionConfigMock: () => MotionConfig,
  };
});

import { SplitText } from "../../motion/SplitText";

async function getMotionReactTestAPI(): Promise<MotionReactTestAPI> {
  return (await import("motion/react")) as unknown as MotionReactTestAPI;
}

function getLatestWrapperEntry(entries: CapturedMotionElement[]) {
  const wrappers = entries.filter((entry) => entry.props.className === "wrapper");
  return wrappers[wrappers.length - 1];
}

function getLatestSplitEntry(entries: CapturedMotionElement[], splitClass: string) {
  const splitEntries = entries.filter(
    (entry) =>
      typeof entry.props.className === "string" &&
      entry.props.className.includes(splitClass)
  );
  return splitEntries[splitEntries.length - 1];
}

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

describe("SplitText motion parity", () => {
  beforeEach(async () => {
    const motionReact = await getMotionReactTestAPI();
    motionReact.__resetMotionState();
    const motion = await import("motion");
    (motion.animate as unknown as ReturnType<typeof vi.fn>).mockClear();
    (motion.scroll as unknown as ReturnType<typeof vi.fn>).mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("updates wrapper transition when transition prop changes", async () => {
    const { rerender } = render(
      <SplitText
        className="wrapper"
        variants={{
          idle: { wrapper: { opacity: 0.8 } },
          active: { wrapper: { opacity: 1 } },
        }}
        initial="idle"
        animate="active"
        transition={{ staggerChildren: 0.2 }}
        options={{ type: "chars" }}
      >
        <p>Hello</p>
      </SplitText>
    );

    const motionReact = await getMotionReactTestAPI();

    await waitFor(() => {
      const wrapper = getLatestWrapperEntry(motionReact.__getMotionElements());
      expect((wrapper?.props.transition as { staggerChildren?: number })?.staggerChildren).toBe(
        0.2
      );
    });

    rerender(
      <SplitText
        className="wrapper"
        variants={{
          idle: { wrapper: { opacity: 0.8 } },
          active: { wrapper: { opacity: 1 } },
        }}
        initial="idle"
        animate="active"
        transition={{ staggerChildren: 0.5 }}
        options={{ type: "chars" }}
      >
        <p>Hello</p>
      </SplitText>
    );

    await waitFor(() => {
      const wrapper = getLatestWrapperEntry(motionReact.__getMotionElements());
      expect((wrapper?.props.transition as { staggerChildren?: number })?.staggerChildren).toBe(
        0.5
      );
    });
  });

  it("skips initial replay on resplit by default", async () => {
    const onResplit = vi.fn();
    const { container } = render(
      <SplitText
        className="wrapper"
        autoSplit
        options={{ type: "chars" }}
        variants={{
          hidden: { y: "100%" },
          visible: { y: "0%" },
        }}
        initial="hidden"
        animate="visible"
        onResplit={onResplit}
      >
        <p style={{ fontSize: "20px" }}>Responsive split text</p>
      </SplitText>
    );

    const motionReact = await getMotionReactTestAPI();

    await waitFor(() => {
      const splitLine = getLatestSplitEntry(
        motionReact.__getMotionElements(),
        "split-char"
      );
      expect(splitLine?.props.initial).toBe("hidden");
    });

    const childElement = container.querySelector("p") as HTMLElement | null;
    expect(childElement).toBeTruthy();
    const entriesBeforeResplit = motionReact.__getMotionElements().length;

    // First resize seeds observer state, second should trigger full resplit.
    await triggerAutoSplitWidthResize(childElement!, 320);
    await triggerAutoSplitWidthResize(childElement!, 420);

    await waitFor(() => {
      expect(onResplit).toHaveBeenCalledTimes(1);
    });

    const resplitEntries = motionReact
      .__getMotionElements()
      .slice(entriesBeforeResplit)
      .filter(
        (entry) =>
          typeof entry.props.className === "string" &&
          entry.props.className.includes("split-char")
      );
    expect(resplitEntries.length).toBeGreaterThan(0);
    expect(resplitEntries.some((entry) => entry.props.initial === false)).toBe(
      true
    );
  });

  it("replays initial->animate on resplit when animateOnResplit is true", async () => {
    const onResplit = vi.fn();
    const { container } = render(
      <SplitText
        className="wrapper"
        autoSplit
        animateOnResplit={true}
        options={{ type: "chars" }}
        variants={{
          hidden: { y: "100%" },
          visible: { y: "0%" },
        }}
        initial="hidden"
        animate="visible"
        onResplit={onResplit}
      >
        <p style={{ fontSize: "20px" }}>Responsive split text</p>
      </SplitText>
    );

    const motionReact = await getMotionReactTestAPI();

    await waitFor(() => {
      const splitLine = getLatestSplitEntry(
        motionReact.__getMotionElements(),
        "split-char"
      );
      expect(splitLine?.props.initial).toBe("hidden");
    });

    const childElement = container.querySelector("p") as HTMLElement | null;
    expect(childElement).toBeTruthy();
    const entriesBeforeResplit = motionReact.__getMotionElements().length;

    // First resize seeds observer state, second should trigger full resplit.
    await triggerAutoSplitWidthResize(childElement!, 320);
    await triggerAutoSplitWidthResize(childElement!, 420);

    await waitFor(() => {
      expect(onResplit).toHaveBeenCalledTimes(1);
    });

    const resplitEntries = motionReact
      .__getMotionElements()
      .slice(entriesBeforeResplit)
      .filter(
        (entry) =>
          typeof entry.props.className === "string" &&
          entry.props.className.includes("split-char")
      );
    expect(resplitEntries.length).toBeGreaterThan(0);
    expect(resplitEntries.some((entry) => entry.props.initial === "hidden")).toBe(
      true
    );
  });

  it("passes current split nodes to onResplit after full resplit", async () => {
    const onResplit = vi.fn();
    const { container } = render(
      <SplitText className="wrapper" autoSplit options={{ type: "chars" }} onResplit={onResplit}>
        <p style={{ fontSize: "20px" }}>Responsive split text</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".split-char").length).toBeGreaterThan(0);
    });

    const initialFirstChar = container.querySelector(".split-char");
    const childElement = container.querySelector("p") as HTMLElement | null;
    expect(childElement).toBeTruthy();

    await triggerAutoSplitWidthResize(childElement!, 320);
    await triggerAutoSplitWidthResize(childElement!, 420);

    await waitFor(() => {
      expect(onResplit).toHaveBeenCalledTimes(1);
    });

    const result = onResplit.mock.calls[0]?.[0] as
      | { chars: HTMLSpanElement[] }
      | undefined;
    expect(result?.chars.length ?? 0).toBeGreaterThan(0);

    const callbackChar = result!.chars[0];
    const liveChild = container.querySelector("p") as HTMLElement | null;
    expect(callbackChar.isConnected).toBe(true);
    expect(liveChild?.contains(callbackChar)).toBe(true);
    expect(callbackChar).not.toBe(initialFirstChar);
  });

  it("waits for wrapper-only exit completion before safeToRemove", async () => {
    const motionReact = await getMotionReactTestAPI();
    motionReact.__setPresence(false);

    render(
      <SplitText
        className="wrapper"
        variants={{
          visible: { wrapper: { opacity: 1 } },
          out: { wrapper: { opacity: 0 } },
        }}
        initial="visible"
        animate="visible"
        exit="out"
        options={{ type: "words" }}
      >
        <p>Goodbye now</p>
      </SplitText>
    );

    await act(async () => {
      await Promise.resolve();
    });

    const safeToRemove = motionReact.__getSafeToRemove();
    expect(safeToRemove).not.toHaveBeenCalled();

    const wrapper = getLatestWrapperEntry(motionReact.__getMotionElements());
    const onAnimationComplete = wrapper?.props.onAnimationComplete as
      | ((definition?: string) => void)
      | undefined;

    act(() => {
      onAnimationComplete?.("out");
    });

    await waitFor(() => {
      expect(safeToRemove).toHaveBeenCalledTimes(1);
    });
  });

  it("forwards wrapper motion and DOM props while preserving internal handlers", async () => {
    const onTapStart = vi.fn();

    render(
      <SplitText
        className="wrapper"
        id="headline"
        role="heading"
        tabIndex={2}
        data-testid="split-wrapper"
        layout
        drag="x"
        onTapStart={onTapStart}
      >
        <p>Hello world</p>
      </SplitText>
    );

    const motionReact = await getMotionReactTestAPI();

    await waitFor(() => {
      const wrapper = getLatestWrapperEntry(motionReact.__getMotionElements());
      expect(wrapper?.props.id).toBe("headline");
      expect(wrapper?.props.role).toBe("heading");
      expect(wrapper?.props.tabIndex).toBe(2);
      expect(wrapper?.props["data-testid"]).toBe("split-wrapper");
      expect(wrapper?.props.layout).toBe(true);
      expect(wrapper?.props.drag).toBe("x");
    });

    const wrapper = getLatestWrapperEntry(motionReact.__getMotionElements());
    const handler = wrapper?.props.onTapStart as ((...args: unknown[]) => void) | undefined;

    act(() => {
      handler?.("evt", "info");
    });

    expect(onTapStart).toHaveBeenCalledWith("evt", "info");
  });

  it("applies interaction trigger priority: tap > focus > hover > animate", async () => {
    render(
      <SplitText
        className="wrapper"
        variants={{
          idle: { opacity: 0.5 },
          hover: { opacity: 0.7 },
          focus: { opacity: 0.85 },
          tap: { opacity: 1 },
        }}
        initial="idle"
        animate="idle"
        whileHover="hover"
        whileFocus="focus"
        whileTap="tap"
        options={{ type: "chars" }}
      >
        <p>Hi</p>
      </SplitText>
    );

    const motionReact = await getMotionReactTestAPI();

    await waitFor(() => {
      const wrapper = getLatestWrapperEntry(motionReact.__getMotionElements());
      expect(wrapper?.props.animate).toBe("idle");
    });

    act(() => {
      const wrapper = getLatestWrapperEntry(motionReact.__getMotionElements());
      (wrapper?.props.onHoverStart as (() => void) | undefined)?.();
    });

    await waitFor(() => {
      const wrapper = getLatestWrapperEntry(motionReact.__getMotionElements());
      expect(wrapper?.props.animate).toBe("hover");
    });

    act(() => {
      const wrapper = getLatestWrapperEntry(motionReact.__getMotionElements());
      (wrapper?.props.onFocus as (() => void) | undefined)?.();
    });

    await waitFor(() => {
      const wrapper = getLatestWrapperEntry(motionReact.__getMotionElements());
      expect(wrapper?.props.animate).toBe("focus");
    });

    act(() => {
      const wrapper = getLatestWrapperEntry(motionReact.__getMotionElements());
      (wrapper?.props.onTapStart as (() => void) | undefined)?.();
    });

    await waitFor(() => {
      const wrapper = getLatestWrapperEntry(motionReact.__getMotionElements());
      expect(wrapper?.props.animate).toBe("tap");
    });

    act(() => {
      const wrapper = getLatestWrapperEntry(motionReact.__getMotionElements());
      (wrapper?.props.onTap as (() => void) | undefined)?.();
    });

    await waitFor(() => {
      const wrapper = getLatestWrapperEntry(motionReact.__getMotionElements());
      expect(wrapper?.props.animate).toBe("focus");
    });

    act(() => {
      const wrapper = getLatestWrapperEntry(motionReact.__getMotionElements());
      (wrapper?.props.onBlur as (() => void) | undefined)?.();
    });

    await waitFor(() => {
      const wrapper = getLatestWrapperEntry(motionReact.__getMotionElements());
      expect(wrapper?.props.animate).toBe("hover");
    });

    act(() => {
      const wrapper = getLatestWrapperEntry(motionReact.__getMotionElements());
      (wrapper?.props.onHoverEnd as (() => void) | undefined)?.();
    });

    await waitFor(() => {
      const wrapper = getLatestWrapperEntry(motionReact.__getMotionElements());
      expect(wrapper?.props.animate).toBe("idle");
    });
  });

  it("applies interaction trigger priority with inline while variants", async () => {
    render(
      <SplitText
        className="wrapper"
        variants={{
          idle: { opacity: 0.5 },
        }}
        initial="idle"
        animate="idle"
        whileHover={{ opacity: 0.7 }}
        whileFocus={{ opacity: 0.85 }}
        whileTap={{ opacity: 1 }}
        options={{ type: "chars" }}
      >
        <p>Hi</p>
      </SplitText>
    );

    const motionReact = await getMotionReactTestAPI();

    await waitFor(() => {
      const wrapper = getLatestWrapperEntry(motionReact.__getMotionElements());
      expect(wrapper?.props.animate).toBe("idle");
    });

    act(() => {
      const wrapper = getLatestWrapperEntry(motionReact.__getMotionElements());
      (wrapper?.props.onHoverStart as (() => void) | undefined)?.();
    });

    await waitFor(() => {
      const wrapper = getLatestWrapperEntry(motionReact.__getMotionElements());
      expect(wrapper?.props.animate).toBe("__fetta_whileHover__");
    });

    act(() => {
      const wrapper = getLatestWrapperEntry(motionReact.__getMotionElements());
      (wrapper?.props.onFocus as (() => void) | undefined)?.();
    });

    await waitFor(() => {
      const wrapper = getLatestWrapperEntry(motionReact.__getMotionElements());
      expect(wrapper?.props.animate).toBe("__fetta_whileFocus__");
    });

    act(() => {
      const wrapper = getLatestWrapperEntry(motionReact.__getMotionElements());
      (wrapper?.props.onTapStart as (() => void) | undefined)?.();
    });

    await waitFor(() => {
      const wrapper = getLatestWrapperEntry(motionReact.__getMotionElements());
      expect(wrapper?.props.animate).toBe("__fetta_whileTap__");
    });

    act(() => {
      const wrapper = getLatestWrapperEntry(motionReact.__getMotionElements());
      (wrapper?.props.onTap as (() => void) | undefined)?.();
    });

    await waitFor(() => {
      const wrapper = getLatestWrapperEntry(motionReact.__getMotionElements());
      expect(wrapper?.props.animate).toBe("__fetta_whileFocus__");
    });

    act(() => {
      const wrapper = getLatestWrapperEntry(motionReact.__getMotionElements());
      (wrapper?.props.onBlur as (() => void) | undefined)?.();
    });

    await waitFor(() => {
      const wrapper = getLatestWrapperEntry(motionReact.__getMotionElements());
      expect(wrapper?.props.animate).toBe("__fetta_whileHover__");
    });

    act(() => {
      const wrapper = getLatestWrapperEntry(motionReact.__getMotionElements());
      (wrapper?.props.onHoverEnd as (() => void) | undefined)?.();
    });

    await waitFor(() => {
      const wrapper = getLatestWrapperEntry(motionReact.__getMotionElements());
      expect(wrapper?.props.animate).toBe("idle");
    });
  });

  it("resolves delay functions globally by default", async () => {
    render(
      <SplitText
        variants={{
          show: ({ globalIndex }) => ({ opacity: 0.25 + globalIndex * 0.1 }),
        }}
        initial="show"
        animate="show"
        transition={{ delay: (index: number) => index * 0.1 }}
        options={{ type: "chars,words" }}
      >
        <p>Hi Yo</p>
      </SplitText>
    );

    const motionReact = await getMotionReactTestAPI();

    await waitFor(() => {
      const targetChar = motionReact
        .__getMotionElements()
        .find(
          (entry) =>
            entry.props["data-char-index"] === "2" &&
            typeof entry.props.className === "string" &&
            entry.props.className.includes("split-char")
        );
      expect(targetChar).toBeDefined();
      const resolver = (targetChar?.props.variants as { show?: unknown } | undefined)
        ?.show;
      expect(typeof resolver).toBe("function");
      const resolved = (resolver as (info: unknown) => { transition?: { delay?: number } })(
        targetChar?.props.custom
      );
      expect(resolved.transition?.delay).toBe(0.2);
    });
  });

  it("resolves delay functions locally when delayScope is local", async () => {
    render(
      <SplitText
        variants={{
          show: ({ index }) => ({ opacity: 0.25 + index * 0.1 }),
        }}
        initial="show"
        animate="show"
        transition={{ delay: (index: number) => index * 0.1 }}
        delayScope="local"
        options={{ type: "chars,words" }}
      >
        <p>Hi Yo</p>
      </SplitText>
    );

    const motionReact = await getMotionReactTestAPI();

    await waitFor(() => {
      const targetChar = motionReact
        .__getMotionElements()
        .find(
          (entry) =>
            entry.props["data-char-index"] === "2" &&
            typeof entry.props.className === "string" &&
            entry.props.className.includes("split-char")
        );
      expect(targetChar).toBeDefined();
      const resolver = (targetChar?.props.variants as { show?: unknown } | undefined)
        ?.show;
      expect(typeof resolver).toBe("function");
      const resolved = (resolver as (info: unknown) => { transition?: { delay?: number } })(
        targetChar?.props.custom
      );
      expect(resolved.transition?.delay).toBe(0);
    });
  });

  it("forces instant transitions for reducedMotion always and user", async () => {
    const motion = await import("motion");
    const animateMock = motion.animate as unknown as ReturnType<typeof vi.fn>;
    const motionReact = await getMotionReactTestAPI();

    render(
      <SplitText
        variants={{ progress: { opacity: 1 } }}
        whileScroll="progress"
        reducedMotion="always"
        transition={{ duration: 0.6, delay: 0.2 }}
        options={{ type: "chars" }}
      >
        <p>Hello</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(animateMock).toHaveBeenCalled();
    });

    const alwaysTransition = animateMock.mock.calls[0]?.[2] as
      | { duration?: number; delay?: number }
      | undefined;
    expect(alwaysTransition?.duration).toBe(0);
    expect(alwaysTransition?.delay).toBe(0);

    cleanup();
    motionReact.__resetMotionState();
    animateMock.mockClear();
    motionReact.__setReducedMotion(true);

    render(
      <SplitText
        variants={{ progress: { opacity: 1 } }}
        whileScroll="progress"
        reducedMotion="user"
        transition={{ duration: 0.6, delay: 0.2 }}
        options={{ type: "chars" }}
      >
        <p>Hello</p>
      </SplitText>
    );

    await waitFor(() => {
      expect(animateMock).toHaveBeenCalled();
    });

    const userTransition = animateMock.mock.calls[0]?.[2] as
      | { duration?: number; delay?: number }
      | undefined;
    expect(userTransition?.duration).toBe(0);
    expect(userTransition?.delay).toBe(0);
    expect(motionReact.__getMotionConfigMock()).toHaveBeenCalled();
  });

  it("handles nested inline elements without removeChild errors", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const { container, rerender, unmount } = render(
        <SplitText options={{ type: "chars" }}>
          <p className="text-[16px] font-[450] text-center my-0!">
            Click{" "}
            <a href="#" className="text-accent no-underline">
              <em>this link</em>
            </a>{" "}
            or see <em>emphasized</em> and{" "}
            <strong className="font-bold">bold</strong> text
          </p>
        </SplitText>
      );

      await waitFor(() => {
        expect(container.querySelectorAll(".split-char").length).toBeGreaterThan(
          0
        );
      });

      rerender(
        <SplitText options={{ type: "chars" }}>
          <p className="text-[16px] font-[450] text-center my-0!">
            Click{" "}
            <a href="#" className="text-accent no-underline">
              <em>this link</em>
            </a>{" "}
            or see <em>updated text</em> and{" "}
            <strong className="font-bold">bold</strong> text
          </p>
        </SplitText>
      );

      await waitFor(() => {
        expect(container.querySelectorAll(".split-char").length).toBeGreaterThan(
          0
        );
      });

      const hasRemoveChildError = errorSpy.mock.calls.some((args) =>
        args.some((value) =>
          String(value).includes(
            "Failed to execute 'removeChild' on 'Node'"
          )
        )
      );

      expect(hasRemoveChildError).toBe(false);
      unmount();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
