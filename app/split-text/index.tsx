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
  type?: 'chars' | 'words' | 'lines' | 'chars,words' | 'words,lines' | 'chars,lines' | 'chars,words,lines';
  charClass?: string;
  wordClass?: string;
  lineClass?: string;
  propIndex?: boolean;
  willChange?: boolean;
}

interface SplitTextProps {
  children: ReactElement;
  /** Called after text is split. Return a promise to enable revert (requires revertOnComplete) */
  onSplit: (
    result: Omit<SplitResult, "revert" | "dispose">
  ) => void | Promise<unknown>;
  /** Called when autoSplit triggers a re-split on resize */
  onResize?: (result: Omit<SplitResult, "revert" | "dispose">) => void;
  options?: SplitTextOptions;
  autoSplit?: boolean;
  /** When true, reverts to original HTML after onSplit's returned promise resolves */
  revertOnComplete?: boolean;
}

/**
 * React component wrapper for the custom splitText function.
 * Uses the optimized splitText that handles kerning compensation
 * and dash splitting in a single pass.
 */
export function SplitText({
  children,
  onSplit,
  onResize,
  options,
  autoSplit = false,
  revertOnComplete = false,
}: SplitTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [childElement, setChildElement] = useState<HTMLElement | null>(null);

  // Stable refs for callbacks and options
  const onSplitRef = useRef(onSplit);
  const onResizeRef = useRef(onResize);
  const optionsRef = useRef(options);
  const revertOnCompleteRef = useRef(revertOnComplete);

  useLayoutEffect(() => {
    onSplitRef.current = onSplit;
    onResizeRef.current = onResize;
    optionsRef.current = options;
    revertOnCompleteRef.current = revertOnComplete;
  });

  // Refs for tracking state
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

      // Use core splitText with autoSplit feature
      const result = splitText(childElement, {
        ...optionsRef.current,
        autoSplit,
        onResize: onResizeRef.current,
      });

      // Store dispose function
      revertFnRef.current = result.dispose;

      hasSplitRef.current = true;

      // Reveal after split
      containerRef.current.style.visibility = "visible";

      // Call onSplit with the result
      const splitResult = {
        chars: result.chars,
        words: result.words,
        lines: result.lines,
      };
      const maybePromise = onSplitRef.current(splitResult);

      // Handle revertOnComplete using core's revertOnComplete feature
      if (revertOnCompleteRef.current) {
        if (maybePromise instanceof Promise) {
          maybePromise.then(() => {
            if (!isMounted) return;
            result.revert();
            hasRevertedRef.current = true;
          });
        } else {
          console.warn(
            "SplitText: revertOnComplete is enabled but onSplit did not return a promise. " +
              "Return a promise (e.g., animate(...).finished) to revert after animation completes."
          );
        }
      } else if (maybePromise instanceof Promise) {
        console.warn(
          "SplitText: onSplit returned a promise but revertOnComplete is not enabled. " +
            "Add the revertOnComplete prop if you want to revert after the animation completes."
        );
      }
    });

    return () => {
      isMounted = false;
      // Cleanup on unmount
      if (revertFnRef.current) {
        revertFnRef.current();
      }
    };
  }, [childElement, autoSplit]);

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
