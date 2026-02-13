const TARGET_COUPLING_EPSILON_PX = 0.5;
const WIDTH_CHANGE_EPSILON_PX = 0.05;

function getRenderableWidth(element: HTMLElement): number {
  const width = element.getBoundingClientRect().width;
  return Number.isFinite(width) ? width : 0;
}

function getSplitElementParent(element: HTMLElement): HTMLElement | null {
  let target = element.parentElement;
  if (!target) return null;

  if (
    target.dataset.fettaAutoSplitWrapper === "true" &&
    target.parentElement instanceof HTMLElement
  ) {
    target = target.parentElement;
  }

  return target;
}

/**
 * Resolve resize observation targets for autoSplit.
 * Always includes the effective immediate parent and may include one promoted
 * ancestor when parent width appears tightly coupled to the split element.
 */
export function resolveAutoSplitTargets(splitElement: HTMLElement): HTMLElement[] {
  const baseTarget = getSplitElementParent(splitElement);
  if (!baseTarget) return [];

  const targets: HTMLElement[] = [baseTarget];

  if (baseTarget.parentElement instanceof HTMLElement) {
    const targetWidth = getRenderableWidth(baseTarget);
    const elementWidth = getRenderableWidth(splitElement);
    if (Math.abs(targetWidth - elementWidth) < TARGET_COUPLING_EPSILON_PX) {
      targets.push(baseTarget.parentElement);
    }
  }

  return Array.from(new Set(targets));
}

/**
 * Read width from ResizeObserver entry when available, otherwise from target.
 */
export function getObservedWidth(
  entry?: Pick<ResizeObserverEntry, "contentRect"> | null,
  target?: HTMLElement | null
): number | null {
  const entryWidth = entry?.contentRect?.width;
  if (typeof entryWidth === "number" && Number.isFinite(entryWidth)) {
    return entryWidth;
  }

  if (!target) return null;
  const targetWidth = getRenderableWidth(target);
  return Number.isFinite(targetWidth) ? targetWidth : null;
}

/**
 * Update per-target width state and report meaningful changes.
 * The first measurement per target seeds state and does not trigger resize work.
 */
export function recordWidthChange(
  widthByTarget: Map<HTMLElement, number>,
  target: HTMLElement,
  nextWidth: number,
  epsilon = WIDTH_CHANGE_EPSILON_PX
): boolean {
  const previousWidth = widthByTarget.get(target);
  widthByTarget.set(target, nextWidth);
  if (previousWidth === undefined) return false;
  return Math.abs(previousWidth - nextWidth) > epsilon;
}

/**
 * Resolve the most relevant width for a re-split pass.
 * Prefer the last target that reported a meaningful resize when available.
 */
export function resolveAutoSplitWidth(
  targets: HTMLElement[],
  widthByTarget: Map<HTMLElement, number>,
  changedTarget?: HTMLElement | null
): number {
  const orderedTargets: HTMLElement[] = [];
  if (changedTarget && targets.includes(changedTarget)) {
    orderedTargets.push(changedTarget);
  }
  for (const target of targets) {
    if (!orderedTargets.includes(target)) {
      orderedTargets.push(target);
    }
  }

  for (const target of orderedTargets) {
    const measuredWidth = widthByTarget.get(target);
    if (typeof measuredWidth === "number" && Number.isFinite(measuredWidth)) {
      return measuredWidth;
    }
    const fallbackWidth = target.offsetWidth;
    if (Number.isFinite(fallbackWidth)) {
      return fallbackWidth;
    }
  }

  return 0;
}
