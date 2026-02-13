import { test, expect } from "@playwright/test";

test.describe("Kerning Compensation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/e2e/test-page.html");

    // Wait for fonts to be ready
    await page.waitForFunction(() => window.fontsReady === true);
  });

  test("split text creates character spans with kerning data", async ({
    page,
  }) => {
    // Split the text
    await page.evaluate(() => {
      const element = document.getElementById("kerning-test")!;
      window.splitText(element, { type: "chars" });
    });

    // Verify character spans were created
    const charCount = await page.evaluate(() => {
      const chars = document.querySelectorAll("#kerning-test .split-char");
      return chars.length;
    });

    // "WAVE Typography" = 14 characters (space is not a char span)
    expect(charCount).toBe(14);

    // Verify characters have expected text content
    const charTexts = await page.evaluate(() => {
      const chars = document.querySelectorAll("#kerning-test .split-char");
      return Array.from(chars).map((char) => char.textContent);
    });

    expect(charTexts.join("")).toBe("WAVETypography");
  });

  test("characters have marginLeft values applied", async ({ page }) => {
    // Split the text
    await page.evaluate(() => {
      const element = document.getElementById("kerning-test")!;
      window.splitText(element, { type: "chars" });
    });

    // Check that at least some characters have margin adjustments
    const marginsApplied = await page.evaluate(() => {
      const chars = document.querySelectorAll("#kerning-test .split-char");
      let hasMargins = false;

      chars.forEach((char) => {
        const marginLeft = (char as HTMLElement).style.marginLeft;
        if (marginLeft && marginLeft !== "0px" && marginLeft !== "") {
          hasMargins = true;
        }
      });

      return hasMargins;
    });

    // WAVE has kerning between W-A and A-V, so margins should be applied
    expect(marginsApplied).toBe(true);
  });

  test("kerning compensation preserves visual layout", async ({ page }) => {
    // Measure total width before split
    const originalWidth = await page.evaluate(() => {
      const element = document.getElementById("kerning-test")!;
      return element.getBoundingClientRect().width;
    });

    // Split the text
    await page.evaluate(() => {
      const element = document.getElementById("kerning-test")!;
      window.splitText(element, { type: "chars" });
    });

    // Measure total width after split
    const splitWidth = await page.evaluate(() => {
      const element = document.getElementById("kerning-test")!;
      return element.getBoundingClientRect().width;
    });

    // Width should be very close (within 5px)
    expect(Math.abs(originalWidth - splitWidth)).toBeLessThan(5);
  });
});

// Extend Window interface for TypeScript
declare global {
  interface Window {
    splitText: typeof import("../src/core/splitText").splitText;
    fontsReady: boolean;
  }
}
