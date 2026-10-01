import type { PatternDefinition } from "../types.js";

function clip(value: string, max = 220): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export const chatgptPastePatterns: PatternDefinition[] = [
  {
    id: "chatgpt.message-author-role",
    tool: "chatgpt",
    tier: "S1",
    humanLabel: "ChatGPT message author role attribute",
    surfaces: ["live_html", "paste_html"],
    why: "Selecting text in ChatGPT’s UI can copy data-message-author-role into rich HTML.",
    match: (input) => {
      const html = input.html ?? "";
      const m = html.match(
        /data-message-author-role\s*=\s*["'][^"']+["']/i,
      );
      return m ? clip(m[0]) : null;
    },
  },
  {
    id: "chatgpt.model-slug",
    tool: "chatgpt",
    tier: "S1",
    humanLabel: "ChatGPT model slug attribute",
    surfaces: ["live_html", "paste_html"],
    why: "Paste selections may include data-message-model-slug such as gpt-4o.",
    match: (input) => {
      const html = input.html ?? "";
      const m = html.match(/data-message-model-slug\s*=\s*["'][^"']+["']/i);
      return m ? clip(m[0]) : null;
    },
  },
  {
    id: "chatgpt.provider-data",
    tool: "chatgpt",
    tier: "S1",
    humanLabel: "OpenAI/ChatGPT data attributes",
    surfaces: ["live_html", "paste_html"],
    why: "Provider-prefixed data attributes from ChatGPT markup.",
    match: (input) => {
      const html = input.html ?? "";
      const m = html.match(
        /\s(data-gpt-[\w-]+|data-openai-[\w-]+|data-chatgpt-[\w-]+)\s*=\s*["'][^"']*["']/i,
      );
      return m ? clip(m[0].trim()) : null;
    },
  },
  {
    id: "chatgpt.data-start-end",
    tool: "chatgpt",
    tier: "S1",
    humanLabel: "ChatGPT data-start/data-end selection markers",
    surfaces: ["live_html", "paste_html"],
    why: "Cross-node selections in ChatGPT sometimes include data-start and data-end. Weaker alone; stronger with other ChatGPT attrs.",
    match: (input) => {
      const html = input.html ?? "";
      const hasStart = /data-start\s*=\s*["']?\d+/i.test(html);
      const hasEnd = /data-end\s*=\s*["']?\d+/i.test(html);
      if (hasStart && hasEnd) return "data-start + data-end";
      return null;
    },
  },
];
