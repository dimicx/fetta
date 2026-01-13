"use client";

import { splitText } from "motion-plus";
import {
  cloneElement,
  isValidElement,
  ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

interface SplitTextOptions {
  charClass?: string;
  wordClass?: string;
  lineClass?: string;
  splitBy?: string;
}

interface SplitResult {
  chars: Element[];
  words: Element[];
  lines: Element[];
}

interface SplitTextProps {
  children: ReactElement;
  onSplit: (result: SplitResult) => void;
  options?: SplitTextOptions;
}

export function SplitText({ children, onSplit, options }: SplitTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [childElement, setChildElement] = useState<HTMLElement | null>(null);

  const childRefCallback = useCallback((node: HTMLElement | null) => {
    setChildElement(node);
  }, []);

  useEffect(() => {
    if (!childElement) return;

    document.fonts.ready.then(() => {
      if (!childElement || !containerRef.current) return;

      const result = splitText(childElement, options);

      // Reveal the container after splitting
      containerRef.current.style.visibility = "visible";

      // Invoke the callback with split elements
      onSplit(result);
    });
  }, [childElement, onSplit, options]);

  if (!isValidElement(children)) {
    console.error("SplitText: children must be a single valid React element");
    return null;
  }

  // Clone the child and attach our callback ref
  const clonedChild = cloneElement(children, {
    ref: childRefCallback,
  } as Record<string, unknown>);

  return (
    <div ref={containerRef} style={{ visibility: "hidden" }}>
      {clonedChild}
    </div>
  );
}
