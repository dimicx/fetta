"use client";

import { useEffect, useRef, useState } from "react";
import { splitText, type SplitTextResult } from "fetta";
import { SplitText } from "fetta/react";
import { animate, stagger, scroll } from "motion";
import gsap from "gsap";

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
    <SplitText
      onSplit={({ words }) => {
        animate(
          words,
          { opacity: [0, 1], y: [20, 0] },
          { delay: stagger(0.05), duration: 0.5 },
        );
      }}
    >
      <h2 className="text-3xl font-bold my-0!">Fade in each word</h2>
    </SplitText>
  );
}

export function CharacterReveal() {
  return (
    <SplitText
      onSplit={({ chars }) => {
        animate(
          chars,
          { opacity: [0, 1], scale: [0.5, 1] },
          { delay: stagger(0.02), duration: 0.3 },
        );
      }}
    >
      <h2 className="text-3xl font-bold my-0!">Character by character</h2>
    </SplitText>
  );
}

export function LineByLine() {
  return (
    <SplitText
      onSplit={({ lines }) => {
        animate(
          lines,
          { opacity: [0, 1], x: [-20, 0] },
          { delay: stagger(0.1), duration: 0.6 },
        );
      }}
    >
      <p className="text-lg max-w-md text-center">
        This paragraph animates line by line. Each line slides in from the left.
      </p>
    </SplitText>
  );
}

export function ScrollTriggered() {
  return (
    <div className="h-full w-full overflow-y-auto fd-scroll-container">
      <div className="flex flex-col items-center justify-center h-full text-fd-muted-foreground">
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
          className="mb-2 animate-bounce"
        >
          <path d="M12 5v14" />
          <path d="m19 12-7 7-7-7" />
        </svg>
        <span className="text-sm">Scroll down</span>
      </div>
      <div className="flex items-center justify-center h-full">
        <SplitText
          onSplit={({ words }) => {
            words.forEach((w) => (w.style.opacity = "0"));
          }}
          inView={{ amount: 0.5, once: true }}
          onInView={({ words }) =>
            animate(
              words,
              { opacity: [0, 1], y: [30, 0] },
              { delay: stagger(0.03) },
            )
          }
        >
          <h2 className="text-2xl font-bold my-0!">Reveals on scroll</h2>
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
      <div className="flex flex-col items-center justify-center h-full text-fd-muted-foreground">
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
          className="mb-2 animate-bounce"
        >
          <path d="M12 5v14" />
          <path d="m19 12-7 7-7-7" />
        </svg>
        <span className="text-sm">Scroll to animate</span>
      </div>
      <div className="flex items-center justify-center min-h-full">
        <div ref={targetRef}>
          <SplitText
            onSplit={({ words }) => {
              const container = containerRef.current;
              const target = targetRef.current;
              if (!container || !target) return;

              const animation = animate(
                words.map((word, i) => [
                  word,
                  { opacity: [0, 1], y: [20, 0] },
                  { duration: 0.5, at: i * 0.1, ease: "linear" },
                ]),
              );

              scroll(animation, {
                container,
                target,
                offset: ["start 85%", "start 20%"],
              });
            }}
            options={{ type: "words" }}
          >
            <p className="text-2xl font-bold text-center max-w-xs">
              Each word reveals as you scroll through this container
            </p>
          </SplitText>
        </div>
      </div>
      <div className="h-full" />
    </div>
  );
}

export function AutoRevert() {
  const [status, setStatus] = useState<"animating" | "reverted">("animating");

  return (
    <>
      <StatusIndicator status={status} />
      <SplitText
        onSplit={({ words }) => {
          const animation = animate(
            words,
            { opacity: [0, 1], y: [20, 0] },
            { delay: stagger(0.05) },
          );
          animation.finished.then(() => setStatus("reverted"));
          return animation;
        }}
        revertOnComplete
      >
        <h2 className="text-3xl font-bold my-0!">Auto-revert after animation</h2>
      </SplitText>
    </>
  );
}

export function MaskedLineReveal() {
  return (
    <SplitText
      onSplit={({ lines }) => {
        animate(
          lines,
          { y: ["100%", "0%"] },
          { delay: stagger(0.1), duration: 0.5, ease: [0.25, 1, 0.5, 1] },
        );
      }}
      options={{ type: "lines", mask: "lines" }}
    >
      <p className="text-lg max-w-md text-center">
        Each line reveals from below with a clipping mask for a clean effect.
      </p>
    </SplitText>
  );
}

export function ResponsiveSplit() {
  return (
    <div className="w-full">
      <SplitText
        autoSplit
        onSplit={({ lines }) => {
          animate(
            lines,
            { opacity: [0, 1], y: [16, 0] },
            { delay: stagger(0.08), duration: 0.4 },
          );
        }}
      >
        <p className="text-lg w-full text-center">
          Resize the window to see this text re-split and animate again.
        </p>
      </SplitText>
    </div>
  );
}

// Vanilla examples using splitText directly

export function BasicFadeInVanilla() {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const { words } = splitText(ref.current);
    animate(
      words,
      { opacity: [0, 1], y: [20, 0] },
      { delay: stagger(0.05), duration: 0.5 },
    );
  }, []);

  return (
    <h2 ref={ref} className="text-3xl font-bold my-0!">
      Fade in each word
    </h2>
  );
}

export function CharacterRevealVanilla() {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const { chars } = splitText(ref.current);
    animate(
      chars,
      { opacity: [0, 1], scale: [0.5, 1] },
      { delay: stagger(0.02), duration: 0.3 },
    );
  }, []);

  return (
    <h2 ref={ref} className="text-3xl font-bold my-0!">
      Character by character
    </h2>
  );
}

export function LineByLineVanilla() {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const { lines } = splitText(ref.current);
    animate(
      lines,
      { opacity: [0, 1], x: [-20, 0] },
      { delay: stagger(0.1), duration: 0.6 },
    );
  }, []);

  return (
    <p ref={ref} className="text-lg max-w-md text-center">
      This paragraph animates line by line. Each line slides in from the left.
    </p>
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
          { y: ["100%", "0%"] },
          { delay: stagger(0.1), duration: 0.5, ease: [0.25, 1, 0.5, 1] },
        );
      },
    });
  }, []);

  return (
    <p ref={ref} className="text-lg max-w-md text-center">
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
    setStatus("animating");

    splitText(ref.current, {
      onSplit: ({ words }) => {
        const animation = animate(
          words,
          { opacity: [0, 1], y: [20, 0] },
          { delay: stagger(0.05) },
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
      <h2 ref={ref} className="text-3xl font-bold my-0!">
        {AUTO_REVERT_TEXT}
      </h2>
    </>
  );
}

const RESPONSIVE_TEXT =
  "Resize the window to see this text re-split and animate again.";

export function ResponsiveSplitVanilla() {
  const ref = useRef<HTMLParagraphElement>(null);
  const resultRef = useRef<SplitTextResult | null>(null);

  useEffect(() => {
    if (!ref.current) return;

    // Reset to original text before splitting (handles React StrictMode double-execution)
    ref.current.textContent = RESPONSIVE_TEXT;

    resultRef.current = splitText(ref.current, {
      autoSplit: true,
      onResize: ({ lines }) => {
        animate(
          lines,
          { opacity: [0, 1], y: [16, 0] },
          { delay: stagger(0.08), duration: 0.4 },
        );
      },
    });
    // Initial animation
    if (resultRef.current.lines) {
      animate(
        resultRef.current.lines,
        { opacity: [0, 1], y: [16, 0] },
        { delay: stagger(0.08), duration: 0.4 },
      );
    }
    return () => resultRef.current?.revert();
  }, []);

  return (
    <p ref={ref} className="text-lg w-full text-center">
      {RESPONSIVE_TEXT}
    </p>
  );
}

export function WithGSAPVanilla() {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const { words } = splitText(ref.current);
    gsap.from(words, {
      opacity: 0,
      y: 30,
      stagger: 0.05,
      duration: 0.5,
      ease: "power2.out",
    });
  }, []);

  return (
    <h2 ref={ref} className="text-3xl font-bold my-0!">
      Animated with GSAP
    </h2>
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

    const { words } = splitText(textRef.current);
    words.forEach((w) => (w.style.opacity = "0"));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animate(
              words,
              { opacity: [0, 1], y: [30, 0] },
              { delay: stagger(0.03) },
            );
            observer.disconnect();
          }
        });
      },
      { root: containerRef.current, threshold: 0.5 },
    );

    observer.observe(textRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-y-auto fd-scroll-container"
    >
      <div className="flex flex-col items-center justify-center h-full text-fd-muted-foreground">
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
          className="mb-2 animate-bounce"
        >
          <path d="M12 5v14" />
          <path d="m19 12-7 7-7-7" />
        </svg>
        <span className="text-sm">Scroll down</span>
      </div>
      <div className="flex items-center justify-center h-full">
        <h2 ref={textRef} className="text-2xl font-bold my-0!">
          {SCROLL_TRIGGERED_TEXT}
        </h2>
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
    <p ref={ref} className="text-3xl font-bold my-0! css-only-example">
      {CSS_ONLY_TEXT}
    </p>
  );
}

const SCROLL_DRIVEN_TEXT =
  "Each word reveals as you scroll through this container";

export function ScrollDrivenVanilla() {
  const containerRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!containerRef.current || !targetRef.current || !textRef.current) return;

    // Reset text for React StrictMode
    textRef.current.textContent = SCROLL_DRIVEN_TEXT;

    const { words } = splitText(textRef.current);

    const animation = animate(
      words.map((word, i) => [
        word,
        { opacity: [0, 1], y: [20, 0] },
        { duration: 0.5, at: i * 0.1, ease: "linear" as const },
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
      <div className="flex flex-col items-center justify-center h-full text-fd-muted-foreground">
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
          className="mb-2 animate-bounce"
        >
          <path d="M12 5v14" />
          <path d="m19 12-7 7-7-7" />
        </svg>
        <span className="text-sm">Scroll to animate</span>
      </div>
      <div className="flex items-center justify-center min-h-full">
        <div ref={targetRef}>
          <p ref={textRef} className="text-2xl font-bold text-center max-w-xs">
            {SCROLL_DRIVEN_TEXT}
          </p>
        </div>
      </div>
      <div className="h-full" />
    </div>
  );
}
