"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { splitText } from "fetta";
import gsap from "gsap";
import { SplitText as GSAPSplitText } from "gsap/SplitText";
import { cn } from "@/app/lib/cn";

gsap.registerPlugin(GSAPSplitText);

const COMPARISON_TEXT = "WAVEY Typography";

interface CompensationData {
  count: number;
  indexes: number[];
}

interface TooltipState {
  margin: string;
  x: number;
  y: number;
}

interface GSAPTextRowProps {
  isSplit: boolean;
  showOutlines: boolean;
  highlightIndexes: number[];
}

function GSAPTextRow({
  isSplit,
  showOutlines,
  highlightIndexes,
}: GSAPTextRowProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const splitRef = useRef<GSAPSplitText | null>(null);

  useEffect(() => {
    if (!ref.current) return;

    // Revert previous split
    if (splitRef.current) {
      splitRef.current.revert();
      splitRef.current = null;
    }

    ref.current.textContent = COMPARISON_TEXT;

    if (!isSplit) return;

    void ref.current.offsetHeight;

    splitRef.current = new GSAPSplitText(ref.current, {
      type: "chars",
      charsClass: "split-char",
    });

    return () => {
      if (splitRef.current) {
        splitRef.current.revert();
        splitRef.current = null;
      }
    };
  }, [isSplit]);

  // Apply outlines to highlighted indexes
  useEffect(() => {
    if (!ref.current || !isSplit) return;

    const chars = ref.current.querySelectorAll<HTMLElement>(".split-char");
    const indexSet = new Set(highlightIndexes);

    chars.forEach((char, index) => {
      if (showOutlines && indexSet.has(index)) {
        char.setAttribute("data-highlight", "true");
      } else {
        char.removeAttribute("data-highlight");
      }
    });
  }, [isSplit, showOutlines, highlightIndexes]);

  return (
    <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3">
      <span
        ref={ref}
        className="text-[28px] lg:text-[32px] font-medium tracking-tight leading-tight"
      >
        {COMPARISON_TEXT}
      </span>
      <span className="text-xs text-fd-muted-foreground">GSAP SplitText</span>
    </div>
  );
}

interface FettaTextRowProps {
  isSplit: boolean;
  showOutlines: boolean;
  onCompensationData: (data: CompensationData) => void;
  onTooltip: (state: TooltipState | null) => void;
}

function FettaTextRow({
  isSplit,
  showOutlines,
  onCompensationData,
  onTooltip,
}: FettaTextRowProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const onCompensationDataRef = useRef(onCompensationData);
  const compensatedIndexesRef = useRef<number[]>([]);
  const activeCharRef = useRef<HTMLElement | null>(null);

  // Keep callback ref up to date
  useEffect(() => {
    onCompensationDataRef.current = onCompensationData;
  });

  useEffect(() => {
    if (!ref.current) return;

    ref.current.textContent = COMPARISON_TEXT;
    compensatedIndexesRef.current = [];

    if (!isSplit) {
      onCompensationDataRef.current({ count: 0, indexes: [] });
      return;
    }

    const el = ref.current;

    // Force layout before measuring
    void el.offsetHeight;

    splitText(el, { type: "chars" });

    // Analyze compensation
    const chars = el.querySelectorAll<HTMLElement>(".split-char");
    const indexes: number[] = [];

    chars.forEach((char, index) => {
      const marginLeft = char.style.marginLeft;
      const hasCompensation = marginLeft && marginLeft !== "0px";

      if (hasCompensation) {
        char.setAttribute("data-margin", marginLeft);
        indexes.push(index);
      }
    });

    compensatedIndexesRef.current = indexes;
    onCompensationDataRef.current({ count: indexes.length, indexes });
  }, [isSplit]);

  // Apply outlines to compensated indexes
  useEffect(() => {
    if (!ref.current || !isSplit) return;

    const chars = ref.current.querySelectorAll<HTMLElement>(".split-char");
    const indexSet = new Set(compensatedIndexesRef.current);

    chars.forEach((char, index) => {
      if (showOutlines && indexSet.has(index)) {
        char.setAttribute("data-highlight", "true");
      } else {
        char.removeAttribute("data-highlight");
      }
    });
  }, [isSplit, showOutlines]);

  const isInsideTextRef = useRef(false);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasShownTooltipRef = useRef(false);

  const showTooltipForChar = (char: HTMLElement) => {
    hasShownTooltipRef.current = true;
    if (activeCharRef.current) {
      activeCharRef.current.removeAttribute("data-active");
    }
    activeCharRef.current = char;
    char.setAttribute("data-active", "true");

    const rect = char.getBoundingClientRect();
    onTooltip({
      margin: char.dataset.margin!,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  };

  const hideTooltip = () => {
    if (delayTimerRef.current) {
      clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }
    if (activeCharRef.current) {
      activeCharRef.current.removeAttribute("data-active");
      activeCharRef.current = null;
    }
    onTooltip(null);
  };

  const handleMouseEnter = () => {
    isInsideTextRef.current = true;
  };

  const handleMouseLeave = () => {
    isInsideTextRef.current = false;
    hasShownTooltipRef.current = false;
    hideTooltip();
  };

  const handleMouseOver = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.classList.contains("split-char") || !target.dataset.margin) {
      return;
    }

    // Clear any pending timer
    if (delayTimerRef.current) {
      clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }

    // If we've already shown a tooltip while inside, switch instantly
    if (hasShownTooltipRef.current) {
      showTooltipForChar(target);
    } else {
      // First hover - apply delay
      delayTimerRef.current = setTimeout(() => {
        if (isInsideTextRef.current) {
          showTooltipForChar(target);
        }
      }, 300);
    }
  };

  const handleMouseOut = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const relatedTarget = e.relatedTarget as HTMLElement | null;

    if (!target.classList.contains("split-char") || !target.dataset.margin) {
      return;
    }

    // If moving to another compensated char, don't hide
    if (
      relatedTarget?.classList.contains("split-char") &&
      relatedTarget?.dataset.margin
    ) {
      return;
    }

    // Moving to non-compensated area - hide but stay "inside"
    hideTooltip();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains("split-char") && target.dataset.margin) {
      showTooltipForChar(target);
    } else {
      hideTooltip();
    }
  };

  return (
    <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3">
      <span
        ref={ref}
        className="text-[28px] lg:text-[32px] font-medium tracking-tight leading-tight [&_.split-char[data-margin]]:cursor-help [&_.split-char[data-active]]:bg-fd-foreground/10 [&_.split-char[data-active]]:dark:bg-amber-500/20"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseOver={handleMouseOver}
        onMouseOut={handleMouseOut}
        onTouchStart={handleTouchStart}
      >
        {COMPARISON_TEXT}
      </span>
      <span className="text-xs text-fd-muted-foreground">Fetta</span>
    </div>
  );
}

function CharTooltip({ state }: { state: TooltipState }) {
  return createPortal(
    <div
      className="fixed z-50 px-1.5 py-1 text-xs rounded-xs bg-fd-foreground text-fd-background pointer-events-none animate-in fade-in-0 zoom-in-95 duration-100"
      style={{
        left: state.x,
        top: state.y,
        transform: "translate(-50%, calc(-100% - 6px))",
      }}
    >
      {state.margin}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-[calc(50%-2px)] size-2 rotate-45 rounded-[1px] bg-fd-foreground" />
    </div>,
    document.body,
  );
}

interface KerningComparisonClientProps {
  isSafari: boolean;
}

export function KerningComparisonClient({
  isSafari,
}: KerningComparisonClientProps) {
  const [isSplit, setIsSplit] = useState(false);
  const [showOutlines, setShowOutlines] = useState(false);
  const [compensationData, setCompensationData] = useState<CompensationData>({
    count: 0,
    indexes: [],
  });
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  // Outline styles: only applied to highlighted chars
  const outlineStyles =
    '[&_.split-char[data-highlight="true"]]:outline-[0.8px] [&_.split-char[data-highlight="true"]]:outline-dashed [&_.split-char[data-highlight="true"]]:-outline-offset-1 [&_.split-char[data-highlight="true"]]:outline-fd-foreground [&_.split-char[data-highlight="true"]]:dark:outline-amber-500';

  // Safari fallback: show static images instead of interactive demo
  if (isSafari) {
    return (
      <figure className="my-8 not-prose font-sans">
        <div className="bg-fd-card rounded-xl relative border shadow-sm overflow-hidden">
          {/* Mobile container (< sm) */}
          <div className="relative sm:hidden aspect-127/50">
            <Image
              src="/compensation-light-mobile.webp"
              alt="Kerning compensation comparison showing GSAP SplitText vs Fetta"
              fill
              className="object-cover dark:hidden"
            />
            <Image
              src="/compensation-dark-mobile.webp"
              alt="Kerning compensation comparison showing GSAP SplitText vs Fetta"
              fill
              className="object-cover hidden dark:block"
            />
          </div>
          {/* Desktop container (sm+) */}
          <div className="relative hidden sm:block aspect-847/120">
            <Image
              src="/compensation-light.webp"
              alt="Kerning compensation comparison showing GSAP SplitText vs Fetta"
              fill
              className="object-cover dark:hidden"
            />
            <Image
              src="/compensation-dark.webp"
              alt="Kerning compensation comparison showing GSAP SplitText vs Fetta"
              fill
              className="object-cover hidden dark:block"
            />
          </div>
        </div>

        <figcaption className="mt-4 text-center text-xs text-fd-muted-foreground text-balance max-w-prose mx-auto">
          <span className="text-amber-600 dark:text-amber-500">
            Outlined characters
          </span>{" "}
          are kerning-compensated in Fetta. Interactive demo unavailable in
          Safari/WebKit — its Range API returns integers instead of sub-pixel
          values.
        </figcaption>
      </figure>
    );
  }

  return (
    <figure className="my-8 not-prose font-sans">
      <div className="bg-fd-card rounded-xl relative border shadow-sm overflow-hidden">
        <div className={cn("p-4 space-y-2", outlineStyles)}>
          <GSAPTextRow
            isSplit={isSplit}
            showOutlines={showOutlines}
            highlightIndexes={compensationData.indexes}
          />
          <FettaTextRow
            isSplit={isSplit}
            showOutlines={showOutlines}
            onCompensationData={setCompensationData}
            onTooltip={setTooltip}
          />
        </div>

        {tooltip && <CharTooltip state={tooltip} />}

        <div className="flex items-center justify-between px-4 py-3 border-t border-fd-border">
          <div className="flex items-center">
            <button
              onClick={() => {
                if (isSplit) {
                  setShowOutlines(false);
                }
                setIsSplit((s) => !s);
              }}
              aria-pressed={isSplit}
              aria-label={isSplit ? "Revert" : "Split"}
              className={cn(
                "w-20 h-9.5 text-[15px] rounded-l-lg border font-medium cursor-pointer transition-all duration-100 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2",
                {
                  "bg-fd-accent text-fd-accent-foreground border-fd-foreground/20":
                    isSplit,
                  "border-fd-border bg-fd-secondary text-fd-secondary-foreground not-disabled:hover:bg-fd-accent":
                    !isSplit,
                },
              )}
            >
              {isSplit ? "Revert" : "Split"}
            </button>
            <button
              disabled={!isSplit}
              onClick={() => setShowOutlines((s) => !s)}
              aria-pressed={showOutlines}
              aria-label={
                showOutlines
                  ? "Hide character outlines"
                  : "Show character outlines"
              }
              className={cn(
                "h-9.5 text-[15px] px-4 rounded-r-lg border border-l-0 font-medium cursor-pointer transition-all duration-100 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2",
                {
                  "bg-fd-accent text-fd-accent-foreground border-fd-foreground/20":
                    showOutlines,
                  "border-fd-border bg-fd-secondary text-fd-secondary-foreground not-disabled:hover:bg-fd-accent":
                    !showOutlines,
                },
              )}
            >
              Outline chars
            </button>
          </div>

          {isSplit && (
            <span className="text-xs text-fd-muted-foreground">
              <span className="text-amber-600 dark:text-amber-500 font-medium">
                {compensationData.count}
              </span>{" "}
              chars compensated
            </span>
          )}
        </div>
      </div>

      <figcaption className="mt-4 text-center text-xs text-fd-muted-foreground text-balance max-w-prose mx-auto">
        Press Split to see the difference in character spacing.
      </figcaption>
    </figure>
  );
}
