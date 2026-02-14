type ViewportAmount = number | "some" | "all";

interface RootRefLike {
  current: Element | null;
}

export interface ViewportObserverOptions {
  once?: boolean;
  amount?: ViewportAmount;
  leave?: ViewportAmount;
  margin?: string;
  root?: RootRefLike;
}

export function createViewportObserver(
  options: ViewportObserverOptions | undefined,
  hasTriggeredOnceRef: { current: boolean },
  onEnter: () => void,
  onLeave: () => void
): IntersectionObserver {
  const vpOptions = options ?? {};
  const threshold =
    vpOptions.amount === "some"
      ? 0
      : vpOptions.amount === "all"
      ? 1
      : vpOptions.amount ?? 0;
  const leaveThreshold =
    vpOptions.leave === "some"
      ? 0
      : vpOptions.leave === "all"
      ? 1
      : vpOptions.leave ?? 0;
  const rootMargin = vpOptions.margin ?? "0px";
  const root = vpOptions.root?.current ?? undefined;
  const isOnce = vpOptions.once === true;

  const thresholdValues = Array.from(new Set([0, threshold, leaveThreshold])).sort(
    (a, b) => a - b
  );
  const thresholds =
    thresholdValues.length === 1 ? thresholdValues[0] : thresholdValues;

  return new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (!entry) return;

      if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
        if (isOnce && hasTriggeredOnceRef.current) return;
        hasTriggeredOnceRef.current = true;
        onEnter();
        return;
      }

      if (isOnce) return;

      const shouldLeave =
        leaveThreshold === 0
          ? !entry.isIntersecting
          : entry.intersectionRatio <= leaveThreshold;

      if (shouldLeave) onLeave();
    },
    { threshold: thresholds, rootMargin, root }
  );
}
