"use client";

import { animate, stagger } from "motion";
import { SplitText } from "fetta/react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-24 bg-fd-background px-8 py-24 font-sans">
      {/* Example 1: Em-dash test with line animation */}
      <section className="flex w-full max-w-2xl flex-col gap-4">
        <span className="text-xs font-medium uppercase tracking-widest text-emerald-500">
          Line Animation (Em-dash test)
        </span>
        <SplitText
          autoSplit
          onSplit={({ lines }) => {
            animate(
              lines,
              { opacity: [0, 1], x: [-30, 0] },
              {
                type: "spring",
                duration: 1.2,
                bounce: 0.2,
                delay: stagger(0.15),
              }
            );
          }}
        >
          <p className="text-lg leading-loose text-fd-muted-foreground">
            Create beautiful animations with just a few lines of code. Motion
            handles the complexity so you can focus on what matters
            most—building great user experiences that delight and engage.
          </p>
        </SplitText>
      </section>

      {/* Example 2: Staggered words with spring */}
      <section className="flex w-full max-w-2xl flex-col gap-4">
        <span className="text-xs font-medium uppercase tracking-widest text-fd-muted-foreground">
          Staggered Words
        </span>
        <SplitText
          onSplit={({ words }) => {
            animate(
              words,
              { opacity: [0, 1], y: [20, 0] },
              {
                type: "spring",
                duration: 1.5,
                bounce: 0.3,
                delay: stagger(0.05),
              }
            );
          }}
        >
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-fd-foreground md:text-5xl">
            Level up your animations with the all-in membership
          </h1>
        </SplitText>
      </section>

      {/* Example 3: Character reveal with rotation */}
      <section className="flex w-full max-w-2xl flex-col gap-4">
        <span className="text-xs font-medium uppercase tracking-widest text-fd-muted-foreground">
          Character Reveal
        </span>
        <SplitText
          onSplit={({ chars }) => {
            animate(
              chars,
              { opacity: [0, 1], y: [30, 0], rotate: [-10, 0] },
              {
                type: "spring",
                duration: 0.8,
                bounce: 0.4,
                delay: stagger(0.02),
              }
            );
          }}
        >
          <p className="text-2xl font-medium leading-relaxed text-fd-foreground/80">
            Motion makes animation simple.
          </p>
        </SplitText>
      </section>

      {/* Example 4: Lines with fade, autoSplit */}
      <section className="flex w-full max-w-2xl flex-col gap-4">
        <span className="text-xs font-medium uppercase tracking-widest text-fd-muted-foreground">
          Line by Line (autoSplit)
        </span>
        <SplitText
          autoSplit
          onSplit={({ lines }) => {
            animate(
              lines,
              { opacity: [0, 1], x: [-30, 0] },
              {
                type: "spring",
                duration: 1.2,
                bounce: 0.2,
                delay: stagger(0.15),
              }
            );
          }}
        >
          <p className="text-lg leading-loose text-fd-muted-foreground">
            Create beautiful animations with just a few lines of code. Motion
            handles the complexity so you can focus on what matters
            most—building great user experiences that delight and engage.
          </p>
        </SplitText>
      </section>

      {/* Example 5: Revert after animation completes */}
      <section className="flex w-full max-w-2xl flex-col gap-4">
        <span className="text-xs font-medium uppercase tracking-widest text-fd-muted-foreground">
          Revert After Complete
        </span>
        <SplitText
          revertOnComplete
          onSplit={({ words }) => {
            return animate(
              words,
              {
                opacity: [0, 1],
                y: [15, 0],
                filter: ["blur(8px)", "blur(0px)"],
              },
              { duration: 0.6, delay: stagger(0.04) }
            );
          }}
        >
          <p className="text-lg leading-loose text-fd-muted-foreground">
            Create beautiful animations with just a few lines of code. Motion
            handles the complexity so you can focus on what matters
            most—building great user experiences that delight and engage.
          </p>
        </SplitText>
      </section>

      {/* Example 6: Words with blur */}
      <section className="flex w-full max-w-2xl flex-col gap-4">
        <span className="text-xs font-medium uppercase tracking-widest text-fd-muted-foreground">
          Words with Blur
        </span>
        <SplitText
          onSplit={({ words }) => {
            animate(
              words,
              {
                opacity: [0, 1],
                y: [15, 0],
                filter: ["blur(8px)", "blur(0px)"],
              },
              { duration: 0.6, delay: stagger(0.04) }
            );
          }}
        >
          <h2 className="text-3xl font-semibold leading-snug text-fd-foreground">
            Smooth, performant animations powered by Motion
          </h2>
        </SplitText>
      </section>
    </div>
  );
}
