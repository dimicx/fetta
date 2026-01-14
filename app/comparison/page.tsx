"use client";

import { useState, useRef, useEffect } from "react";
import { splitText as motionSplitText } from "motion-plus";
import { splitText as customSplitText } from "../split-text";
import { Navigation } from "../components/Navigation";

const DEMO_TEXT =
  "Create beautiful animations with just a few lines of code. Motion handles the complexity so you can focus on what matters most—building great user experiences that delight and engage.";

export default function ComparisonPage() {
  const [motionSplit, setMotionSplit] = useState(false);
  const [customSplit, setCustomSplit] = useState(false);

  const motionRef = useRef<HTMLParagraphElement>(null);
  const customRef = useRef<HTMLParagraphElement>(null);

  const motionOriginalRef = useRef<string | null>(null);
  const customRevertRef = useRef<(() => void) | null>(null);

  // Handle motion splitText toggle
  useEffect(() => {
    if (!motionRef.current) return;

    if (motionSplit) {
      // Store original before splitting
      if (motionOriginalRef.current === null) {
        motionOriginalRef.current = motionRef.current.innerHTML;
      }
      motionSplitText(motionRef.current);
    } else {
      // Revert to original
      if (motionOriginalRef.current !== null) {
        motionRef.current.innerHTML = motionOriginalRef.current;
      }
    }
  }, [motionSplit]);

  // Handle custom splitText toggle
  useEffect(() => {
    if (!customRef.current) return;

    if (customSplit) {
      const result = customSplitText(customRef.current, { autoSplit: true });
      customRevertRef.current = result.revert;
    } else {
      // Revert using the stored revert function
      if (customRevertRef.current) {
        customRevertRef.current();
        customRevertRef.current = null;
      }
    }
  }, [customSplit]);

  return (
    <div className="min-h-screen bg-zinc-950 px-8 py-16 font-sans">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-4 text-3xl font-bold text-white">
          splitText Comparison
        </h1>
        <p className="mb-12 text-zinc-400">
          Compare Motion&apos;s splitText with the custom implementation.
          <br />
          Toggle each to see how kerning and line breaks differ.
        </p>

        {/* Controls */}
        <div className="mb-8 flex gap-8">
          <button
            onClick={() => setMotionSplit(!motionSplit)}
            className={`rounded-lg px-6 py-3 font-medium transition ${
              motionSplit
                ? "bg-blue-600 text-white"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            Motion splitText: {motionSplit ? "ON" : "OFF"}
          </button>

          <button
            onClick={() => setCustomSplit(!customSplit)}
            className={`rounded-lg px-6 py-3 font-medium transition ${
              customSplit
                ? "bg-emerald-600 text-white"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            Custom splitText: {customSplit ? "ON" : "OFF"}
          </button>

          <button
            onClick={() => {
              setMotionSplit(true);
              setCustomSplit(true);
            }}
            className="rounded-lg bg-zinc-800 px-6 py-3 font-medium text-zinc-300 transition hover:bg-zinc-700"
          >
            Split Both
          </button>

          <button
            onClick={() => {
              setMotionSplit(false);
              setCustomSplit(false);
            }}
            className="rounded-lg bg-zinc-800 px-6 py-3 font-medium text-zinc-300 transition hover:bg-zinc-700"
          >
            Reset Both
          </button>
        </div>

        {/* Side by side comparison */}
        <div className="grid grid-cols-2 gap-8">
          {/* Motion splitText */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="mb-4 flex items-center gap-2">
              <span
                className={`h-3 w-3 rounded-full ${
                  motionSplit ? "bg-blue-500" : "bg-zinc-600"
                }`}
              />
              <h2 className="text-lg font-semibold text-blue-400">
                Motion splitText
              </h2>
            </div>
            <p ref={motionRef} className="text-lg leading-loose text-zinc-300">
              {DEMO_TEXT}
            </p>
          </div>

          {/* Custom splitText */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="mb-4 flex items-center gap-2">
              <span
                className={`h-3 w-3 rounded-full ${
                  customSplit ? "bg-emerald-500" : "bg-zinc-600"
                }`}
              />
              <h2 className="text-lg font-semibold text-emerald-400">
                Custom splitText
              </h2>
            </div>
            <p ref={customRef} className="text-lg leading-loose text-zinc-300">
              {DEMO_TEXT}
            </p>
          </div>
        </div>

        {/* Original reference */}
        <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-zinc-500" />
            <h2 className="text-lg font-semibold text-zinc-400">
              Original (unsplit reference)
            </h2>
          </div>
          <p className="text-lg leading-loose text-zinc-300">{DEMO_TEXT}</p>
        </div>

        {/* Instructions */}
        <div className="mt-12 rounded-lg bg-zinc-900 p-6 text-zinc-400">
          <h3 className="mb-2 font-semibold text-white">What to look for:</h3>
          <ul className="list-inside list-disc space-y-1">
            <li>
              <strong>Kerning:</strong> Notice character spacing differences,
              especially in words like &quot;beautiful&quot; and
              &quot;complexity&quot;
            </li>
            <li>
              <strong>Em-dash wrapping:</strong> See how
              &quot;most—building&quot; wraps at different viewport widths
            </li>
            <li>
              <strong>Line breaks:</strong> Compare where lines break vs the
              original unsplit text
            </li>
            <li>
              <strong>Resize the window:</strong> Watch how each handles
              responsive text reflow
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
