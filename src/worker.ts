import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { parseKindleClippings } from "./tools/parseKindleClippings.js";

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

  return server;
}

export default createMcpHandler(createServer);
