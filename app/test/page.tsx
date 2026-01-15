"use client";

import { animate, stagger } from "motion";
import { SplitText } from "../split-text";

export default function TestPage() {
  return (
    <div className="min-h-screen bg-zinc-950 px-8 py-24 font-sans">
      <div className="mx-auto max-w-4xl space-y-16">
        <h1 className="text-4xl font-bold text-white">
          SplitText Robustness Tests
        </h1>

        {/* Test 1: Emoji handling */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-emerald-400">
            1. Emoji & Grapheme Clusters
          </h2>
          <p className="text-sm text-zinc-500">
            Tests Intl.Segmenter - should handle multi-codepoint emojis correctly
          </p>
          <SplitText
            onSplit={({ chars }) => {
              animate(
                chars,
                { opacity: [0, 1], y: [10, 0] },
                { delay: stagger(0.05) }
              );
            }}
          >
            <p className="text-2xl text-zinc-300">
              Hello 👨‍👩‍👦 World 🎉✨ Testing emojis! 🚀
            </p>
          </SplitText>
        </section>

        {/* Test 2: Em-dash wrapping */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-emerald-400">
            2. Em-dash Wrapping
          </h2>
          <p className="text-sm text-zinc-500">
            Should wrap naturally after em-dashes
          </p>
          <div className="max-w-md">
            <SplitText
              autoSplit
              onSplit={({ lines }) => {
                animate(
                  lines,
                  { opacity: [0, 1], x: [-30, 0] },
                  { delay: stagger(0.1) }
                );
              }}
            >
              <p className="text-lg leading-relaxed text-zinc-300">
                This is a test—and it should work—with proper wrapping at
                various widths.
              </p>
            </SplitText>
          </div>
        </section>

        {/* Test 3: Different font sizes (line tolerance) */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-emerald-400">
            3. Dynamic Line Detection
          </h2>
          <p className="text-sm text-zinc-500">
            Tests dynamic tolerance based on font size
          </p>
          <SplitText
            onSplit={({ lines }) => {
              animate(
                lines,
                { opacity: [0, 1], y: [20, 0] },
                { delay: stagger(0.15) }
              );
            }}
          >
            <p className="text-6xl font-bold leading-tight text-zinc-200">
              Large Text Should Wrap Correctly
            </p>
          </SplitText>
        </section>

        {/* Test 4: CSS Custom Properties */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-emerald-400">
            4. CSS Custom Properties (propIndex)
          </h2>
          <p className="text-sm text-zinc-500">
            Each char should have --char-index CSS variable
          </p>
          <SplitText
            options={{ propIndex: true }}
            onSplit={({ chars }) => {
              // Animate using CSS variables
              chars.forEach((char) => {
                const index = parseInt(
                  char.style.getPropertyValue("--char-index") || "0"
                );
                char.style.transitionDelay = `${index * 0.03}s`;
              });
              animate(
                chars,
                { opacity: [0, 1], scale: [0.5, 1] },
                { duration: 0.5 }
              );
            }}
          >
            <p className="text-2xl text-zinc-300">Custom Properties Test</p>
          </SplitText>
        </section>

        {/* Test 5: will-change optimization */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-emerald-400">
            5. Performance Hints (will-change)
          </h2>
          <p className="text-sm text-zinc-500">
            Elements should have will-change: transform, opacity
          </p>
          <SplitText
            options={{ willChange: true }}
            onSplit={({ words }) => {
              animate(
                words,
                { opacity: [0, 1], rotate: [-5, 0] },
                { delay: stagger(0.04) }
              );
            }}
          >
            <p className="text-xl text-zinc-300">
              Optimized for smooth animations
            </p>
          </SplitText>
        </section>

        {/* Test 6: prefers-reduced-motion */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-emerald-400">
            6. Accessibility (prefers-reduced-motion)
          </h2>
          <p className="text-sm text-zinc-500">
            Check browser DevTools: System Preferences → Reduce Motion
          </p>
          <SplitText
            onSplit={({ words, prefersReducedMotion }) => {
              if (prefersReducedMotion) {
                // Instant, no animation
                words.forEach((w) => (w.style.opacity = "1"));
              } else {
                // Smooth animation
                animate(
                  words,
                  { opacity: [0, 1] },
                  { delay: stagger(0.05) }
                );
              }
            }}
          >
            <p className="text-xl text-zinc-300">
              Respects user motion preferences
            </p>
          </SplitText>
        </section>

        {/* Test 7: Empty edge case */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-emerald-400">
            7. Edge Cases
          </h2>
          <p className="text-sm text-zinc-500">
            Single character, very long word, etc.
          </p>
          <div className="space-y-2">
            <SplitText
              onSplit={({ chars }) => {
                animate(chars, { opacity: [0, 1] });
              }}
            >
              <p className="text-lg text-zinc-300">A</p>
            </SplitText>
            <SplitText
              onSplit={({ chars }) => {
                animate(
                  chars,
                  { opacity: [0, 1] },
                  { delay: stagger(0.01) }
                );
              }}
            >
              <p className="text-lg text-zinc-300">
                Supercalifragilisticexpialidocious
              </p>
            </SplitText>
          </div>
        </section>

        {/* Test 8: AutoSplit with onResize */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-emerald-400">
            8. AutoSplit with onResize Callback
          </h2>
          <p className="text-sm text-zinc-500">
            Resize window to trigger re-split with callback
          </p>
          <div className="max-w-lg">
            <SplitText
              autoSplit
              onSplit={({ lines }) => {
                console.log("Initial split:", lines.length, "lines");
                animate(
                  lines,
                  { opacity: [0, 1] },
                  { delay: stagger(0.1) }
                );
              }}
              onResize={({ lines }) => {
                console.log("Re-split:", lines.length, "lines");
              }}
            >
              <p className="text-lg leading-relaxed text-zinc-300">
                This text will re-split when you resize the browser window.
                Watch the console to see the onResize callback fire. The
                debounce is now 200ms for better stability.
              </p>
            </SplitText>
          </div>
        </section>

        <div className="border-t border-zinc-800 pt-8">
          <p className="text-center text-sm text-zinc-500">
            Open browser DevTools Console to see warnings and logs
          </p>
        </div>
      </div>
    </div>
  );
}
