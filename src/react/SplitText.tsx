import { splitText, normalizeToPromise } from "../core/splitText";
import {
  reapplyInitialStyles,
  reapplyInitialClasses,
} from "../internal/initialStyles";
import type { InitialStyles, InitialClasses } from "../internal/initialStyles";
import { waitForFontsReady } from "../internal/waitForFontsReady";
import {
  createElement,
  forwardRef,
  isValidElement,
  ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

interface SplitTextOptions {
  type?:
    | "chars"
    | "words"
    | "lines"
    | "chars,words"
    | "words,lines"
    | "chars,lines"
    | "chars,words,lines";
  charClass?: string;
  wordClass?: string;
  lineClass?: string;
  /** Apply overflow mask wrapper to elements for reveal animations */
  mask?: "lines" | "words" | "chars";
  propIndex?: boolean;
  /** Skip kerning compensation (no margin adjustments applied).
   * Kerning is naturally lost when splitting into inline-block spans.
   * Use this if you prefer no compensation over imperfect Safari compensation. */
  disableKerning?: boolean;
}

/** Matches Motion's viewport prop */
interface ViewportOptions {
  /** Only trigger once. Default: false */
  once?: boolean;
  /** How much of the element must be visible. Motion supports "some" | "all" | number. Default: 0 */
  amount?: number | "some" | "all";
  /** How much visibility is required to consider the element out of view. Default: 0 (fully out) */
  leave?: number | "some" | "all";
  /** Root margin for IntersectionObserver. Default: "0px" */
  margin?: string;
  /** Root element for IntersectionObserver */
  root?: React.RefObject<Element>;
}

/**
 * Result passed to SplitText callbacks (onSplit, onViewportEnter, onViewportLeave, onResize).
 *
 * Contains arrays of split elements and a revert function for manual control.
 * Empty arrays are returned for split types not requested in options.
 */
export interface SplitTextElements {
  /** Array of character span elements */
  chars: HTMLSpanElement[];
  /** Array of word span elements */
  words: HTMLSpanElement[];
  /** Array of line span elements */
  lines: HTMLSpanElement[];
  /** Revert to original HTML and cleanup observers */
  revert: () => void;
}

/** Return type for callbacks - void, single animation, array of animations, or promise */
type CallbackReturn =
  | void
  | { finished: Promise<unknown> }
  | Array<{ finished: Promise<unknown> }>
  | Promise<unknown>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type ControlledWrapperHTMLKeys =
  | "children"
  | "className"
  | "style"
  | "ref"
  | "as"
  | "onSplit"
  | "onResize"
  | "options"
  | "autoSplit"
  | "revertOnComplete"
  | "viewport"
  | "onViewportEnter"
  | "onViewportLeave"
  | "initialStyles"
  | "initialClasses"
  | "resetOnViewportLeave"
  | "waitForFonts";

type WrapperHTMLProps = Omit<
  React.HTMLAttributes<HTMLElement>,
  ControlledWrapperHTMLKeys
>;

interface SplitTextProps extends WrapperHTMLProps {
  children: ReactElement;
  /** The wrapper element type. Default: "div" */
  as?: keyof HTMLElementTagNameMap;
  /** Class name for the wrapper element */
  className?: string;
  /** Additional styles for the wrapper element (merged with internal styles) */
  style?: React.CSSProperties;
  /**
   * Called after text is split.
   * Return an animation or promise to enable revert (requires revertOnComplete).
   */
  onSplit?: (result: SplitTextElements) => CallbackReturn;
  /** Called when autoSplit triggers a re-split on resize */
  onResize?: (result: SplitTextElements) => void;
  options?: SplitTextOptions;
  autoSplit?: boolean;
  /** When true, reverts to original HTML after animation promise resolves */
  revertOnComplete?: boolean;
  /** Viewport observer options (replaces `inView`). Configures IntersectionObserver. */
  viewport?: ViewportOptions;
  /** Called when element enters viewport (replaces `onInView`). Return animation for revertOnComplete support */
  onViewportEnter?: (result: SplitTextElements) => CallbackReturn;
  /** Called when element leaves viewport (replaces `onLeaveView`) */
  onViewportLeave?: (result: SplitTextElements) => CallbackReturn;
  /** Apply initial inline styles to elements after split (and after kerning compensation).
   * Can be a static style object or a function that receives (element, index). */
  initialStyles?: InitialStyles;
  /** Apply initial classes to elements after split (and after kerning compensation).
   * Classes are added via classList.add() and support space-separated class names. */
  initialClasses?: InitialClasses;
  /** Re-apply initialStyles/initialClasses when element leaves viewport.
   * Useful for scroll-triggered animations that should reset when scrolling away. */
  resetOnViewportLeave?: boolean;
  /** Wait for `document.fonts.ready` before splitting. Disable for immediate split. */
  waitForFonts?: boolean;
}

/**
 * React component wrapper for text splitting with kerning compensation.
 *
 * Wraps a single child element and splits its text content into characters,
 * words, and/or lines. Handles lifecycle cleanup automatically on unmount.
 *
 * Supports callback mode via `onSplit`, `onViewportEnter`, `onViewportLeave`.
 *
 * @param props - Component props including callbacks and options
 * @returns The child element wrapped in a container div
 *
 * @example
 * ```tsx
 * import { SplitText } from "fetta/react";
 * import { animate, stagger } from "motion";
 *
 * // Imperative animation
 * <SplitText
 *   onSplit={({ words }) => {
 *     animate(words, { opacity: [0, 1], y: [20, 0] }, { delay: stagger(0.05) });
 *   }}
 * >
 *   <h1>Animated Text</h1>
 * </SplitText>
 * ```
 */
export const SplitText = forwardRef<HTMLElement, SplitTextProps>(
  function SplitText(
    {
      children,
      as: Component = "div",
      className,
      style: userStyle,
      onSplit,
      onResize,
      options,
      autoSplit = false,
      revertOnComplete = false,
      viewport,
      onViewportEnter,
      onViewportLeave,
      initialStyles,
      initialClasses,
      resetOnViewportLeave = false,
      waitForFonts = true,
      ...wrapperProps
    },
    forwardedRef
  ) {
    const containerRef = useRef<HTMLElement>(null);

    // Merge internal ref with forwarded ref
    const mergedRef = useCallback(
      (node: HTMLElement | null) => {
        containerRef.current = node;
        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef]
    );

    const [childElement, setChildElement] = useState<HTMLElement | null>(null);
    const [isInView, setIsInView] = useState(false);

    // Detect whether viewport observer is needed
    const needsViewport = !!(
      onViewportEnter ||
      onViewportLeave ||
      resetOnViewportLeave ||
      viewport
    );

    // Stable refs for callbacks and options
    const onSplitRef = useRef(onSplit);
    const onResizeRef = useRef(onResize);
    const optionsRef = useRef(options);
    const revertOnCompleteRef = useRef(revertOnComplete);
    const viewportRef = useRef(viewport);
    const onViewportEnterRef = useRef(onViewportEnter);
    const onViewportLeaveRef = useRef(onViewportLeave);
    const initialStylesRef = useRef(initialStyles);
    const initialClassesRef = useRef(initialClasses);
    const resetOnViewportLeaveRef = useRef(resetOnViewportLeave);

    useLayoutEffect(() => {
      onSplitRef.current = onSplit;
      onResizeRef.current = onResize;
      optionsRef.current = options;
      revertOnCompleteRef.current = revertOnComplete;
      viewportRef.current = viewport;
      onViewportEnterRef.current = onViewportEnter;
      onViewportLeaveRef.current = onViewportLeave;
      initialStylesRef.current = initialStyles;
      initialClassesRef.current = initialClasses;
      resetOnViewportLeaveRef.current = resetOnViewportLeave;
    });

    // Refs for tracking state
    const hasSplitRef = useRef(false);
    const hasRevertedRef = useRef(false);
    const revertFnRef = useRef<(() => void) | null>(null);
    const splitResultRef = useRef<SplitTextElements | null>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);
    const hasTriggeredOnceRef = useRef(false);

    useLayoutEffect(() => {
      const element = containerRef.current?.firstElementChild;
      setChildElement(element instanceof HTMLElement ? element : null);
    }, [children]);

    // Initial split
    useEffect(() => {
      if (!childElement) return;
      if (hasSplitRef.current) return;

      let isMounted = true;

      waitForFontsReady(waitForFonts).then(() => {
        if (!isMounted || hasSplitRef.current) return;
        if (!containerRef.current) return;

        // Use core splitText with autoSplit feature
        const result = splitText(childElement, {
          ...optionsRef.current,
          autoSplit,
          revertOnComplete: revertOnCompleteRef.current,
          initialStyles: initialStylesRef.current,
          initialClasses: initialClassesRef.current,
          onResize: (resizeResult) => {
            // Update stored result with new elements but same revert
            const newSplitTextElements: SplitTextElements = {
              chars: resizeResult.chars,
              words: resizeResult.words,
              lines: resizeResult.lines,
              revert: result.revert,
            };
            splitResultRef.current = newSplitTextElements;
            onResizeRef.current?.(newSplitTextElements);
          },
        });

        // Store revert function for cleanup
        revertFnRef.current = result.revert;

        hasSplitRef.current = true;

        // Create result object with revert exposed
        const splitElements: SplitTextElements = {
          chars: result.chars,
          words: result.words,
          lines: result.lines,
          revert: result.revert,
        };
        splitResultRef.current = splitElements;

        // Reveal after split
        containerRef.current!.style.visibility = "visible";

        // Call onSplit if provided
        if (onSplitRef.current) {
          const callbackResult = onSplitRef.current(splitElements);

          // Handle revertOnComplete for onSplit (only when viewport is NOT enabled)
          if (!needsViewport && revertOnCompleteRef.current) {
            const promise = normalizeToPromise(callbackResult);
            if (promise) {
              promise
                .then(() => {
                  if (!isMounted || hasRevertedRef.current) return;
                  result.revert();
                  hasRevertedRef.current = true;
                })
                .catch(() => {
                  console.warn("[fetta] Animation rejected, text not reverted");
                });
            } else if (callbackResult === undefined) {
              // No warning if onSplit didn't return anything - user might be setting up state
            } else {
              console.warn(
                "SplitText: revertOnComplete is enabled but onSplit did not return an animation or promise."
              );
            }
          }
        }

        // Set up IntersectionObserver if viewport callbacks are present
        if (needsViewport && containerRef.current) {
          setupViewportObserver(containerRef.current);
        }
      });

      function setupViewportObserver(container: HTMLElement) {
        const vpOptions = viewportRef.current || {};
        const amount = vpOptions.amount ?? 0;
        const leave = vpOptions.leave ?? 0;
        const threshold =
          amount === "some" ? 0 : amount === "all" ? 1 : amount;
        const leaveThreshold =
          leave === "some" ? 0 : leave === "all" ? 1 : leave;
        const rootMargin = vpOptions.margin ?? "0px";
        const root = vpOptions.root?.current ?? undefined;

        // Use array with 0 + enter + leave to detect transitions at each threshold.
        const thresholdValues = Array.from(
          new Set([0, threshold, leaveThreshold])
        ).sort((a, b) => a - b);
        const thresholds =
          thresholdValues.length === 1 ? thresholdValues[0] : thresholdValues;

        observerRef.current = new IntersectionObserver(
          (entries) => {
            const entry = entries[0];
            if (!entry) return;

            const isOnce = vpOptions.once;

            // Enter: when element is intersecting AND ratio is at/above threshold
            if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
              if (isOnce && hasTriggeredOnceRef.current) return;
              hasTriggeredOnceRef.current = true;
              setIsInView(true);
              return;
            }

            if (isOnce) return;

            const shouldLeave =
              leaveThreshold === 0
                ? !entry.isIntersecting
                : entry.intersectionRatio <= leaveThreshold;

            if (shouldLeave) {
              setIsInView(false);
            }
          },
          { threshold: thresholds, rootMargin, root }
        );

        observerRef.current.observe(container);
      }

      return () => {
        isMounted = false;
        // Cleanup observer
        if (observerRef.current) {
          observerRef.current.disconnect();
          observerRef.current = null;
        }
        // Cleanup on unmount
        if (revertFnRef.current) {
          revertFnRef.current();
        }
        // Reset for StrictMode remount
        hasSplitRef.current = false;
      };
    }, [childElement, autoSplit, needsViewport, waitForFonts]);

    // Handle isInView changes
    useEffect(() => {
      if (!splitResultRef.current) return;
      if (hasRevertedRef.current) return;

      if (isInView && onViewportEnterRef.current) {
        const callbackResult = onViewportEnterRef.current(
          splitResultRef.current
        );
        const promise = normalizeToPromise(callbackResult);

        if (revertOnCompleteRef.current && promise) {
          promise
            .then(() => {
              if (hasRevertedRef.current) return;
              splitResultRef.current?.revert();
              hasRevertedRef.current = true;
            })
            .catch(() => {
              console.warn("[fetta] Animation rejected, text not reverted");
            });
        }
      } else if (!isInView && splitResultRef.current) {
        // Re-apply initial styles/classes when leaving viewport
        if (resetOnViewportLeaveRef.current) {
          const { chars, words, lines } = splitResultRef.current;
          const styles = initialStylesRef.current;
          const classes = initialClassesRef.current;

          if (styles) {
            reapplyInitialStyles(chars, styles.chars);
            reapplyInitialStyles(words, styles.words);
            reapplyInitialStyles(lines, styles.lines);
          }

          if (classes) {
            reapplyInitialClasses(chars, classes.chars);
            reapplyInitialClasses(words, classes.words);
            reapplyInitialClasses(lines, classes.lines);
          }
        }

        // Call onViewportLeave callback if provided
        if (onViewportLeaveRef.current) {
          onViewportLeaveRef.current(splitResultRef.current);
        }
      }
    }, [isInView]);

    if (!isValidElement(children)) {
      console.error("SplitText: children must be a single valid React element");
      return null;
    }

    const Wrapper = Component;
    return createElement(
      Wrapper,
      {
        ref: mergedRef,
        ...wrapperProps,
        className,
        style: {
          visibility: waitForFonts ? "hidden" : "visible",
          position: "relative",
          ...userStyle,
        },
      },
      children
    );
  }
);
