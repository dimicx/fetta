import { describe, it, expect, beforeEach } from "vitest";
import { splitTextData, SplitTextDataNode } from "../../core/splitText";

function walkNodes(
  nodes: SplitTextDataNode[],
  visit: (node: SplitTextDataNode) => void
): void {
  for (const node of nodes) {
    visit(node);
    if (node.type === "element") {
      walkNodes(node.children, visit);
    }
  }
}

function hasElement(
  nodes: SplitTextDataNode[],
  predicate: (node: SplitTextDataNode) => boolean
): boolean {
  let found = false;
  walkNodes(nodes, (node) => {
    if (found) return;
    if (predicate(node)) found = true;
  });
  return found;
}

describe("splitTextData", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("serializes chars and lines with split roles", () => {
    const element = document.createElement("p");
    element.textContent = "Hello World";
    container.appendChild(element);

    const data = splitTextData(element, { type: "chars,lines", mask: "lines" });

    const hasChars = hasElement(
      data.nodes,
      (node) => node.type === "element" && node.split === "char"
    );
    const hasLines = hasElement(
      data.nodes,
      (node) => node.type === "element" && node.split === "line"
    );

    expect(hasChars).toBe(true);
    expect(hasLines).toBe(true);
  });

  it("preserves nested inline elements in the serialized tree", () => {
    const element = document.createElement("p");
    element.innerHTML = 'Click <a href="/link">here</a>';
    container.appendChild(element);

    const data = splitTextData(element, { type: "chars,words" });

    const hasAnchor = hasElement(
      data.nodes,
      (node) =>
        node.type === "element" &&
        node.tag === "a" &&
        node.attrs.href === "/link"
    );

    expect(hasAnchor).toBe(true);
  });

  it("includes mask wrappers with overflow: clip", () => {
    const element = document.createElement("p");
    element.textContent = "Hello World";
    container.appendChild(element);

    const data = splitTextData(element, { type: "lines", mask: "lines" });

    const hasMaskWrapper = hasElement(data.nodes, (node) => {
      if (node.type !== "element") return false;
      const style = node.attrs.style;
      return typeof style === "string" && style.includes("overflow: clip");
    });

    expect(hasMaskWrapper).toBe(true);
  });

  it("restores original HTML/ARIA/style after serialization", () => {
    const element = document.createElement("h1");
    element.innerHTML = "Original <em>HTML</em>";
    element.setAttribute("aria-label", "Original label");
    element.setAttribute("style", "color: red;");
    container.appendChild(element);

    const originalHTML = element.innerHTML;
    const originalAria = element.getAttribute("aria-label");
    const originalStyle = element.getAttribute("style");

    splitTextData(element, { type: "chars,words" });

    expect(element.innerHTML).toBe(originalHTML);
    expect(element.getAttribute("aria-label")).toBe(originalAria);
    expect(element.getAttribute("style")).toBe(originalStyle);
  });
});
