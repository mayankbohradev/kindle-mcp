import { z } from "zod";
import { ParsedClippings, KindleHighlight } from "../types/index.js";

export const ParseKindleClippingsInputSchema = z.object({
  rawText: z.string().min(1, "rawText must not be empty"),
});

export type ParseKindleClippingsInput = z.infer<
  typeof ParseKindleClippingsInputSchema
>;

// ─── Format detection ────────────────────────────────────────────────────────

function isHtmlExport(text: string): boolean {
  const head = text.trimStart().slice(0, 200).toLowerCase();
  return head.includes("<!doctype") || head.includes("<html") || head.includes('class="booktitle"');
}

// ─── HTML entity decoder (no external deps) ──────────────────────────────────

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

function extractFirstDivByClass(html: string, className: string): string {
  const regex = new RegExp(
    `<div[^>]+class="${className}"[^>]*>([\\s\\S]*?)<\\/div>`,
    "i"
  );
  const match = html.match(regex);
  return match ? decodeHtmlEntities(match[1].trim()) : "";
}

// ─── HTML export parser ───────────────────────────────────────────────────────
// Handles the Kindle app "Export Notebook" HTML format.
// Each highlight is a .noteHeading/.noteText pair.
// Bookmarks ("Marcador" / "Bookmark") have no text and are skipped.

function parseHtmlExport(html: string): ParsedClippings {
  const title = extractFirstDivByClass(html, "bookTitle");
  const author = extractFirstDivByClass(html, "authors");

  if (!title) return { books: [] };

  // Pull all noteHeading+noteText pairs in document order
  const pairRegex =
    /<div[^>]+class="noteHeading"[^>]*>([\s\S]*?)<\/div>\s*(?:<div[^>]+class="noteText"[^>]*>([\s\S]*?)<\/div>)?/gi;

  const highlights: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = pairRegex.exec(html)) !== null) {
    const heading = decodeHtmlEntities(match[1] ?? "").trim();
    const noteText = decodeHtmlEntities(match[2] ?? "").trim();

    // Skip bookmarks — they have no extractable highlight text
    const isBoomark =
      /marcador|bookmark/i.test(heading) || noteText.length === 0;
    if (isBoomark) continue;

    highlights.push(noteText);
  }

  if (highlights.length === 0) return { books: [] };

  return { books: [{ title, author: author || "Unknown Author", highlights }] };
}

// ─── Plain-text My Clippings.txt parser ──────────────────────────────────────

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

  const bookMap = new Map<string, KindleHighlight>();

  for (const clipping of clippings) {
    const lines = clipping
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 3) continue;

    const headerLine = lines[0];
    // lines[1] is metadata (location, date) — skip
    const highlightText = lines.slice(2).join(" ").trim();

    if (!highlightText) continue;

    const { title, author } = parseAuthorAndTitle(headerLine);
    const key = normalizeKey(title, author);

    if (!bookMap.has(key)) {
      bookMap.set(key, { title, author, highlights: [] });
    }

    bookMap.get(key)!.highlights.push(highlightText);
  }

  return { books: Array.from(bookMap.values()) };
}

// ─── Public entry point ───────────────────────────────────────────────────────

export function parseKindleClippings(
  input: ParseKindleClippingsInput
): ParsedClippings {
  const { rawText } = ParseKindleClippingsInputSchema.parse(input);
  return isHtmlExport(rawText)
    ? parseHtmlExport(rawText)
    : parsePlainTextClippings(rawText);
}
