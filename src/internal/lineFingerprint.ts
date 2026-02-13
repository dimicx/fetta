type LineFingerprintNode =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "element";
      children: LineFingerprintNode[];
      split?: "char" | "word" | "line";
    };

type LineFingerprintData = {
  nodes: LineFingerprintNode[];
};

export function normalizeLineFingerprintText(value: string): string {
  return value.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
}

export function collectNodeText(node: LineFingerprintNode): string {
  if (node.type === "text") return node.text;
  return node.children.map((child) => collectNodeText(child)).join("");
}

export function collectLineTextsFromData(
  nodes: LineFingerprintNode[],
  lineTexts: string[]
): void {
  for (const node of nodes) {
    if (node.type !== "element") continue;
    if (node.split === "line") {
      lineTexts.push(normalizeLineFingerprintText(collectNodeText(node)));
      continue;
    }
    collectLineTextsFromData(node.children, lineTexts);
  }
}

export function buildLineFingerprintFromData(data: LineFingerprintData): string {
  const lineTexts: string[] = [];
  collectLineTextsFromData(data.nodes, lineTexts);
  return lineTexts.join("\n");
}
