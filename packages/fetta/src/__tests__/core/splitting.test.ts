import { describe, it, expect, beforeEach, vi } from "vitest";
import { splitText } from "../../core/splitText";

describe("splitText", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe("basic splitting", () => {
    it("splits a simple word into characters", () => {
      const element = document.createElement("h1");
      element.textContent = "Hello";
      container.appendChild(element);

      const result = splitText(element, { type: "chars" });

      expect(result.chars).toHaveLength(5);
      expect(result.chars.map((c) => c.textContent)).toEqual([
        "H",
        "e",
        "l",
        "l",
        "o",
      ]);
    });

    it("splits multiple words into words array", () => {
      const element = document.createElement("p");
      element.textContent = "Hello World";
      container.appendChild(element);

      const result = splitText(element, { type: "words" });

      expect(result.words).toHaveLength(2);
      expect(result.words.map((w) => w.textContent)).toEqual([
        "Hello",
        "World",
      ]);
    });

    it("splits text into chars, words, and lines by default", () => {
      const element = document.createElement("p");
      element.textContent = "Hello World";
      container.appendChild(element);

      const result = splitText(element);

      expect(result.chars.length).toBeGreaterThan(0);
      expect(result.words.length).toBeGreaterThan(0);
      expect(result.lines.length).toBeGreaterThan(0);
    });

    it("returns correct character count for multi-word text", () => {
      const element = document.createElement("p");
      element.textContent = "Hello World";
      container.appendChild(element);

      const result = splitText(element, { type: "chars" });

      // "Hello World" = 11 characters (including space as word separator)
      expect(result.chars).toHaveLength(10); // Space is not a char span
    });
  });

  describe("nested elements", () => {
    it("preserves anchor tag with href attribute", () => {
      const element = document.createElement("p");
      element.innerHTML = 'Click <a href="/link">here</a>';
      container.appendChild(element);

      const result = splitText(element, { type: "chars,words" });

      // Find chars that are inside an anchor
      const anchorChars = result.chars.filter((c) => {
        let parent = c.parentElement;
        while (parent && parent !== element) {
          if (parent.tagName.toLowerCase() === "a") {
            return true;
          }
          parent = parent.parentElement;
        }
        return false;
      });

      expect(anchorChars.length).toBeGreaterThan(0);

      // Find the anchor element
      const anchor = element.querySelector("a");
      expect(anchor).not.toBeNull();
      expect(anchor?.getAttribute("href")).toBe("/link");
    });

    it("preserves strong and em tags", () => {
      const element = document.createElement("p");
      element.innerHTML = "This is <strong>bold</strong> and <em>italic</em>";
      container.appendChild(element);

      const result = splitText(element, { type: "words" });

      expect(result.words.length).toBeGreaterThan(0);

      // Check that strong and em are preserved in the output
      expect(element.querySelector("strong")).not.toBeNull();
      expect(element.querySelector("em")).not.toBeNull();
    });
  });

  describe("dash handling", () => {
    it("splits at em-dash and marks continuation with noSpaceBefore", () => {
      const element = document.createElement("p");
      element.textContent = "word—continuation";
      container.appendChild(element);

      const result = splitText(element, { type: "words" });

      // Should create two word spans: "word—" and "continuation"
      expect(result.words).toHaveLength(2);
      expect(result.words[0].textContent).toBe("word—");
      expect(result.words[1].textContent).toBe("continuation");

      // No space should appear between them in the output
      expect(element.textContent).toBe("word—continuation");
    });

    it("splits at en-dash", () => {
      const element = document.createElement("p");
      element.textContent = "2020–2021";
      container.appendChild(element);

      const result = splitText(element, { type: "words" });

      expect(result.words).toHaveLength(2);
      expect(result.words[0].textContent).toBe("2020–");
      expect(result.words[1].textContent).toBe("2021");
    });
  });

  describe("mask wrappers", () => {
    it("creates overflow:clip wrappers for chars when mask='chars'", () => {
      const element = document.createElement("p");
      element.textContent = "Hello";
      container.appendChild(element);

      const result = splitText(element, { type: "chars", mask: "chars" });

      // Each char should be wrapped in a mask wrapper
      result.chars.forEach((char) => {
        const wrapper = char.parentElement;
        expect(wrapper).not.toBeNull();
        expect(wrapper?.style.overflow).toBe("clip");
      });
    });

    it("creates overflow:clip wrappers for words when mask='words'", () => {
      const element = document.createElement("p");
      element.textContent = "Hello World";
      container.appendChild(element);

      const result = splitText(element, { type: "words", mask: "words" });

      // Each word should be wrapped in a mask wrapper
      result.words.forEach((word) => {
        const wrapper = word.parentElement;
        expect(wrapper).not.toBeNull();
        expect(wrapper?.style.overflow).toBe("clip");
      });
    });

    it("creates overflow:clip wrappers for lines when mask='lines'", () => {
      const element = document.createElement("p");
      element.textContent = "Hello World";
      container.appendChild(element);

      const result = splitText(element, { type: "lines", mask: "lines" });

      // Each line should be wrapped in a mask wrapper
      result.lines.forEach((line) => {
        const wrapper = line.parentElement;
        expect(wrapper).not.toBeNull();
        expect(wrapper?.style.overflow).toBe("clip");
      });
    });
  });

  describe("revert functionality", () => {
    it("restores original HTML when revert is called", () => {
      const element = document.createElement("p");
      const originalHTML = "Hello World";
      element.innerHTML = originalHTML;
      container.appendChild(element);

      const result = splitText(element);

      // Verify text is split
      expect(element.querySelectorAll(".split-char").length).toBeGreaterThan(0);

      // Revert
      result.revert();

      // Verify original HTML is restored
      expect(element.innerHTML).toBe(originalHTML);
    });

    it("removes aria-label on revert", () => {
      const element = document.createElement("p");
      element.textContent = "Hello";
      container.appendChild(element);

      const result = splitText(element);

      expect(element.getAttribute("aria-label")).toBe("Hello");

      result.revert();

      expect(element.getAttribute("aria-label")).toBeNull();
    });

    it("keeps ligatures disabled after revert when chars were split", () => {
      const element = document.createElement("p");
      element.textContent = "Hello";
      container.appendChild(element);

      splitText(element, { type: "chars" }).revert();

      expect(element.style.fontVariantLigatures).toBe("none");
    });
  });

  describe("empty content handling", () => {
    it("returns empty arrays for element with no text", () => {
      const element = document.createElement("p");
      element.textContent = "";
      container.appendChild(element);

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = splitText(element);

      expect(result.chars).toHaveLength(0);
      expect(result.words).toHaveLength(0);
      expect(result.lines).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        "splitText: element has no text content"
      );

      consoleSpy.mockRestore();
    });

    it("returns empty arrays for whitespace-only content", () => {
      const element = document.createElement("p");
      element.textContent = "   ";
      container.appendChild(element);

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = splitText(element);

      expect(result.chars).toHaveLength(0);
      expect(result.words).toHaveLength(0);
      expect(result.lines).toHaveLength(0);

      consoleSpy.mockRestore();
    });
  });

  describe("input validation", () => {
    it("throws error for non-HTMLElement input", () => {
      const nonElement = { textContent: "Hello" };

      expect(() => splitText(nonElement as HTMLElement)).toThrow(
        "splitText: element must be an HTMLElement"
      );
    });

    it("throws error for null input", () => {
      expect(() => splitText(null as unknown as HTMLElement)).toThrow(
        "splitText: element must be an HTMLElement"
      );
    });
  });

  describe("custom classes", () => {
    it("applies custom char class", () => {
      const element = document.createElement("p");
      element.textContent = "Hello";
      container.appendChild(element);

      const result = splitText(element, {
        type: "chars",
        charClass: "my-char",
      });

      result.chars.forEach((char) => {
        expect(char.className).toBe("my-char");
      });
    });

    it("applies custom word class", () => {
      const element = document.createElement("p");
      element.textContent = "Hello World";
      container.appendChild(element);

      const result = splitText(element, {
        type: "words",
        wordClass: "my-word",
      });

      result.words.forEach((word) => {
        expect(word.className).toBe("my-word");
      });
    });

    it("applies custom line class", () => {
      const element = document.createElement("p");
      element.textContent = "Hello World";
      container.appendChild(element);

      const result = splitText(element, {
        type: "lines",
        lineClass: "my-line",
      });

      result.lines.forEach((line) => {
        expect(line.className).toBe("my-line");
      });
    });
  });

  describe("accessibility", () => {
    it("adds aria-label with original text content for simple text", () => {
      const element = document.createElement("p");
      element.textContent = "Hello World";
      container.appendChild(element);

      splitText(element);

      expect(element.getAttribute("aria-label")).toBe("Hello World");
    });

    it("uses aria-hidden + sr-only for nested elements", () => {
      const element = document.createElement("p");
      element.innerHTML = 'Click <a href="/link">here</a> for more';
      container.appendChild(element);

      splitText(element, { type: "words" });

      // Visual content should be wrapped with aria-hidden
      const visualWrapper = element.querySelector('[data-fetta-visual="true"]');
      expect(visualWrapper).not.toBeNull();
      expect(visualWrapper?.getAttribute("aria-hidden")).toBe("true");

      // Screen reader copy should exist with sr-only class
      const srCopy = element.querySelector('[data-fetta-sr-copy="true"]');
      expect(srCopy).not.toBeNull();
      expect(srCopy?.classList.contains("fetta-sr-only")).toBe(true);

      // Should NOT have aria-label (using sr-only approach instead)
      expect(element.getAttribute("aria-label")).toBeNull();
    });

    it("preserves semantic structure in sr-only copy", () => {
      const element = document.createElement("p");
      element.innerHTML = 'This has <strong>bold</strong> and <a href="/test">links</a>';
      container.appendChild(element);

      splitText(element, { type: "chars" });

      const srCopy = element.querySelector('[data-fetta-sr-copy="true"]');
      expect(srCopy).not.toBeNull();

      // Check that the sr-only copy preserves the anchor with href
      const srAnchor = srCopy?.querySelector("a");
      expect(srAnchor).not.toBeNull();
      expect(srAnchor?.getAttribute("href")).toBe("/test");

      // Check that strong is preserved
      const srStrong = srCopy?.querySelector("strong");
      expect(srStrong).not.toBeNull();
    });

    it("removes aria-label on revert for simple text", () => {
      const element = document.createElement("p");
      element.textContent = "Hello";
      container.appendChild(element);

      const result = splitText(element);

      expect(element.getAttribute("aria-label")).toBe("Hello");

      result.revert();

      expect(element.getAttribute("aria-label")).toBeNull();
    });

    it("removes visual wrapper and sr-copy on revert for nested elements", () => {
      const element = document.createElement("p");
      element.innerHTML = 'Click <a href="/link">here</a>';
      container.appendChild(element);

      const result = splitText(element, { type: "words" });

      // Verify structures exist before revert
      expect(element.querySelector('[data-fetta-visual="true"]')).not.toBeNull();
      expect(element.querySelector('[data-fetta-sr-copy="true"]')).not.toBeNull();

      result.revert();

      // After revert, accessibility structures should be removed (replaced by original HTML)
      expect(element.querySelector('[data-fetta-visual="true"]')).toBeNull();
      expect(element.querySelector('[data-fetta-sr-copy="true"]')).toBeNull();

      // Original HTML should be restored
      const anchor = element.querySelector("a");
      expect(anchor).not.toBeNull();
      expect(anchor?.getAttribute("href")).toBe("/link");
      expect(anchor?.textContent).toBe("here");
    });

    it("injects sr-only styles into document head", () => {
      const element = document.createElement("p");
      element.innerHTML = 'Text with <em>emphasis</em>';
      container.appendChild(element);

      splitText(element, { type: "words" });

      // Check that styles were injected
      const styleElements = document.querySelectorAll("style");
      const fettaStyle = Array.from(styleElements).find(
        (s) => s.textContent?.includes("fetta-sr-only")
      );
      expect(fettaStyle).not.toBeNull();
    });
  });

  describe("data attributes", () => {
    it("adds data-index to each character", () => {
      const element = document.createElement("p");
      element.textContent = "Hi";
      container.appendChild(element);

      const result = splitText(element, { type: "chars" });

      expect(result.chars[0].dataset.index).toBe("0");
      expect(result.chars[1].dataset.index).toBe("1");
    });

    it("adds data-index to each word", () => {
      const element = document.createElement("p");
      element.textContent = "Hello World";
      container.appendChild(element);

      const result = splitText(element, { type: "words" });

      expect(result.words[0].dataset.index).toBe("0");
      expect(result.words[1].dataset.index).toBe("1");
    });
  });

  describe("propIndex option", () => {
    it("adds CSS custom properties when propIndex is true", () => {
      const element = document.createElement("p");
      element.textContent = "Hi";
      container.appendChild(element);

      const result = splitText(element, { type: "chars", propIndex: true });

      expect(result.chars[0].style.getPropertyValue("--char-index")).toBe("0");
      expect(result.chars[1].style.getPropertyValue("--char-index")).toBe("1");
    });
  });

  describe("willChange option", () => {
    it("adds will-change property when willChange is true", () => {
      const element = document.createElement("p");
      element.textContent = "Hi";
      container.appendChild(element);

      const result = splitText(element, { type: "chars", willChange: true });

      result.chars.forEach((char) => {
        expect(char.style.willChange).toBe("transform, opacity");
      });
    });
  });

  describe("onSplit callback", () => {
    it("calls onSplit with split elements", () => {
      const element = document.createElement("p");
      element.textContent = "Hello";
      container.appendChild(element);

      const onSplit = vi.fn();

      splitText(element, { type: "chars", onSplit });

      expect(onSplit).toHaveBeenCalledTimes(1);
      expect(onSplit).toHaveBeenCalledWith(
        expect.objectContaining({
          chars: expect.any(Array),
          words: expect.any(Array),
          lines: expect.any(Array),
        })
      );
    });
  });

  describe("revertOnComplete", () => {
    it("reverts after animation promise resolves", async () => {
      const element = document.createElement("p");
      element.textContent = "Hello";
      container.appendChild(element);

      const animationPromise = Promise.resolve();

      splitText(element, {
        type: "chars",
        onSplit: () => ({ finished: animationPromise }),
        revertOnComplete: true,
      });

      // Wait for promise to resolve and revert to happen
      await animationPromise;
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Should be reverted to original
      expect(element.textContent).toBe("Hello");
    });
  });

  describe("type validation", () => {
    it("warns and defaults when invalid type is provided", () => {
      const element = document.createElement("p");
      element.textContent = "Hello";
      container.appendChild(element);

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = splitText(element, { type: "" as "chars" });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("type must include at least one of")
      );

      // Should default to chars,words,lines
      expect(result.chars.length).toBeGreaterThan(0);
      expect(result.words.length).toBeGreaterThan(0);
      expect(result.lines.length).toBeGreaterThan(0);

      consoleSpy.mockRestore();
    });
  });
});
