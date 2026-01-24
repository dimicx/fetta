import { KerningBenchmark } from "../components/kerning-benchmark";

export default function BenchmarkPage() {
  return (
    <main className="container max-w-4xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-2">Kerning Measurement Benchmark</h1>
      <p className="text-muted-foreground mb-8">
        Compare performance of different kerning measurement approaches across
        browsers.
      </p>

      <div className="prose prose-neutral dark:prose-invert max-w-none mb-8">
        <h2>Methods Compared</h2>
        <ul>
          <li>
            <strong>Canvas (Chrome/FF/Edge)</strong> — Uses{" "}
            <code>measureText()</code>. Very fast. Used for non-Safari browsers.
          </li>
          <li>
            <strong>DOM optimized (Safari)</strong> — Uses{" "}
            <code>getBoundingClientRect()</code> with deduplication. Inherits{" "}
            <code>-webkit-font-smoothing</code> for Safari accuracy.
          </li>
          <li>
            <strong>Range API</strong> — Uses{" "}
            <code>Range.getBoundingClientRect()</code>. Reference only.
          </li>
        </ul>
        <p className="mt-4 text-sm text-muted-foreground">
          Fetta automatically selects Canvas for Chrome/Firefox/Edge and DOM for
          Safari.
        </p>
      </div>

      <KerningBenchmark />

      <div className="prose prose-neutral dark:prose-invert max-w-none mt-8">
        <h2>Notes</h2>
        <ul>
          <li>Each method runs 1000 iterations after a 10-iteration warmup</li>
          <li>
            Performance varies by browser — try in Chrome, Firefox, and Safari
          </li>
          <li>
            DOM-based is chosen for accuracy (Safari font-smoothing support),
            not speed
          </li>
        </ul>
      </div>
    </main>
  );
}
