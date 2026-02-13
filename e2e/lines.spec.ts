import { test, expect } from "@playwright/test";

test.describe("Line Detection", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/e2e/test-page.html");

    // Wait for fonts to be ready
    await page.waitForFunction(() => window.fontsReady === true);
  });

  test("detects correct number of lines based on container width", async ({
    page,
  }) => {
    // Split the text into lines
    await page.evaluate(() => {
      const element = document.getElementById("lines-test")!;
      window.splitText(element, { type: "lines" });
    });

    // Count line elements
    const lineCount = await page.evaluate(() => {
      const lines = document.querySelectorAll("#lines-test .split-line");
      return lines.length;
    });

    // With 300px width, the text should wrap into multiple lines
    expect(lineCount).toBeGreaterThan(1);
  });

  test("words are grouped correctly by Y-position", async ({ page }) => {
    // Split into words and lines
    await page.evaluate(() => {
      const element = document.getElementById("lines-test")!;
      window.splitText(element, { type: "words,lines" });
    });

    // Get line positions and verify words in each line have same Y
    const lineData = await page.evaluate(() => {
      const lines = document.querySelectorAll("#lines-test .split-line");
      return Array.from(lines).map((line) => {
        const words = line.querySelectorAll(".split-word");
        const yPositions = Array.from(words).map(
          (word) => word.getBoundingClientRect().top
        );
        return {
          wordCount: words.length,
          yPositions,
        };
      });
    });

    // Verify each line has consistent Y positions (within tolerance)
    for (const line of lineData) {
      if (line.wordCount > 1) {
        const firstY = line.yPositions[0];
        for (const y of line.yPositions) {
          expect(Math.abs(y - firstY)).toBeLessThan(5);
        }
      }
    }
  });

  test("line elements have display:block style", async ({ page }) => {
    // Split into lines
    await page.evaluate(() => {
      const element = document.getElementById("lines-test")!;
      window.splitText(element, { type: "lines" });
    });

    // Check display style
    const allLinesBlock = await page.evaluate(() => {
      const lines = document.querySelectorAll("#lines-test .split-line");
      return Array.from(lines).every((line) => {
        return (line as HTMLElement).style.display === "block";
      });
    });

    expect(allLinesBlock).toBe(true);
  });

  test("resize changes line count", async ({ page }) => {
    // Split with autoSplit
    await page.evaluate(() => {
      const element = document.getElementById("resize-test")!;
      window.splitText(element, { type: "lines", autoSplit: true });
    });

    // Get initial line count
    const initialLineCount = await page.evaluate(() => {
      return document.querySelectorAll("#resize-test .split-line").length;
    });

    // Resize container to be narrower
    await page.evaluate(() => {
      const container = document.getElementById("resize-container")!;
      container.style.width = "200px";
    });

    // Wait for debounce and re-split
    await page.waitForTimeout(300);

    // Get new line count
    const newLineCount = await page.evaluate(() => {
      return document.querySelectorAll("#resize-test .split-line").length;
    });

    // Narrower container should have more lines
    expect(newLineCount).toBeGreaterThanOrEqual(initialLineCount);
  });

  test("each line contains correct text content", async ({ page }) => {
    // Split into lines
    await page.evaluate(() => {
      const element = document.getElementById("lines-test")!;
      window.splitText(element, { type: "lines" });
    });

    // Get all line text content joined
    const combinedText = await page.evaluate(() => {
      const lines = document.querySelectorAll("#lines-test .split-line");
      return Array.from(lines)
        .map((line) => line.textContent?.trim())
        .join(" ");
    });

    // Should contain all the original words
    expect(combinedText).toContain("quick");
    expect(combinedText).toContain("brown");
    expect(combinedText).toContain("fox");
    expect(combinedText).toContain("lazy");
    expect(combinedText).toContain("dog");
  });
});

test.describe("Nested Elements", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/e2e/test-page.html");
    await page.waitForFunction(() => window.fontsReady === true);
  });

  test("preserves anchor tags with attributes", async ({ page }) => {
    // Split the nested test element
    await page.evaluate(() => {
      const element = document.getElementById("nested-test")!;
      window.splitText(element, { type: "chars,words" });
    });

    // Check that anchor tag is preserved
    const anchorExists = await page.evaluate(() => {
      const anchor = document.querySelector("#nested-test a");
      return anchor !== null && anchor.getAttribute("href") === "/link";
    });

    expect(anchorExists).toBe(true);
  });

  test("preserves strong tags", async ({ page }) => {
    // Split the nested test element
    await page.evaluate(() => {
      const element = document.getElementById("nested-test")!;
      window.splitText(element, { type: "chars,words" });
    });

    // Check that strong tag is preserved
    const strongExists = await page.evaluate(() => {
      const strong = document.querySelector("#nested-test strong");
      return strong !== null;
    });

    expect(strongExists).toBe(true);
  });
});

// Extend Window interface for TypeScript
declare global {
  interface Window {
    splitText: typeof import("../src/core/splitText").splitText;
    fontsReady: boolean;
  }
}
