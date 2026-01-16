"use client";

import { useRef } from "react";
import { animate, stagger, scroll } from "motion";
import { SplitText } from "splext/react";

export default function TestPage() {
  const scrollTarget17 = useRef<HTMLDivElement>(null);
  const scrollTarget18 = useRef<HTMLDivElement>(null);
  const scrollTarget19 = useRef<HTMLDivElement>(null);

  return (
    <div className="min-h-screen bg-zinc-950 px-8 py-24 font-sans relative">
      <div className="mx-auto max-w-4xl space-y-16 relative">
        <h1 className="text-4xl font-bold text-white">
          SplitText Robustness Tests
        </h1>

        {/* Test 1: Emoji handling */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-emerald-400">
            1. Emoji & Grapheme Clusters
          </h2>
          <p className="text-sm text-zinc-500">
            Tests Intl.Segmenter - should handle multi-codepoint emojis
            correctly
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
            onSplit={({ words }) => {
              const prefersReducedMotion = window.matchMedia(
                "(prefers-reduced-motion: reduce)"
              ).matches;
              if (prefersReducedMotion) {
                // Instant, no animation
                words.forEach((w) => (w.style.opacity = "1"));
              } else {
                // Smooth animation
                animate(words, { opacity: [0, 1] }, { delay: stagger(0.05) });
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
                animate(chars, { opacity: [0, 1] }, { delay: stagger(0.01) });
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
                animate(lines, { opacity: [0, 1] }, { delay: stagger(0.1) });
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

        {/* Test 9: Type Option - Selective Splitting */}
        <section className="space-y-8">
          <div>
            <h2 className="text-2xl font-semibold text-emerald-400">
              9. Type Option - Selective Splitting (NEW!)
            </h2>
            <p className="text-sm text-zinc-500">
              Split by chars, words, or lines - or any combination
            </p>
          </div>

          {/* Default: All types */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-zinc-400">
              Default: chars + words + lines
            </h3>
            <p className="text-xs text-zinc-600">
              Full splitting with char-level animation
            </p>
            <SplitText
              onSplit={({ chars }) => {
                animate(
                  chars,
                  { opacity: [0, 1], y: [10, 0] },
                  { delay: stagger(0.02) }
                );
              }}
            >
              <p
                className="text-3xl text-zinc-200"
                style={{ fontFamily: "Georgia, serif" }}
              >
                Beautiful typography matters
              </p>
            </SplitText>
          </div>

          {/* Words + Lines only */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-zinc-400">
              Words + Lines Only
            </h3>
            <p className="text-xs text-zinc-600">
              Skip char splitting - ligatures remain enabled, better performance
            </p>
            <SplitText
              options={{ type: "words,lines" }}
              onSplit={({ words }) => {
                animate(
                  words,
                  { opacity: [0, 1], scale: [0.9, 1] },
                  { delay: stagger(0.05) }
                );
              }}
            >
              <p
                className="text-3xl text-zinc-200"
                style={{ fontFamily: "Georgia, serif" }}
              >
                Beautiful typography matters
              </p>
            </SplitText>
          </div>

          {/* Lines only */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-zinc-400">Lines Only</h3>
            <p className="text-xs text-zinc-600">
              Maximum performance - only line detection
            </p>
            <div className="max-w-md">
              <SplitText
                options={{ type: "lines" }}
                onSplit={({ lines }) => {
                  animate(
                    lines,
                    { opacity: [0, 1], x: [-20, 0] },
                    { delay: stagger(0.1) }
                  );
                }}
              >
                <p className="text-lg leading-relaxed text-zinc-300">
                  This text splits into lines only, perfect for simple
                  line-by-line animations without the overhead of character
                  splitting.
                </p>
              </SplitText>
            </div>
          </div>

          {/* Reference (unsplit) */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-zinc-400">
              Reference (Unsplit)
            </h3>
            <p className="text-xs text-zinc-600">
              Original text for comparison
            </p>
            <p
              className="text-3xl text-zinc-200"
              style={{ fontFamily: "Georgia, serif" }}
            >
              Beautiful typography matters
            </p>
          </div>

          <div className="rounded-lg bg-zinc-900 p-4 text-sm text-zinc-400">
            <p className="font-semibold text-white">How it works:</p>
            <ul className="mt-2 space-y-1">
              <li>
                • <code>type: &quot;chars,words,lines&quot;</code> (default) -
                Full splitting with all features
              </li>
              <li>
                • <code>type: &quot;words,lines&quot;</code> - Skips char
                splitting for better performance
              </li>
              <li>
                • <code>type: &quot;lines&quot;</code> - Only line detection,
                maximum performance
              </li>
              <li>
                • <strong>Ligatures:</strong> Auto-disabled when splitting
                chars, enabled when not
              </li>
              <li>
                • Notice ligatures (fi, ff, tt) in &quot;words,lines&quot; vs
                default
              </li>
            </ul>
          </div>
        </section>

        {/* Test 10: All 7 Type Combinations - Performance Optimization Test */}
        <section className="space-y-8">
          <div>
            <h2 className="text-2xl font-semibold text-emerald-400">
              10. All 7 Type Combinations - Performance Test
            </h2>
            <p className="text-sm text-zinc-500">
              Testing optimized splitting - no unnecessary word spans created
            </p>
          </div>

          {/* 1. chars only */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-zinc-400">
              1. type: &quot;chars&quot;
            </h3>
            <p className="text-xs text-zinc-600">
              Returns char spans only (word spans created internally for
              spacing)
            </p>
            <SplitText
              options={{ type: "chars" }}
              onSplit={({ chars, words, lines }) => {
                console.log("chars only:", {
                  chars: chars.length,
                  words: words.length,
                  lines: lines.length,
                });
                animate(chars, { opacity: [0, 1] }, { delay: stagger(0.01) });
              }}
            >
              <p className="text-xl text-zinc-200">Hello World</p>
            </SplitText>
          </div>

          {/* 2. words only */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-zinc-400">
              2. type: &quot;words&quot;
            </h3>
            <p className="text-xs text-zinc-600">
              Word spans with text content, no char spans
            </p>
            <SplitText
              options={{ type: "words" }}
              onSplit={({ chars, words, lines }) => {
                console.log("words only:", {
                  chars: chars.length,
                  words: words.length,
                  lines: lines.length,
                });
                animate(words, { opacity: [0, 1] }, { delay: stagger(0.05) });
              }}
            >
              <p className="text-xl text-zinc-200">Hello World Testing</p>
            </SplitText>
          </div>

          {/* 3. lines only */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-zinc-400">
              3. type: &quot;lines&quot;
            </h3>
            <p className="text-xs text-zinc-600">
              Line spans with text nodes, no word or char spans (optimized!)
            </p>
            <div className="max-w-sm">
              <SplitText
                options={{ type: "lines" }}
                onSplit={({ chars, words, lines }) => {
                  console.log("lines only:", {
                    chars: chars.length,
                    words: words.length,
                    lines: lines.length,
                  });
                  animate(lines, { opacity: [0, 1] }, { delay: stagger(0.1) });
                }}
              >
                <p className="text-lg leading-relaxed text-zinc-200">
                  This text should wrap into multiple lines for testing line
                  detection without unnecessary word spans.
                </p>
              </SplitText>
            </div>
          </div>

          {/* 4. chars,words */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-zinc-400">
              4. type: &quot;chars,words&quot;
            </h3>
            <p className="text-xs text-zinc-600">
              Word spans containing char spans, no lines
            </p>
            <SplitText
              options={{ type: "chars,words" }}
              onSplit={({ chars, words, lines }) => {
                console.log("chars,words:", {
                  chars: chars.length,
                  words: words.length,
                  lines: lines.length,
                });
                animate(
                  words,
                  { opacity: [0, 1], scale: [0.9, 1] },
                  { delay: stagger(0.05) }
                );
              }}
            >
              <p className="text-xl text-zinc-200">Hello World</p>
            </SplitText>
          </div>

          {/* 5. words,lines */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-zinc-400">
              5. type: &quot;words,lines&quot;
            </h3>
            <p className="text-xs text-zinc-600">
              Line spans containing word spans, no char spans
            </p>
            <div className="max-w-sm">
              <SplitText
                options={{ type: "words,lines" }}
                onSplit={({ chars, words, lines }) => {
                  console.log("words,lines:", {
                    chars: chars.length,
                    words: words.length,
                    lines: lines.length,
                  });
                  animate(words, { opacity: [0, 1] }, { delay: stagger(0.04) });
                }}
              >
                <p className="text-lg leading-relaxed text-zinc-200">
                  This text should wrap into multiple lines with word spans
                  inside line spans.
                </p>
              </SplitText>
            </div>
          </div>

          {/* 6. chars,lines */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-zinc-400">
              6. type: &quot;chars,lines&quot;
            </h3>
            <p className="text-xs text-zinc-600">
              Returns char + line spans (word spans created internally for
              spacing)
            </p>
            <div className="max-w-sm">
              <SplitText
                options={{ type: "chars,lines" }}
                onSplit={({ chars, words, lines }) => {
                  console.log("chars,lines:", {
                    chars: chars.length,
                    words: words.length,
                    lines: lines.length,
                  });
                  animate(chars, { opacity: [0, 1] }, { delay: stagger(0.02) });
                }}
              >
                <p className="text-lg leading-relaxed text-zinc-200">
                  This text should wrap into multiple lines with char spans
                  directly inside line spans.
                </p>
              </SplitText>
            </div>
          </div>

          {/* 7. chars,words,lines (default) */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-zinc-400">
              7. type: &quot;chars,words,lines&quot; (default)
            </h3>
            <p className="text-xs text-zinc-600">
              Full hierarchy: line spans → word spans → char spans
            </p>
            <div className="max-w-sm">
              <SplitText
                onSplit={({ chars, words, lines }) => {
                  console.log("chars,words,lines:", {
                    chars: chars.length,
                    words: words.length,
                    lines: lines.length,
                  });
                  animate(chars, { opacity: [0, 1] }, { delay: stagger(0.01) });
                }}
              >
                <p className="text-lg leading-relaxed text-zinc-200">
                  This text should have the complete hierarchy with all three
                  split types.
                </p>
              </SplitText>
            </div>
          </div>

          <div className="rounded-lg bg-zinc-900 p-4 text-sm text-zinc-400">
            <p className="font-semibold text-white">How it works:</p>
            <ul className="mt-2 space-y-1">
              <li>
                • When splitting <strong>chars</strong>, word spans are created
                internally for proper spacing
              </li>
              <li>
                • Only the requested types are returned in the result arrays
              </li>
              <li>
                • <code>type: &quot;chars&quot;</code> returns chars only (words
                array is empty)
              </li>
              <li>
                • <code>type: &quot;chars,lines&quot;</code> returns chars +
                lines (words array is empty)
              </li>
              <li>
                • <strong>Optimized:</strong> type: &quot;lines&quot; (text
                nodes only, no char/word spans)
              </li>
              <li>• Check console logs to see result counts</li>
            </ul>
          </div>
        </section>

        {/* Test 11: inView - Basic Trigger */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-emerald-400">
            11. InView - Basic Trigger (Built-in)
          </h2>
          <p className="text-sm text-zinc-500">
            Uses built-in inView prop - no hooks needed!
          </p>
          <div className="mt-[100vh]">
            <SplitText
              onSplit={({ words }) => {
                words.forEach((w) => (w.style.opacity = "0"));
              }}
              inView={{ amount: 0.5, once: true }}
              onInView={({ words }) =>
                animate(
                  words,
                  { opacity: [0, 1], y: [20, 0] },
                  { delay: stagger(0.05) }
                )
              }
            >
              <p className="text-2xl text-zinc-200">
                This text animates when you scroll it into view!
              </p>
            </SplitText>
          </div>
        </section>

        {/* Test 12: inView - Enter/Leave Animations */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-emerald-400">
            12. InView - Enter/Leave Animations (Built-in)
          </h2>
          <p className="text-sm text-zinc-500">
            Animates in when entering, animates out when leaving viewport
          </p>
          <div className="mt-[50vh] mb-[100vh]">
            <SplitText
              onSplit={({ words }) => {
                words.forEach((w) => {
                  w.style.opacity = "0";
                  w.style.transform = "scale(0.8)";
                });
              }}
              inView={{ amount: 0.3 }}
              onInView={({ words }) =>
                animate(
                  words,
                  { opacity: [0, 1], scale: [0.8, 1] },
                  { delay: stagger(0.05) }
                )
              }
              onLeaveView={({ words }) =>
                animate(words, { opacity: 0, scale: 0.8 }, { duration: 0.3 })
              }
            >
              <p className="text-2xl text-zinc-200">
                Watch me fade in and out as you scroll!
              </p>
            </SplitText>
          </div>
        </section>

        {/* Test 13: Scroll-Linked Animation */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-emerald-400">
            13. Scroll-Triggered Animation (Built-in inView)
          </h2>
          <p className="text-sm text-zinc-500">
            Animation triggers when scrolling into view with staggered timing
          </p>
          <div className="mt-[50vh] mb-[100vh]">
            <SplitText
              onSplit={({ words }) => {
                words.forEach((w) => {
                  w.style.opacity = "0";
                  w.style.transform = "translateY(20px)";
                });
              }}
              inView={{ amount: 0.3, once: true }}
              onInView={({ words }) =>
                animate(
                  words,
                  { opacity: [0, 1], y: [20, 0] },
                  { delay: stagger(0.05) }
                )
              }
            >
              <p className="text-2xl leading-relaxed text-zinc-200">
                This animation reveals as you scroll into view with smooth
                staggering!
              </p>
            </SplitText>
          </div>
        </section>

        {/* Test 14: Character Reveal on Scroll */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-emerald-400">
            14. Character Reveal on Scroll (Built-in inView)
          </h2>
          <p className="text-sm text-zinc-500">
            Char-by-char reveal with 3D rotation on scroll into view
          </p>
          <div className="mt-[50vh]">
            <SplitText
              onSplit={({ chars }) => {
                chars.forEach((c) => {
                  c.style.opacity = "0";
                  c.style.transform = "rotateY(90deg)";
                  c.style.filter = "blur(4px)";
                });
              }}
              inView={{ amount: 0.3, once: true }}
              onInView={({ chars }) =>
                animate(
                  chars,
                  {
                    opacity: [0, 1],
                    rotateY: [90, 0],
                    filter: ["blur(4px)", "blur(0px)"],
                  },
                  { delay: stagger(0.02) }
                )
              }
            >
              <p className="text-3xl font-bold text-zinc-200">
                Character by character reveal
              </p>
            </SplitText>
          </div>
        </section>

        {/* Test 15: AutoSplit with InView Integration */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-emerald-400">
            15. AutoSplit with InView Integration (Built-in)
          </h2>
          <p className="text-sm text-zinc-500">
            Responsive text that re-animates on resize - no hooks needed!
          </p>
          <div className="mt-[50vh] mb-[50vh] max-w-2xl">
            <SplitText
              autoSplit
              onSplit={({ words }) => {
                words.forEach((w) => (w.style.opacity = "0"));
              }}
              onResize={({ words }) => {
                console.log("Re-split:", words.length, "words");
                words.forEach((w) => (w.style.opacity = "0"));
              }}
              inView={{ amount: 0.5 }}
              onInView={({ words }) => {
                console.log("InView triggered with", words.length, "words");
                return animate(
                  words,
                  { opacity: [0, 1] },
                  { delay: stagger(0.03) }
                );
              }}
              onLeaveView={({ words }) => {
                console.log("LeaveView triggered with", words.length, "words");
                return animate(
                  words,
                  { opacity: 0 },
                  { duration: 0.3, autoplay: false }
                );
              }}
            >
              <p className="text-lg leading-relaxed text-zinc-200">
                This text automatically re-splits when you resize the browser
                window and re-animates when it enters the viewport. Try resizing
                the window, then scroll up and down to see the animation trigger
                again with the new line breaks!
              </p>
            </SplitText>
          </div>
        </section>

        {/* Test 16: Scroll Progress with Lines */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-emerald-400">
            16. Line-by-Line Reveal (Built-in inView)
          </h2>
          <p className="text-sm text-zinc-500">
            Line-by-line reveal when scrolling into view
          </p>
          <div className="mt-[50vh] mb-[100vh] max-w-2xl">
            <SplitText
              onSplit={({ lines }) => {
                lines.forEach((l) => {
                  l.style.opacity = "0";
                  l.style.transform = "translateX(-30px)";
                });
              }}
              inView={{ amount: 0.3, once: true }}
              onInView={({ lines }) =>
                animate(
                  lines,
                  { opacity: [0, 1], x: [-30, 0] },
                  { delay: stagger(0.15) }
                )
              }
            >
              <div className="text-xl leading-relaxed text-zinc-200">
                <p>
                  Each line of this paragraph reveals as you scroll into view.
                  The animation triggers when the element enters the viewport,
                  creating a smooth line-by-line reveal effect. This works
                  perfectly for long-form content where you want to draw
                  attention to each line as the user reads.
                </p>
              </div>
            </SplitText>
          </div>
        </section>

        {/* Test 17: Scroll-Driven Animation */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-emerald-400">
            17. Scroll-Driven Animation (scroll function)
          </h2>
          <p className="text-sm text-zinc-500">
            Animation progress bound to scroll position using motion&apos;s
            scroll() function
          </p>
          <div className="py-64 relative">
            <SplitText
              ref={scrollTarget17}
              onSplit={({ words }) => {
                if (!scrollTarget17.current) return;
                const animation = animate(
                  words,
                  { opacity: [0, 1], y: [50, 0] },
                  { delay: stagger(0.05), duration: 1 }
                );
                scroll(animation, {
                  target: scrollTarget17.current!,
                  offset: ["start 85%", "start 50%"],
                });
              }}
            >
              <p className="text-3xl font-bold text-zinc-200">
                Scroll to reveal each word progressively
              </p>
            </SplitText>
          </div>
        </section>

        {/* Test 18: Scroll-Driven Character Reveal */}
        {/* <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-emerald-400">
            18. Scroll-Driven Character Reveal
          </h2>
          <p className="text-sm text-zinc-500">
            Each character reveals as you scroll through the section
          </p>
          <div className="h-[300vh] relative" ref={scrollTarget18}>
            <div className="sticky top-1/4">
              <SplitText
                onSplit={({ chars }) => {
                  const animation = animate(
                    chars,
                    {
                      opacity: [0, 1],
                      scale: [0.5, 1],
                      filter: ["blur(10px)", "blur(0px)"],
                    },
                    { delay: stagger(0.02), duration: 1 }
                  );
                  scroll(animation, {
                    target: scrollTarget18.current!,
                    offset: ["start end", "center center"],
                  });
                }}
              >
                <p className="text-4xl font-bold text-zinc-200">
                  Character by character scroll reveal
                </p>
              </SplitText>
            </div>
          </div>
        </section> */}

        {/* Test 19: Scroll-Driven Line Animation */}
        {/* <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-emerald-400">
            19. Scroll-Driven Line Animation
          </h2>
          <p className="text-sm text-zinc-500">
            Lines slide in from the left as you scroll
          </p>
          <div className="h-[250vh] relative" ref={scrollTarget19}>
            <div className="sticky top-1/4 max-w-2xl">
              <SplitText
                onSplit={({ lines }) => {
                  const animation = animate(
                    lines,
                    {
                      opacity: [0, 1],
                      x: [-100, 0],
                    },
                    { delay: stagger(0.1), duration: 1 }
                  );
                  scroll(animation, {
                    target: scrollTarget19.current!,
                    offset: ["start end", "center center"],
                  });
                }}
              >
                <div className="text-xl leading-relaxed text-zinc-200">
                  <p>
                    Each line of this paragraph slides in from the left as you
                    scroll. The animation progress is directly tied to your
                    scroll position, creating a smooth and satisfying reveal
                    effect.
                  </p>
                </div>
              </SplitText>
            </div>
          </div>
        </section> */}

        <div className="border-t border-zinc-800 pt-8">
          <p className="text-center text-sm text-zinc-500">
            Open browser DevTools Console to see warnings and logs
          </p>
          <p className="text-center text-sm text-zinc-600 mt-2">
            Scroll down to see inView and scroll-linked animations in action
          </p>
        </div>
      </div>
    </div>
  );
}
