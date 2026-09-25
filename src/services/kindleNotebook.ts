import { parseKindleClippings } from "../tools/parseKindleClippings.js";

export interface KindleNotebookBook {
  asin: string;
  title: string;
  author: string;
}

const SETUP_MESSAGE = [
  "Kindle highlights for books you uploaded (PDF, EPUB, DOC) sync to Amazon's notebook at https://read.amazon.com/notebook.",
  "This server can read that notebook, including highlight color, once KINDLE_COOKIE is set to the Cookie header from a browser tab where that page is already signed in.",
  "On Cloudflare run: npx wrangler secret put KINDLE_COOKIE",
  "If your notebook opens on read.amazon.in, also set KINDLE_HOST=read.amazon.in",
  "The cookie is a login session. It expires, and it should stay in the Worker secret or local env, not in chat.",
].join(" ");

let sessionCookie: string | undefined;
let sessionHost: string | undefined;

export function setKindleSession(session: { cookie?: string; host?: string }): void {
  sessionCookie = session.cookie?.trim() || undefined;
  sessionHost = session.host?.trim() || undefined;
}

function cookie(): string | undefined {
  return sessionCookie || process.env.KINDLE_COOKIE?.trim() || undefined;
}

function host(): string {
  return (sessionHost || process.env.KINDLE_HOST || "read.amazon.com")
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
}

function decodeAttr(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function textOf(html: string): string {
  return decodeAttr(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

export function parseNotebookLibrary(html: string): KindleNotebookBook[] {
  const books: KindleNotebookBook[] = [];
  const chunks = html.split(/class="[^"]*kp-notebook-library-each-book[^"]*"/).slice(1);

  for (const chunk of chunks) {
    const asinAttr = chunk.match(/data-get-annotations-for-asin="([^"]+)"/i);
    if (!asinAttr) continue;
    let asin = "";
    try {
      const parsed = JSON.parse(decodeAttr(asinAttr[1])) as { asin?: string };
      asin = parsed.asin?.trim() ?? "";
    } catch {
      continue;
    }
    if (!asin) continue;

    const headings = [...chunk.matchAll(/<(h2|p)[^>]*class="[^"]*kp-notebook-searchable[^"]*"[^>]*>([\s\S]*?)<\/\1>/gi)];
    const title = headings[0] ? textOf(headings[0][2]) : "";
    let author = headings[1] ? textOf(headings[1][2]) : "Unknown Author";
    author = author.replace(/^(by|von|de)\s*:\s*/i, "").trim() || "Unknown Author";
    if (!title) continue;
    books.push({ asin, title, author });
  }

  return books;
}

function missingCookie(): string {
  return JSON.stringify({ status: "setup_required", message: SETUP_MESSAGE }, null, 2);
}

async function kindleGet(path: string): Promise<string> {
  const response = await fetch(`https://${host()}${path}`, {
    headers: {
      Cookie: cookie() ?? "",
      Accept: "text/html",
      "User-Agent": "kindle-mcp",
    },
    redirect: "manual",
  });

  if (response.status >= 300 && response.status < 400) {
    throw new Error(
      "Kindle notebook did not accept this session. Sign in at https://" +
        host() +
        "/notebook and refresh KINDLE_COOKIE."
    );
  }
  if (!response.ok) {
    throw new Error(`Kindle notebook returned HTTP ${response.status}.`);
  }
  return response.text();
}

export async function listKindleBooks(): Promise<string> {
  if (!cookie()) return missingCookie();
  const html = await kindleGet("/notebook");
  const books = parseNotebookLibrary(html);
  if (books.length === 0) {
    return JSON.stringify(
      {
        status: "empty",
        message:
          "The notebook page returned no books. Confirm you are signed in, KINDLE_HOST matches the site (read.amazon.com or read.amazon.in), and the Kindle app has synced highlights.",
      },
      null,
      2
    );
  }
  return JSON.stringify({ books }, null, 2);
}

export async function getKindleHighlights(query?: string): Promise<string> {
  if (!cookie()) return missingCookie();
  const html = await kindleGet("/notebook");
  const books = parseNotebookLibrary(html);
  const needle = query?.trim().toLowerCase();
  const selected = needle
    ? books.filter(
        (book) =>
          book.asin.toLowerCase() === needle ||
          book.title.toLowerCase().includes(needle) ||
          book.author.toLowerCase().includes(needle)
      )
    : books;

  if (selected.length === 0) {
    return JSON.stringify(
      {
        status: "not_found",
        message: needle
          ? `No notebook book matched "${query}".`
          : "The notebook has no books.",
        books: books.map(({ asin, title, author }) => ({ asin, title, author })),
      },
      null,
      2
    );
  }

  const parsed = [];
  for (const book of selected) {
    const download = await kindleGet(
      `/kp/notebook?asin=${encodeURIComponent(book.asin)}&contentLimitState=&type=download`
    );
    const withHeader = /class="bookTitle"/i.test(download)
      ? download
      : `<div class="bookTitle">${book.title}</div><div class="authors">${book.author}</div>${download}`;
    const result = parseKindleClippings({ rawText: withHeader });
    parsed.push(
      result.books[0] ?? {
        title: book.title,
        author: book.author,
        highlights_by_color: {},
      }
    );
  }

  return JSON.stringify({ books: parsed }, null, 2);
}
