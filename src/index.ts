import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { parseKindleClippings } from "./tools/parseKindleClippings.js";

const TOOL_DESCRIPTION =
  "Parse a Kindle notebook HTML export or My Clippings.txt and return highlights grouped by book, then by highlight color (yellow, blue, pink, orange). HTML notebook exports include color. My Clippings.txt has no color, so those highlights are returned under \"unknown\". This tool only reads the file. It does not write anywhere.";

const RAW_TEXT_SCHEMA = {
  type: "object" as const,
  properties: {
    rawText: {
      type: "string",
      description:
        "Full raw content of a Kindle notebook HTML export or My Clippings.txt",
    },
  },
  required: ["rawText"],
};

const server = new Server(
  { name: "kindle-mcp-server", version: "2.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "parse_kindle_clippings",
      description: TOOL_DESCRIPTION,
      inputSchema: RAW_TEXT_SCHEMA,
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name !== "parse_kindle_clippings") {
      return {
        content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    const result = parseKindleClippings(args as { rawText: string });
    if (result.books.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: "No highlights found in the provided file.",
          },
        ],
        isError: true,
      };
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text" as const, text: `Error: ${message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("Kindle MCP Server running on stdio\n");
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err.message}\n`);
  process.exit(1);
});
