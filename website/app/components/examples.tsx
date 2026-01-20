"use client";

import { useEffect, useRef, useState } from "react";
import { splitText, type SplitTextResult } from "fetta";
import { SplitText } from "fetta/react";
import { animate, stagger, scroll, inView } from "motion";
import gsap from "gsap";

// Easing presets
const easeOutQuart = [0.25, 1, 0.5, 1] as const;
const easeOutExpo = [0.16, 1, 0.3, 1] as const;

function StatusIndicator({ status }: { status: "animating" | "reverted" }) {
  return (
    <div className="absolute top-3 left-3 flex items-center gap-1.5 text-xs text-fd-muted-foreground">
      <div
        className={`size-2 rounded-full transition-colors ${
          status === "reverted" ? "bg-emerald-500" : "bg-amber-500"
        }`}
      />
      <span>{status === "animating" ? "Animating" : "Reverted"}</span>
    </div>
  );
}

export function BasicFadeIn() {
  return (
    <div className="px-4">
      <SplitText
        options={{ type: "words" }}
        onSplit={({ words }) => {
          animate(
            words,
            { opacity: [0, 1], filter: ["blur(8px)", "blur(0px)"], y: [20, 0] },
            { delay: stagger(0.04), duration: 0.6, ease: easeOutQuart },
          );
        }}
      >
        <p className="text-2xl md:text-3xl font-medium my-0!">
          Fade in each word
        </p>
      </SplitText>
    </div>
  );
}

export function CharacterReveal() {
  return (
    <div className="px-4">
      <SplitText
        options={{ type: "chars" }}
        onSplit={({ chars }) => {
          animate(
            chars,
            {
              opacity: [0, 1],
              filter: ["blur(10px)", "blur(0px)"],
              y: [16, 0],
            },
            { delay: stagger(0.03), duration: 0.65, ease: easeOutQuart },
          );
        }}
      >
        <p className="text-2xl md:text-3xl font-medium my-0!">
          Character by character
        </p>
      </SplitText>
    </div>
  );
}

export function LineByLine() {
  return (
    <div className="px-4">
      <SplitText
        onSplit={({ lines }) => {
          animate(
            lines,
            {
              opacity: [0, 1],
              filter: ["blur(8px)", "blur(0px)"],
              y: [20, 0],
            },
            { delay: stagger(0.1), duration: 0.6, ease: easeOutQuart },
          );
        }}
      >
        <p className="text-base md:text-lg max-w-md text-center">
          This paragraph animates line by line. Each line fades into view.
        </p>
      </SplitText>
    </div>
  );
}

export function ScrollTriggered() {
  return (
    <div className="h-full w-full overflow-y-auto fd-scroll-container">
      <div className="flex flex-col items-center justify-center h-full text-fd-muted-foreground px-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mb-2"
        >
          <path d="M12 5v14" />
          <path d="m19 12-7 7-7-7" />
        </svg>
        <span className="text-sm">Scroll down</span>
      </div>
      <div className="flex items-center justify-center h-full">
        <SplitText
          options={{ type: "words" }}
          onSplit={({ words }) => {
            words.forEach((w) => {
              w.style.opacity = "0";
              w.style.filter = "blur(8px)";
              w.style.transform = "translateY(20px)";
            });
          }}
          inView={{ amount: 1 }}
          onInView={({ words }) =>
            animate(
              words,
              {
                opacity: [0, 1],
                filter: ["blur(8px)", "blur(0px)"],
                y: [20, 0],
              },
              { delay: stagger(0.04), duration: 0.6, ease: easeOutQuart },
            )
          }
          onLeaveView={({ words }) => {
            words.forEach((w) => {
              w.style.opacity = "0";
              w.style.filter = "blur(8px)";
              w.style.transform = "translateY(20px)";
            });
          }}
        >
          <p className="text-2xl font-medium my-0!">Reveals on scroll</p>
        </SplitText>
      </div>
    </div>
  );
}

export function ScrollDriven() {
  const containerRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className="h-full w-full overflow-y-auto fd-scroll-container relative"
      ref={containerRef}
    >
      <div className="flex flex-col items-center justify-center h-full text-fd-muted-foreground px-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mb-2"
        >
          <path d="M12 5v14" />
          <path d="m19 12-7 7-7-7" />
        </svg>
        <span className="text-sm">Scroll to animate</span>
      </div>
      <div className="flex items-center justify-center min-h-full">
        <div ref={targetRef}>
          <SplitText
            options={{ type: "chars" }}
            onSplit={({ chars }) => {
              const container = containerRef.current;
              const target = targetRef.current;
              if (!container || !target) return;

              const animation = animate(
                chars.map((char, i) => [
                  char,
                  {
                    opacity: [0, 1],
                    filter: ["blur(4px)", "blur(0px)"],
                    y: [8, 0],
                  },
                  { duration: 0.3, at: i * 0.03, ease: easeOutQuart },
                ]),
              );

              scroll(animation, {
                container,
                target,
                offset: ["start 85%", "start 20%"],
              });
            }}
          >
            <p className="text-2xl font-medium text-center max-w-xs">
              Each character reveals as you scroll through this container
            </p>
          </SplitText>
        </div>
      </div>
      <div className="h-1/3" />
    </div>
  );
}

export function AutoRevert() {
  const [status, setStatus] = useState<"animating" | "reverted">("animating");

  return (
    <div className="px-4">
      <StatusIndicator status={status} />
      <SplitText
        options={{ type: "chars" }}
        onSplit={({ chars }) => {
          const animation = animate(
            chars,
            {
              opacity: [0, 1],
              filter: ["blur(8px)", "blur(0px)"],
              y: [12, 0],
            },
            { delay: stagger(0.025), duration: 0.55, ease: easeOutQuart },
          );
          animation.finished.then(() => setStatus("reverted"));
          return animation;
        }}
        revertOnComplete
      >
        <p className="text-2xl md:text-3xl font-medium my-0!">
          Auto-revert after animation
        </p>
      </SplitText>
    </div>
  );
}

export function MaskedLineReveal() {
  return (
    <div className="px-4">
      <SplitText
        onSplit={({ lines }) => {
          animate(
            lines,
            { y: ["105%", "0%"] },
            { delay: stagger(0.1), duration: 0.7, ease: easeOutExpo },
          );
        }}
        options={{ type: "lines", mask: "lines" }}
      >
        <p className="text-base md:text-lg max-w-md text-center">
          Each line reveals from below with a clipping mask for a clean effect.
        </p>
      </SplitText>
    </div>
  );
}

export function EmojiSupport() {
  return (
    <div className="px-4">
      <SplitText
        options={{ type: "chars" }}
        onSplit={({ chars }) => {
          animate(
            chars,
            {
              opacity: [0, 1],
              scale: [0.8, 1],
              y: [10, 0],
            },
            { delay: stagger(0.045), duration: 0.6, ease: easeOutQuart },
          );
        }}
      >
        <p className="text-2xl md:text-3xl text-center">
          Family: 👨‍👩‍👧‍👦 Flag: 🇯🇵 Skin: 👋🏽
        </p>
      </SplitText>
    </div>
  );
}

export function NestedElements() {
  return (
    <div className="px-4">
      <SplitText
        options={{ type: "chars" }}
        onSplit={({ chars }) => {
          animate(
            chars,
            {
              opacity: [0, 1],
              filter: ["blur(6px)", "blur(0px)"],
              y: [8, 0],
            },
            { delay: stagger(0.025), duration: 0.55, ease: easeOutQuart },
          );
        }}
      >
        <p className="text-2xl text-center">
          Click{" "}
          <a href="#" className="text-fd-primary no-underline">
            <em>this link</em>
          </a>{" "}
          or see <em>emphasized</em> and{" "}
          <strong className="font-bold">bold</strong> text
        </p>
      </SplitText>
    </div>
  );
}

export function ResponsiveSplit() {
  return (
    <div className="w-full">
      <SplitText
        autoSplit
        options={{ mask: "lines" }}
        onSplit={({ lines }) => {
          animate(
            lines,
            { y: ["100%", "0%"], opacity: [0.3, 1] },
            { delay: stagger(0.1), duration: 0.65, ease: easeOutExpo },
          );
        }}
      >
        <p className="text-base md:text-lg w-full text-center">
          This text reflows naturally at any width, with lines recalculated on
          resize.
        </p>
      </SplitText>
    </div>
  );
}

// Vanilla examples using splitText directly

const BASIC_FADE_IN_TEXT = "Fade in each word";

export function BasicFadeInVanilla() {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    // Reset to original text before splitting (handles remounting)
    ref.current.textContent = BASIC_FADE_IN_TEXT;
    const { words } = splitText(ref.current);
    animate(
      words,
      { opacity: [0, 1], filter: ["blur(8px)", "blur(0px)"], y: [20, 0] },
      { delay: stagger(0.04), duration: 0.6, ease: easeOutQuart },
    );
  }, []);

  return (
    <p ref={ref} className="text-2xl md:text-3xl font-medium my-0! px-4">
      {BASIC_FADE_IN_TEXT}
    </p>
  );
}

const CHARACTER_REVEAL_TEXT = "Character by character";

export function CharacterRevealVanilla() {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    // Reset to original text before splitting (handles remounting)
    ref.current.textContent = CHARACTER_REVEAL_TEXT;
    const { chars } = splitText(ref.current, { type: "chars" });
    animate(
      chars,
      {
        opacity: [0, 1],
        filter: ["blur(10px)", "blur(0px)"],
        y: [16, 0],
      },
      { delay: stagger(0.03), duration: 0.65, ease: easeOutQuart },
    );
  }, []);

  return (
    <p ref={ref} className="text-2xl md:text-3xl font-medium my-0! px-4">
      {CHARACTER_REVEAL_TEXT}
    </p>
  );
}

const LINE_BY_LINE_TEXT =
  "This paragraph animates line by line. Each line fades into view.";

export function LineByLineVanilla() {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    // Reset to original text before splitting (handles remounting)
    ref.current.textContent = LINE_BY_LINE_TEXT;
    const { lines } = splitText(ref.current);
    animate(
      lines,
      {
        opacity: [0, 1],
        filter: ["blur(8px)", "blur(0px)"],
        y: [20, 0],
      },
      { delay: stagger(0.1), duration: 0.6, ease: easeOutQuart },
    );
  }, []);

  return (
    <p ref={ref} className="text-base md:text-lg max-w-md text-center px-4">
      {LINE_BY_LINE_TEXT}
    </p>
  );
}

const NESTED_ELEMENTS_HTML = `Click <a href="#" class="text-fd-primary no-underline"><em>this link</em></a> or see <em class="italic">emphasized</em> and <strong class="font-bold">bold</strong> text`;

export function NestedElementsVanilla() {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    // Reset to original HTML before splitting (handles React StrictMode double-execution)
    ref.current.innerHTML = NESTED_ELEMENTS_HTML;
    const { chars } = splitText(ref.current, { type: "chars" });
    animate(
      chars,
      {
        opacity: [0, 1],
        filter: ["blur(6px)", "blur(0px)"],
        y: [8, 0],
      },
      { delay: stagger(0.025), duration: 0.55, ease: easeOutQuart },
    );
  }, []);

  return (
    <p
      ref={ref}
      className="text-2xl text-center px-4"
      dangerouslySetInnerHTML={{ __html: NESTED_ELEMENTS_HTML }}
    />
  );
}

const MASKED_LINE_REVEAL_TEXT =
  "Each line reveals from below with a clipping mask for a clean effect.";

export function MaskedLineRevealVanilla() {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    // Reset to original text before splitting (handles React StrictMode double-execution)
    ref.current.textContent = MASKED_LINE_REVEAL_TEXT;

    splitText(ref.current, {
      type: "lines",
      mask: "lines",
      onSplit: ({ lines }) => {
        animate(
          lines,
          { y: ["105%", "0%"] },
          { delay: stagger(0.1), duration: 0.7, ease: easeOutExpo },
        );
      },
    });
  }, []);

  return (
    <p ref={ref} className="text-base md:text-lg max-w-md text-center px-4">
      {MASKED_LINE_REVEAL_TEXT}
    </p>
  );
}

const AUTO_REVERT_TEXT = "Auto-revert after animation";

export function AutoRevertVanilla() {
  const ref = useRef<HTMLHeadingElement>(null);
  const [status, setStatus] = useState<"animating" | "reverted">("animating");

  useEffect(() => {
    if (!ref.current) return;

    // Reset to original text before splitting (handles React StrictMode double-execution)
    ref.current.textContent = AUTO_REVERT_TEXT;
    queueMicrotask(() => setStatus("animating"));

    splitText(ref.current, {
      type: "chars",
      onSplit: ({ chars }) => {
        const animation = animate(
          chars,
          {
            opacity: [0, 1],
            filter: ["blur(8px)", "blur(0px)"],
            y: [12, 0],
          },
          { delay: stagger(0.025), duration: 0.55, ease: easeOutQuart },
        );
        animation.finished.then(() => setStatus("reverted"));
        return animation;
      },
      revertOnComplete: true,
    });
  }, []);

  return (
    <>
      <StatusIndicator status={status} />
      <p ref={ref} className="text-2xl md:text-3xl font-medium my-0! px-4">
        {AUTO_REVERT_TEXT}
      </p>
    </>
  );
}

const RESPONSIVE_TEXT =
  "This text reflows naturally at any width, animating again when lines change.";

export function ResponsiveSplitVanilla() {
  const ref = useRef<HTMLParagraphElement>(null);
  const resultRef = useRef<SplitTextResult | null>(null);

  useEffect(() => {
    if (!ref.current) return;

    // Reset to original text before splitting (handles React StrictMode double-execution)
    ref.current.textContent = RESPONSIVE_TEXT;

    const animateLines = (lines: HTMLElement[]) => {
      animate(
        lines,
        { y: ["100%", "0%"], opacity: [0.3, 1] },
        { delay: stagger(0.1), duration: 0.65, ease: easeOutExpo },
      );
    };

    resultRef.current = splitText(ref.current, {
      autoSplit: true,
      mask: "lines",
      onResize: ({ lines }) => animateLines(lines),
    });
    // Initial animation
    if (resultRef.current.lines) {
      animateLines(resultRef.current.lines);
    }
    return () => resultRef.current?.revert();
  }, []);

  return (
    <p ref={ref} className="text-base md:text-lg w-full text-center px-4">
      {RESPONSIVE_TEXT}
    </p>
  );
}

const GSAP_TEXT = "Animated with GSAP";

export function WithGSAPVanilla() {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    // Reset to original text before splitting (handles React StrictMode double-execution)
    ref.current.textContent = GSAP_TEXT;
    const { words } = splitText(ref.current, { type: "words" });
    gsap.from(words, {
      opacity: 0,
      y: 24,
      filter: "blur(12px)",
      stagger: 0.04,
      duration: 0.7,
      ease: "expo.out",
    });
  }, []);

  return (
    <p ref={ref} className="text-2xl md:text-3xl font-medium my-0! px-4">
      {GSAP_TEXT}
    </p>
  );
}

const SCROLL_TRIGGERED_TEXT = "Reveals on scroll";

export function ScrollTriggeredVanilla() {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!containerRef.current || !textRef.current) return;

    // Reset text for React StrictMode
    textRef.current.textContent = SCROLL_TRIGGERED_TEXT;

    const { words } = splitText(textRef.current, { type: "words" });

    // Set initial hidden state
    words.forEach((w) => {
      w.style.opacity = "0";
      w.style.filter = "blur(8px)";
      w.style.transform = "translateY(20px)";
    });

    const cleanup = inView(
      textRef.current,
      () => {
        animate(
          words,
          {
            opacity: [0, 1],
            filter: ["blur(8px)", "blur(0px)"],
            y: [20, 0],
          },
          { delay: stagger(0.04), duration: 0.6, ease: easeOutQuart },
        );
        // Reset styles when leaving view
        return () => {
          words.forEach((w) => {
            w.style.opacity = "0";
            w.style.filter = "blur(8px)";
            w.style.transform = "translateY(20px)";
          });
        };
      },
      { root: containerRef.current, amount: 1 },
    );

    return cleanup;
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-y-auto fd-scroll-container"
    >
      <div className="flex flex-col items-center justify-center h-full text-fd-muted-foreground px-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mb-2"
        >
          <path d="M12 5v14" />
          <path d="m19 12-7 7-7-7" />
        </svg>
        <span className="text-sm">Scroll down</span>
      </div>
      <div className="flex items-center justify-center h-full">
        <p ref={textRef} className="text-2xl font-medium my-0!">
          {SCROLL_TRIGGERED_TEXT}
        </p>
      </div>
    </div>
  );
}

const CSS_ONLY_TEXT = "Pure CSS animation";

export function CSSOnlyVanilla() {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.textContent = CSS_ONLY_TEXT;
    splitText(ref.current, { propIndex: true });
  }, []);

  return (
    <p
      ref={ref}
      className="text-2xl md:text-3xl font-medium my-0! css-only-example"
    >
      {CSS_ONLY_TEXT}
    </p>
  );
}

const SCROLL_DRIVEN_TEXT =
  "Each character reveals as you scroll through this container";

export function ScrollDrivenVanilla() {
  const containerRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!containerRef.current || !targetRef.current || !textRef.current) return;

    // Reset text for React StrictMode
    textRef.current.textContent = SCROLL_DRIVEN_TEXT;

    const { chars } = splitText(textRef.current, { type: "chars" });

    const animation = animate(
      chars.map((char, i) => [
        char,
        {
          opacity: [0, 1],
          filter: ["blur(4px)", "blur(0px)"],
          y: [8, 0],
        },
        { duration: 0.3, at: i * 0.03, ease: easeOutQuart },
      ]),
    );

    const cleanup = scroll(animation, {
      container: containerRef.current,
      target: targetRef.current,
      offset: ["start 85%", "start 20%"],
    });

    return cleanup;
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-y-auto fd-scroll-container relative"
    >
      <div className="flex flex-col items-center justify-center h-full text-fd-muted-foreground px-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mb-2"
        >
          <path d="M12 5v14" />
          <path d="m19 12-7 7-7-7" />
        </svg>
        <span className="text-sm">Scroll to animate</span>
      </div>
      <div className="flex items-center justify-center min-h-full">
        <div ref={targetRef}>
          <p
            ref={textRef}
            className="text-2xl font-medium text-center max-w-xs"
          >
            {SCROLL_DRIVEN_TEXT}
          </p>
        </div>
      </div>
      <div className="h-1/3" />
    </div>
  );
}
