import { parse, type HTMLElement } from "node-html-parser";

const blockTags = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "br",
  "dd",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
]);

const skipTags = new Set(["script", "style", "noscript", "template", "head", "iframe", "svg"]);

type CollectState = { lines: string[]; pendingNewLine: boolean };

export function htmlToPlainText(input: string, maxLength = 50_000): string {
  if (!input) return "";
  let root: HTMLElement;
  try {
    root = parse(input);
  } catch {
    return input.slice(0, maxLength);
  }
  const state: CollectState = { lines: [], pendingNewLine: true };
  collectText(root, state);
  let text = state.lines
    .map((line) => line.replace(/\s+/gu, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
  if (text.length > maxLength) text = text.slice(0, maxLength).trimEnd();
  return text;
}

function collectText(node: HTMLElement, state: CollectState): void {
  for (const child of node.childNodes) {
    if (child.nodeType === 3) {
      const text = child.rawText
        .replace(/\u00a0/gu, " ")
        .replace(/\s+/gu, " ")
        .trim();
      if (!text) continue;
      if (state.pendingNewLine || state.lines.length === 0) {
        state.lines.push(text);
      } else {
        state.lines[state.lines.length - 1] = `${state.lines[state.lines.length - 1]!.replace(
          /\s+$/u,
          "",
        )} ${text}`;
      }
      state.pendingNewLine = false;
      continue;
    }
    if (child.nodeType !== 1) continue;
    const element = child as HTMLElement;
    const tag = element.rawTagName.toLowerCase();
    if (skipTags.has(tag)) continue;
    const wasPending = state.pendingNewLine;
    state.pendingNewLine = false;
    collectText(element, state);
    if (blockTags.has(tag) && !state.pendingNewLine) {
      state.pendingNewLine = true;
    } else {
      state.pendingNewLine = wasPending;
    }
  }
}

export function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}…`;
}
