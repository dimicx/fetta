import { expect, test } from "@playwright/test";

test.describe("autoSplit deadspot regression", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/e2e/test-page.html");
    await page.waitForFunction(() => window.fontsReady === true);
  });

  test("resplits on subpixel width changes", async ({ page }) => {
    await page.evaluate(() => {
      const target = document.getElementById("deadspot-test") as HTMLElement | null;
      if (!target) throw new Error("Missing #deadspot-test");

      window.deadspotResplitCount = 0;
      window.splitText(target, {
        type: "chars,words",
        autoSplit: true,
        onResplit: () => {
          window.deadspotResplitCount += 1;
        },
      });
    });

    await page.evaluate(() => {
      const inner = document.getElementById("deadspot-inner") as HTMLElement | null;
      if (!inner) throw new Error("Missing #deadspot-inner");
      inner.style.width = "321.1px";
    });
    await page.waitForTimeout(220);

    await page.evaluate(() => {
      const inner = document.getElementById("deadspot-inner") as HTMLElement | null;
      if (!inner) throw new Error("Missing #deadspot-inner");
      inner.style.width = "321.7px";
    });
    await page.waitForTimeout(220);

    const resplitCount = await page.evaluate(() => window.deadspotResplitCount);
    expect(resplitCount).toBeGreaterThan(0);
  });

  test("keeps each generated line on a single visual row across width sweep", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const target = document.getElementById("deadspot-test") as HTMLElement | null;
      if (!target) throw new Error("Missing #deadspot-test");

      window.deadspotResplitCount = 0;
      window.splitText(target, {
        type: "words,lines",
        autoSplit: true,
        onResplit: () => {
          window.deadspotResplitCount += 1;
        },
      });
    });

    const widths = [420, 360, 320, 285, 340, 300];
    for (const width of widths) {
      await page.evaluate((nextWidth) => {
        const outer = document.getElementById("deadspot-outer") as HTMLElement | null;
        if (!outer) throw new Error("Missing #deadspot-outer");
        outer.style.width = `${nextWidth}px`;
      }, width);
      await page.waitForTimeout(220);
    }

    const lineAudit = await page.evaluate(() => {
      const lines = Array.from(
        document.querySelectorAll<HTMLSpanElement>("#deadspot-test .split-line")
      );

      let invalidLineCount = 0;
      for (const line of lines) {
        const words = Array.from(line.querySelectorAll<HTMLSpanElement>(".split-word"));
        if (words.length < 2) continue;

        const tops = words.map((word) => word.getBoundingClientRect().top);
        const minTop = Math.min(...tops);
        const maxTop = Math.max(...tops);

        if (maxTop - minTop > 2) {
          invalidLineCount += 1;
        }
      }

      return {
        invalidLineCount,
        lineCount: lines.length,
        resplitCount: window.deadspotResplitCount,
      };
    });

    expect(lineAudit.lineCount).toBeGreaterThan(1);
    expect(lineAudit.resplitCount).toBeGreaterThan(0);
    expect(lineAudit.invalidLineCount).toBe(0);
  });
});

declare global {
  interface Window {
    splitText: typeof import("../src/core/splitText").splitText;
    fontsReady: boolean;
    deadspotResplitCount: number;
  }
}
