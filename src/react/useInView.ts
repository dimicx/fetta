/**
 * useInView hook for viewport detection
 *
 * Based on Motion's useInView hook (MIT license).
 * @see https://github.com/motiondivision/motion/blob/main/packages/framer-motion/src/utils/use-in-view.ts
 */

import { RefObject, useEffect, useState } from "react";

export interface UseInViewOptions {
  /** Root element for intersection (defaults to viewport) */
  root?: RefObject<Element | null>;
  /** Root margin for IntersectionObserver (e.g., "-50px", "10% 20%") */
  margin?: string;
  /** How much of the element must be visible: 0-1 number, "some" (0), or "all" (1) */
  amount?: number | "some" | "all";
  /** Only trigger once - stays true after first intersection */
  once?: boolean;
  /** Initial value before IntersectionObserver connects */
  initial?: boolean;
}

/**
 * React hook that tracks whether an element is in the viewport.
 *
 * @param ref - RefObject pointing to the element to observe
 * @param options - Configuration options for viewport detection
 * @returns boolean indicating whether the element is currently in view
 *
 * @example
 * ```tsx
 * function Component() {
 *   const ref = useRef<HTMLDivElement>(null);
 *   const isInView = useInView(ref, { once: true, amount: 0.5 });
 *
 *   return (
 *     <div ref={ref} style={{ opacity: isInView ? 1 : 0 }}>
 *       Fades in when visible
 *     </div>
 *   );
 * }
 * ```
 */
export function useInView(
  ref: RefObject<Element | null>,
  {
    root,
    margin,
    amount = "some",
    once = false,
    initial = false,
  }: UseInViewOptions = {}
): boolean {
  const [isInView, setInView] = useState(initial);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // If once is true and already in view, skip setting up observer
    if (once && isInView) return;

    // Convert amount to threshold
    const threshold =
      typeof amount === "number" ? amount : amount === "all" ? 1 : 0;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        if (entry.isIntersecting) {
          setInView(true);
          if (once) {
            observer.disconnect();
          }
        } else if (!once) {
          setInView(false);
        }
      },
      {
        root: root?.current ?? undefined,
        rootMargin: margin,
        threshold,
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [ref, root, margin, amount, once, isInView]);

  return isInView;
}
