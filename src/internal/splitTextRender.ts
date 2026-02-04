import type { SplitTextData, SplitTextDataNode } from "../core/splitText";

export interface RenderedSplitElements {
  chars: HTMLSpanElement[];
  words: HTMLSpanElement[];
  lines: HTMLSpanElement[];
}

function renderNode(
  node: SplitTextDataNode,
  buckets: RenderedSplitElements
): Node {
  if (node.type === "text") {
    return document.createTextNode(node.text);
  }

  const element = document.createElement(node.tag);
  for (const [name, value] of Object.entries(node.attrs)) {
    element.setAttribute(name, value);
  }

  if (node.split) {
    if (element instanceof HTMLSpanElement) {
      if (node.split === "char") buckets.chars.push(element);
      if (node.split === "word") buckets.words.push(element);
      if (node.split === "line") buckets.lines.push(element);
    }
  }

  for (const child of node.children) {
    element.appendChild(renderNode(child, buckets));
  }

  return element;
}

export function renderSplitTextData(
  element: HTMLElement,
  data: SplitTextData
): RenderedSplitElements {
  const buckets: RenderedSplitElements = {
    chars: [],
    words: [],
    lines: [],
  };

  element.textContent = "";

  for (const node of data.nodes) {
    element.appendChild(renderNode(node, buckets));
  }

  return buckets;
}
