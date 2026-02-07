import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import React from "react";

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
