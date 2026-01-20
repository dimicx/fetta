"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { motion, useInView } from "motion/react";

function ReplayIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="lucide lucide-rotate-ccw-icon lucide-rotate-ccw h-full w-auto"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

export function ExampleWrapper({ children }: { children: ReactNode }) {
  const [key, setKey] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { amount: 0.6, once: true });

  return (
    <div ref={ref} className="relative w-full h-[240px] lg:h-[300px]">
      <div className="empty:hidden absolute top-3 right-2 z-2">
        <button
          type="button"
          onClick={() => setKey((k) => k + 1)}
          className="inline-flex items-center justify-center rounded-md text-fd-muted-foreground text-sm font-medium transition-all duration-100 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring p-1 [&_svg]:size-4 hover:text-fd-accent-foreground active:scale-95 ease-out will-change-transform cursor-pointer"
          aria-label="Replay animation"
        >
          <ReplayIcon />
        </button>
      </div>
      <div key={key} className="w-full h-full flex items-center justify-center">
        {isInView && children}
      </div>
    </div>
  );
}

function DragHandle() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="lucide lucide-grip-vertical-icon lucide-grip-vertical h-full w-auto"
      aria-hidden="true"
    >
      <circle cx="9" cy="12" r="1" />
      <circle cx="9" cy="5" r="1" />
      <circle cx="9" cy="19" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="15" cy="5" r="1" />
      <circle cx="15" cy="19" r="1" />
    </svg>
  );
}

export function ResizableExampleWrapper({ children }: { children: ReactNode }) {
  const [key, setKey] = useState(0);
  const [width, setWidth] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(wrapperRef, { amount: 0.6, once: true });

  // Set correct initial width after hydration on mobile
  useEffect(() => {
    if (window.innerWidth < 768) {
      setWidth(75);
    }
  }, []);

  // Larger minimum width on mobile to prevent text from shrinking too much
  const getMinWidth = () => (window.innerWidth < 768 ? 40 : 30);

  return (
    <div ref={wrapperRef} className="relative w-full h-[240px] lg:h-[300px]">
      <div className="empty:hidden absolute top-3 right-2 z-2 backdrop-blur-lg rounded-lg text-fd-muted-foreground">
        <button
          type="button"
          onClick={() => setKey((k) => k + 1)}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors duration-100 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring p-1 [&_svg]:size-4 hover:text-fd-accent-foreground"
          aria-label="Replay animation"
        >
          <ReplayIcon />
        </button>
      </div>
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-start"
      >
        <div
          className="relative h-full flex items-center border-r border-dashed border-fd-border"
          style={{ width: `${width}%` }}
        >
          <div
            key={key}
            className={`w-full h-full flex items-center justify-center px-4 ${isDragging ? "select-none" : ""}`}
          >
            {isInView && children}
          </div>
          <motion.div
            drag="x"
            dragMomentum={false}
            dragElastic={0}
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={() => setIsDragging(false)}
            onDrag={(_, info) => {
              if (!containerRef.current) return;
              const containerWidth = containerRef.current.offsetWidth;
              const deltaPercent = (info.delta.x / containerWidth) * 100;
              setWidth((w) =>
                Math.max(getMinWidth(), Math.min(100, w + deltaPercent)),
              );
            }}
            className="absolute right-0 top-1/2 h-7 translate-x-1/2 -translate-y-1/2 z-10 cursor-ew-resize py-1 rounded bg-fd-secondary text-fd-muted-foreground hover:text-fd-accent-foreground hover:bg-fd-accent transition-colors"
            aria-label="Drag to resize"
          >
            <DragHandle />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
