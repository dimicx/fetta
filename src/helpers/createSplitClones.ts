import type { SplitTextResult } from "../index";

export type SplitUnit = "chars" | "words" | "lines";

export type StyleInput =
  | Partial<CSSStyleDeclaration>
  | ((ctx: {
      index: number;
      unit: SplitUnit;
      original: HTMLSpanElement;
    }) => Partial<CSSStyleDeclaration>);

export type ClassInput =
  | string
  | ((ctx: {
      index: number;
      unit: SplitUnit;
      original: HTMLSpanElement;
    }) => string | undefined);

export interface CreateSplitClonesOptions {
  unit: SplitUnit;
  wrap?: boolean;
  display?: "auto" | "inline-block" | "block";
  cloneOffset?: {
    axis?: "x" | "y";
    direction?: "start" | "end";
    distance?: string;
  };
  trackClassName?: ClassInput;
  cloneClassName?: ClassInput;
  trackStyle?: StyleInput;
  cloneStyle?: StyleInput;
}

export interface SplitCloneItem {
  index: number;
  original: HTMLSpanElement;
  clone: HTMLSpanElement;
  track: HTMLSpanElement | null;
}

export interface CreateSplitClonesResult {
  unit: SplitUnit;
  originals: HTMLSpanElement[];
  clones: HTMLSpanElement[];
  tracks: HTMLSpanElement[];
  items: SplitCloneItem[];
  cleanup: (options?: { revertSplit?: boolean }) => void;
}

function resolveDisplay(
  display: CreateSplitClonesOptions["display"],
  unit: SplitUnit
): "inline-block" | "block" {
  if (display && display !== "auto") return display;
  return unit === "lines" ? "block" : "inline-block";
}

function applyClass(
  element: HTMLElement,
  classInput: ClassInput | undefined,
  ctx: { index: number; unit: SplitUnit; original: HTMLSpanElement }
) {
  if (!classInput) return;
  const className =
    typeof classInput === "function" ? classInput(ctx) : classInput;
  if (!className) return;
  const classes = className.split(/\s+/).filter(Boolean);
  if (classes.length > 0) {
    element.classList.add(...classes);
  }
}

function applyStyle(
  element: HTMLElement,
  styleInput: StyleInput | undefined,
  ctx: { index: number; unit: SplitUnit; original: HTMLSpanElement }
) {
  if (!styleInput) return;
  const styles =
    typeof styleInput === "function" ? styleInput(ctx) : styleInput;

  for (const [key, value] of Object.entries(styles)) {
    if (value !== undefined && value !== null) {
      (element.style as unknown as Record<string, unknown>)[key] = value;
    }
  }
}

function normalizeOffset(
  direction: "start" | "end",
  distance: string
): string {
  const trimmed = distance.trim();
  if (direction === "start") {
    return trimmed.startsWith("-") ? trimmed : `-${trimmed}`;
  }
  return trimmed.startsWith("-") ? trimmed.slice(1) : trimmed;
}

function applyCloneOffset(
  clone: HTMLElement,
  cloneOffset: CreateSplitClonesOptions["cloneOffset"]
) {
  const axis = cloneOffset?.axis ?? "y";
  const direction = cloneOffset?.direction ?? "start";
  const distance = cloneOffset?.distance ?? "100%";
  const offset = normalizeOffset(direction, distance);

  clone.style.position = "absolute";

  if (axis === "y") {
    clone.style.left = "0";
    clone.style.top = offset;
  } else {
    clone.style.top = "0";
    clone.style.left = offset;
  }
}

function resolveOriginals(
  split: SplitTextResult,
  unit: SplitUnit
): HTMLSpanElement[] {
  if (unit === "chars") return split.chars;
  if (unit === "words") return split.words;
  if (unit === "lines") return split.lines;
  throw new Error(`createSplitClones: unsupported unit "${unit}"`);
}

export function createSplitClones(
  split: SplitTextResult,
  options: CreateSplitClonesOptions
): CreateSplitClonesResult {
  const unit = options.unit;
  const wrap = options.wrap ?? false;
  const originals = resolveOriginals(split, unit);
  const clones: HTMLSpanElement[] = [];
  const tracks: HTMLSpanElement[] = [];
  const items: SplitCloneItem[] = [];
  let didCleanup = false;

  originals.forEach((original, index) => {
    const parent = original.parentElement;
    if (!parent) return;

    const ctx = { index, unit, original };

    let track: HTMLSpanElement | null = null;
    if (wrap) {
      track = document.createElement("span");
      track.style.position = "relative";
      track.style.display = resolveDisplay(options.display, unit);
      applyClass(track, options.trackClassName, ctx);
      applyStyle(track, options.trackStyle, ctx);
      parent.insertBefore(track, original);
      track.appendChild(original);
      tracks.push(track);
    }

    const clone = original.cloneNode(true) as HTMLSpanElement;
    applyCloneOffset(clone, options.cloneOffset);
    applyClass(clone, options.cloneClassName, ctx);
    applyStyle(clone, options.cloneStyle, ctx);

    const host = original.parentElement;
    if (!host) return;
    host.appendChild(clone);

    clones.push(clone);
    items.push({
      index,
      original,
      clone,
      track,
    });
  });

  const cleanup = (cleanupOptions?: { revertSplit?: boolean }) => {
    if (didCleanup) return;
    didCleanup = true;

    for (const item of items) {
      item.clone.remove();
    }

    for (const item of items) {
      if (!item.track) continue;
      const trackParent = item.track.parentNode;
      if (trackParent) {
        trackParent.insertBefore(item.original, item.track);
      }
      item.track.remove();
    }

    if (cleanupOptions?.revertSplit) {
      split.revert();
    }
  };

  return {
    unit,
    originals,
    clones,
    tracks,
    items,
    cleanup,
  };
}
