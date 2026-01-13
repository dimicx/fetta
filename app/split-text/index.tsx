"use client";

export { splitText } from "./splitText";
export type { SplitTextOptions, SplitResult } from "./splitText";

import { splitText, SplitResult } from "./splitText";
import {
  cloneElement,
  isValidElement,
  ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

interface SplitTextOptions {
  charClass?: string;
  wordClass?: string;
  lineClass?: string;
  splitBy?: string;
}

interface SplitTextProps {
  children: ReactElement;
  /** Return a promise to revert to original HTML when it resolves */
  onSplit: (result: Omit<SplitResult, "revert">) => void | Promise<unknown>;
  options?: SplitTextOptions;
  autoSplit?: boolean;
}

/**
 * React component wrapper for the custom splitText function.
 * Uses the optimized splitText that handles kerning compensation
 * and dash splitting in a single pass.
 */
export function SplitText({
  children,
  onSplit,
  options,
  autoSplit = false,
}: SplitTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [childElement, setChildElement] = useState<HTMLElement | null>(null);

  // Stable refs for callbacks and options
  const onSplitRef = useRef(onSplit);
  const optionsRef = useRef(options);

  useLayoutEffect(() => {
    onSplitRef.current = onSplit;
    optionsRef.current = options;
  });

  // Refs for tracking state
  const originalHtmlRef = useRef<string | null>(null);
  const lastWidthRef = useRef<number | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasSplitRef = useRef(false);
  const hasRevertedRef = useRef(false);
  const revertFnRef = useRef<(() => void) | null>(null);

  const childRefCallback = useCallback((node: HTMLElement | null) => {
    setChildElement(node);
  }, []);

  // Initial split and animation
  useEffect(() => {
    if (!childElement) return;
    if (hasSplitRef.current) return;

    let isMounted = true;

    document.fonts.ready.then(() => {
      if (!isMounted || hasSplitRef.current) return;
      if (!containerRef.current) return;

      // Store original HTML
      if (originalHtmlRef.current === null) {
        originalHtmlRef.current = childElement.innerHTML;
      }

      // Use our custom splitText
      const result = splitText(childElement, optionsRef.current);

      // Store revert function
      revertFnRef.current = result.revert;

      hasSplitRef.current = true;
      lastWidthRef.current = childElement.offsetWidth;

      // Reveal after split
      containerRef.current.style.visibility = "visible";

      // Call onSplit without the revert function
      const { revert, ...splitResult } = result;
      const maybePromise = onSplitRef.current(splitResult);

      // If promise returned, revert when it resolves
      if (maybePromise instanceof Promise) {
        maybePromise.then(() => {
          if (!isMounted) return;
          result.revert();
          hasRevertedRef.current = true;
        });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [childElement]);

  // ResizeObserver for autoSplit
  useEffect(() => {
    if (!autoSplit || !childElement || !containerRef.current) return;

    const container = containerRef.current;

    const handleResize = () => {
      if (hasRevertedRef.current) return;
      if (originalHtmlRef.current === null) return;

      const currentWidth = container.offsetWidth;
      if (currentWidth === lastWidthRef.current) return;
      lastWidthRef.current = currentWidth;

      // Restore original HTML
      childElement.innerHTML = originalHtmlRef.current;

      // Wait for layout to complete before measuring and splitting
      requestAnimationFrame(() => {
        if (hasRevertedRef.current) return;
        const result = splitText(childElement, optionsRef.current);
        revertFnRef.current = result.revert;
      });
    };

    let skipFirst = true;

    const resizeObserver = new ResizeObserver(() => {
      if (skipFirst) {
        skipFirst = false;
        return;
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(handleResize, 100);
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [autoSplit, childElement]);

  if (!isValidElement(children)) {
    console.error("SplitText: children must be a single valid React element");
    return null;
  }

  const clonedChild = cloneElement(children, {
    ref: childRefCallback,
  } as Record<string, unknown>);

  return (
    <div ref={containerRef} style={{ visibility: "hidden" }}>
      {clonedChild}
    </div>
  );
}
