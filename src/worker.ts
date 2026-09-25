import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod/v4";
import {
  getKindleHighlights,
  listKindleBooks,
  setKindleSession,
} from "./services/kindleNotebook.js";
import { parseKindleClippings } from "./tools/parseKindleClippings.js";

interface WorkerEnv {
  KINDLE_COOKIE?: string;
  KINDLE_HOST?: string;
}

const envStore = new AsyncLocalStorage<WorkerEnv>();

const description =
  "Parse a Kindle notebook HTML export or My Clippings.txt and return highlights grouped by book, then by highlight color (yellow, blue, pink, orange). HTML notebook exports include color. My Clippings.txt has no color, so those highlights are returned under unknown.";

function createServer() {
  const server = new McpServer({
    name: "kindle-mcp-server",
    version: "2.0.0",
  });

  server.registerTool(
    "parse_kindle_clippings",
    {
      description,
      inputSchema: z.object({
        rawText: z.string().min(1),
      }),
    },
    async ({ rawText }) => {
      const result = parseKindleClippings({ rawText });
      if (result.books.length === 0) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: "No highlights found in the provided file." }],
        };
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.registerTool(
    "list_kindle_books",
    {
      description:
        "List books in the signed-in Kindle notebook, including PDFs and EPUBs uploaded with Send to Kindle. Requires KINDLE_COOKIE on the server.",
      inputSchema: z.object({}),
    },
    async () => {
      const env = envStore.getStore();
      setKindleSession({ cookie: env?.KINDLE_COOKIE, host: env?.KINDLE_HOST });
      return { content: [{ type: "text" as const, text: await listKindleBooks() }] };
    }
  );

  server.registerTool(
    "get_kindle_highlights",
    {
      description:
        "Fetch highlights from the signed-in Kindle notebook, grouped by color. Pass a title, author, or ASIN to limit to one book. Omit query to fetch every book in the notebook. Includes highlights made in the Kindle app on uploaded PDF and EPUB files.",
      inputSchema: z.object({
        query: z.string().optional(),
      }),
    },
    async ({ query }) => {
      const env = envStore.getStore();
      setKindleSession({ cookie: env?.KINDLE_COOKIE, host: env?.KINDLE_HOST });
      return {
        content: [{ type: "text" as const, text: await getKindleHighlights(query) }],
      };
    }
  );

  return server;
}

const handler = createMcpHandler(createServer);

export default {
  fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext) {
    return envStore.run(env, () => handler.fetch(request, env, ctx));
  },
};
