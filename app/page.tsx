"use client";

import { animate, stagger } from "motion";
import { SplitText } from "./components/SplitText";
import { SplitText as CustomSplitText } from "./split-text";
import { Example } from "./example";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-24 bg-zinc-950 px-8 py-24 font-sans">
      {/* <Example /> */}
      {/* Custom SplitText: Test with em-dash */}
      <section className="flex w-full max-w-2xl flex-col gap-4">
        <span className="text-xs font-medium uppercase tracking-widest text-emerald-500">
          ✨ Custom SplitText (Em-dash test)
        </span>
        <CustomSplitText
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
          <p className="text-lg leading-loose text-zinc-400">
            Create beautiful animations with just a few lines of code. Motion
            handles the complexity so you can focus on what matters
            most—building great user experiences that delight and engage.
          </p>
        </CustomSplitText>
        {/* <p className="text-lg leading-loose text-zinc-600">
          Create beautiful animations with just a few lines of code. Motion
          handles the complexity so you can focus on what matters most—building
          great user experiences that delight and engage.
        </p> */}
      </section>
      {/* Example 1: Staggered words with spring */}
      <section className="flex w-full max-w-2xl flex-col gap-4">
        <span className="text-xs font-medium uppercase tracking-widest text-zinc-500">
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
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-white md:text-5xl">
            Level up your animations with the all-in membership
          </h1>
        </SplitText>
      </section>

      {/* Example 2: Character reveal with rotation */}
      <section className="flex w-full max-w-2xl flex-col gap-4">
        <span className="text-xs font-medium uppercase tracking-widest text-zinc-500">
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
          <p className="text-2xl font-medium leading-relaxed text-zinc-300">
            Motion makes animation simple.
          </p>
        </SplitText>
      </section>

      {/* Example 3: Lines with fade, autoSplit */}
      <section className="flex w-full max-w-2xl flex-col gap-4">
        <span className="text-xs font-medium uppercase tracking-widest text-zinc-500">
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
          <p className="text-lg leading-loose text-zinc-400">
            Create beautiful animations with just a few lines of code. Motion
            handles the complexity so you can focus on what matters
            most—building great user experiences that delight and engage.
          </p>
        </SplitText>
        {/* <p className="text-lg leading-loose text-zinc-400">
          Create beautiful animations with just a few lines of code. Motion
          handles the complexity so you can focus on what matters most—building
          great user experiences that delight and engage.
        </p> */}
      </section>

      {/* Example 4: Revert after animation completes */}
      <section className="flex w-full max-w-2xl flex-col gap-4">
        <span className="text-xs font-medium uppercase tracking-widest text-zinc-500">
          Revert After Complete
        </span>
        <SplitText
          revertOnComplete
          onSplit={({ words }) => {
            // Return the animation promise - text reverts when it resolves
            return animate(
              words,
              {
                opacity: [0, 1],
                y: [15, 0],
                filter: ["blur(8px)", "blur(0px)"],
              },
              { duration: 0.6, delay: stagger(0.04) }
            ).finished;
          }}
        >
          <p className="text-lg leading-loose text-zinc-400">
            Create beautiful animations with just a few lines of code. Motion
            handles the complexity so you can focus on what matters
            most—building great user experiences that delight and engage.
          </p>
        </SplitText>
      </section>

      {/* Example 5: Mixed animation with blur */}
      <section className="flex w-full max-w-2xl flex-col gap-4">
        <span className="text-xs font-medium uppercase tracking-widest text-zinc-500">
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
          <h2 className="text-3xl font-semibold leading-snug text-white">
            Smooth, performant animations powered by Motion
          </h2>
        </SplitText>
      </section>
    </div>
  );
}
