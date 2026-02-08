type CSSVariableStyles = {
  [K in `--${string}`]?: string | number;
};

/** Style value for initialStyles - CSS properties with numeric + CSS variable support */
export type InitialStyleValue = Partial<
  Record<keyof CSSStyleDeclaration, string | number>
> &
  CSSVariableStyles;

/** Function that returns styles based on element and index */
export type InitialStyleFn = (element: HTMLElement, index: number) => InitialStyleValue;

/** Initial style can be a static object or a function */
export type InitialStyle = InitialStyleValue | InitialStyleFn;

/** Initial styles configuration for chars, words, and/or lines */
export interface InitialStyles {
  chars?: InitialStyle;
  words?: InitialStyle;
  lines?: InitialStyle;
}

/** Initial classes configuration for chars, words, and/or lines */
export interface InitialClasses {
  chars?: string;
  words?: string;
  lines?: string;
}

/**
 * Re-apply initial styles to elements.
 */
export function reapplyInitialStyles(
  elements: HTMLElement[],
  style: InitialStyle | undefined
): void {
  if (!style || elements.length === 0) return;

  const isFn = typeof style === "function";

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const styles = isFn ? style(el, i) : style;

    for (const [key, value] of Object.entries(styles)) {
      if (value == null) continue;
      if (key === "cssText") {
        if (typeof value === "string") {
          el.style.cssText = value;
        }
        continue;
      }
      if (typeof value !== "string" && typeof value !== "number") continue;
      const cssValue = typeof value === "number" ? String(value) : value;
      const cssKey = key.startsWith("--")
        ? key
        : key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      el.style.setProperty(cssKey, cssValue);
    }
  }
}

/**
 * Re-apply initial classes to elements.
 */
export function reapplyInitialClasses(
  elements: HTMLElement[],
  className: string | undefined
): void {
  if (!className || elements.length === 0) return;
  const classes = className.split(/\s+/).filter(Boolean);
  for (const el of elements) {
    el.classList.add(...classes);
  }
}
