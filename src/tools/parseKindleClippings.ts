import { z } from "zod";
import {
  ColoredHighlight,
  HighlightColor,
  KindleBook,
  ParsedClippings,
} from "../types/index.js";

export const ParseKindleClippingsInputSchema = z.object({
  rawText: z.string().min(1, "rawText must not be empty"),
});

export type ParseKindleClippingsInput = z.infer<
  typeof ParseKindleClippingsInputSchema
>;

const COLOR_ORDER: HighlightColor[] = [
  "yellow",
  "blue",
  "pink",
  "orange",
  "unknown",
];

const COLOR_WORDS: Record<string, HighlightColor> = {
  yellow: "yellow",
  blue: "blue",
  pink: "pink",
  orange: "orange",
  amarillo: "yellow",
  azul: "blue",
  rosa: "pink",
  naranja: "orange",
  gelb: "yellow",
  blau: "blue",
  jaune: "yellow",
  bleu: "blue",
  rose: "pink",
  amarelo: "yellow",
  laranja: "orange",
};

function isHtmlExport(text: string): boolean {
  const head = text.trimStart().slice(0, 200).toLowerCase();
  return (
    head.includes("<!doctype") ||
    head.includes("<html") ||
    head.includes('class="booktitle"')
  );
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function extractFirstDivByClass(html: string, className: string): string {
  const regex = new RegExp(
    `<div[^>]+class="${className}"[^>]*>([\\s\\S]*?)<\\/div>`,
    "i"
  );
  const match = html.match(regex);
  return match ? stripTags(match[1]) : "";
}

function normalizeColor(raw: string | undefined): HighlightColor {
  if (!raw) return "unknown";
  return COLOR_WORDS[raw.trim().toLowerCase()] ?? "unknown";
}

function extractColor(headingHtml: string): HighlightColor {
  const classMatch = headingHtml.match(/class="highlight_([a-zA-Z]+)"/i);
  if (classMatch) return normalizeColor(classMatch[1]);

  const text = stripTags(headingHtml);
  const paren = text.match(/\(\s*([a-zA-Z]+)\s*\)/);
  if (paren) return normalizeColor(paren[1]);

  return "unknown";
}

function isBookmark(headingText: string, noteText: string): boolean {
  return /marcador|bookmark/i.test(headingText) || noteText.length === 0;
}

function isHighlightHeading(headingHtml: string, headingText: string): boolean {
  if (/class="highlight_/i.test(headingHtml)) return true;
  return /highlight|subrayado|destaque|markierung|surlignage|evidenziazione/i.test(
    headingText
  );
}

function groupByColor(highlights: ColoredHighlight[]): KindleBook["highlights_by_color"] {
  const grouped: KindleBook["highlights_by_color"] = {};
  for (const highlight of highlights) {
    const bucket = grouped[highlight.color] ?? [];
    bucket.push(highlight.text);
    grouped[highlight.color] = bucket;
  }

  const ordered: KindleBook["highlights_by_color"] = {};
  for (const color of COLOR_ORDER) {
    const items = grouped[color];
    if (items && items.length > 0) ordered[color] = items;
  }
  return ordered;
}

function parseHtmlExport(html: string): ParsedClippings {
  const title = extractFirstDivByClass(html, "bookTitle");
  const author = extractFirstDivByClass(html, "authors");

  if (!title) return { books: [] };

  const pairRegex =
    /<div[^>]+class="noteHeading"[^>]*>([\s\S]*?)<\/div>\s*(?:<div[^>]+class="noteText"[^>]*>([\s\S]*?)<\/div>)?/gi;

  const highlights: ColoredHighlight[] = [];
  let match: RegExpExecArray | null;

  while ((match = pairRegex.exec(html)) !== null) {
    const headingHtml = match[1] ?? "";
    const headingText = stripTags(headingHtml);
    const noteText = stripTags(match[2] ?? "");

    if (isBookmark(headingText, noteText)) continue;
    if (!isHighlightHeading(headingHtml, headingText)) continue;

    highlights.push({ text: noteText, color: extractColor(headingHtml) });
  }

  if (highlights.length === 0) return { books: [] };

  return {
    books: [
      {
        title,
        author: author || "Unknown Author",
        highlights_by_color: groupByColor(highlights),
      },
    ],
  };
}

const CLIPPING_SEPARATOR = "==========";

function parseAuthorAndTitle(header: string): { title: string; author: string } {
  const match = header.match(/^(.+?)\s*\((.+)\)\s*$/);
  if (match) {
    return { title: match[1].trim(), author: match[2].trim() };
  }
  return { title: header.trim(), author: "Unknown Author" };
}

function normalizeKey(title: string, author: string): string {
  return `${title.toLowerCase()}|||${author.toLowerCase()}`;
}

function parsePlainTextClippings(rawText: string): ParsedClippings {
  const clippings = rawText
    .split(CLIPPING_SEPARATOR)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  const bookMap = new Map<
    string,
    { title: string; author: string; highlights: ColoredHighlight[] }
  >();

  for (const clipping of clippings) {
    const lines = clipping
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 3) continue;

    const headerLine = lines[0];
    const metaLine = lines[1];
    const highlightText = lines.slice(2).join(" ").trim();

    if (!highlightText) continue;
    if (/bookmark|marcador/i.test(metaLine) && !/highlight|subrayado|destaque|markierung|surlignage/i.test(metaLine)) {
      continue;
    }
    if (/^\s*-\s*your note\b/i.test(metaLine) || /\bnote\b/i.test(metaLine) && !/highlight/i.test(metaLine)) {
      continue;
    }

    const { title, author } = parseAuthorAndTitle(headerLine);
    const key = normalizeKey(title, author);

    if (!bookMap.has(key)) {
      bookMap.set(key, { title, author, highlights: [] });
    }

    bookMap.get(key)!.highlights.push({ text: highlightText, color: "unknown" });
  }

  return {
    books: Array.from(bookMap.values()).map((bucket) => ({
      title: bucket.title,
      author: bucket.author,
      highlights_by_color: groupByColor(bucket.highlights),
    })),
  };
}

export function parseKindleClippings(
  input: ParseKindleClippingsInput
): ParsedClippings {
  const { rawText } = ParseKindleClippingsInputSchema.parse(input);
  return isHtmlExport(rawText)
    ? parseHtmlExport(rawText)
    : parsePlainTextClippings(rawText);
}
