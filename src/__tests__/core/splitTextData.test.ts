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

function countElements(
  nodes: SplitTextDataNode[],
  predicate: (node: SplitTextDataNode) => boolean
): number {
  let count = 0;
  walkNodes(nodes, (node) => {
    if (predicate(node)) count += 1;
  });
  return count;
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

  it("keeps explicit <br> boundaries in serialized split output", () => {
    const element = document.createElement("h1");
    element.innerHTML = "First<br>Second";
    container.appendChild(element);

    const data = splitTextData(element, { type: "words" });

    const hasBreak = hasElement(
      data.nodes,
      (node) => node.type === "element" && node.tag === "br"
    );

    expect(hasBreak).toBe(true);
  });

  it("creates separate serialized line nodes for block boundaries", () => {
    const element = document.createElement("h1");
    element.innerHTML =
      '<span style="display:block">Line one</span><span style="display:block">Line two</span>';
    container.appendChild(element);

    const data = splitTextData(element, { type: "chars,lines", mask: "chars" });
    const lineCount = countElements(
      data.nodes,
      (node) => node.type === "element" && node.split === "line"
    );

    expect(lineCount).toBe(2);
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
