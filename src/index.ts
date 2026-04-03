import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { processKindleExport } from "./tools/processKindleExport.js";
import { parseKindleClippings } from "./tools/parseKindleClippings.js";
import { buildSummaryPromptPackage } from "./tools/generatePersonalSummary.js";
import { pushToNotion, PushToNotionToolInput } from "./tools/pushToNotion.js";
import { initializeNotionDatabase } from "./tools/initializeNotionDatabase.js";

const server = new Server(
  { name: "kindle-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "process_kindle_export",
      description:
        "PRIMARY TOOL. Given the raw content of a Kindle HTML export or My Clippings.txt file, parses all highlights and returns prompt packages plus explicit instructions. After calling this tool, you MUST follow the returned instructions exactly: generate each summary internally then immediately call push_to_notion for each book. Do not display summaries in chat — only report the Notion page URLs.",
      inputSchema: {
        type: "object",
        properties: {
          rawText: {
            type: "string",
            description:
              "Full raw content of the Kindle HTML export file or My Clippings.txt",
          },
        },
        required: ["rawText"],
      },
    },
    {
      name: "initialize_notion_database",
      description:
        "Creates the Kindle Book Summaries database in Notion under a given parent page. Call this automatically when process_kindle_export returns status='setup_required', using the page ID created by the Notion MCP tool.",
      inputSchema: {
        type: "object",
        properties: {
          parentPageId: {
            type: "string",
            description: "The Notion page ID to create the database under",
          },
        },
        required: ["parentPageId"],
      },
    },
    {
      name: "push_to_notion",
      description:
        "Push a generated book summary to a Notion database as a structured page. Call this once per book after generating each summary.",
      inputSchema: {
        type: "object",
        properties: {
          notionDatabaseId: {
            type: "string",
            description: "The Notion database ID (provided by process_kindle_export)",
          },
          summary: {
            type: "object",
            description: "The generated summary object including title and author",
            properties: {
              title: { type: "string" },
              author: { type: "string" },
              personal_thesis: { type: "string" },
              core_themes: { type: "array", items: { type: "string" } },
              key_ideas: { type: "array", items: { type: "string" } },
              actionable_takeaways: { type: "array", items: { type: "string" } },
              reflection_questions: { type: "array", items: { type: "string" } },
              memory_capsule: { type: "string" },
            },
            required: [
              "personal_thesis",
              "core_themes",
              "key_ideas",
              "actionable_takeaways",
              "reflection_questions",
              "memory_capsule",
            ],
          },
        },
        required: ["notionDatabaseId", "summary"],
      },
    },
    {
      name: "parse_kindle_clippings",
      description:
        "Parse a Kindle HTML export or My Clippings.txt and return highlights grouped by book. Use this when you only need the raw highlights without generating summaries.",
      inputSchema: {
        type: "object",
        properties: {
          rawText: {
            type: "string",
            description: "Full raw content of the Kindle file",
          },
        },
        required: ["rawText"],
      },
    },
    {
      name: "generate_personal_summary",
      description:
        "Builds a prompt package for the host model to generate a personal book memory summary from highlights alone. Use this when processing a single book manually.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          author: { type: "string" },
          highlights: { type: "array", items: { type: "string" } },
        },
        required: ["title", "author", "highlights"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "process_kindle_export": {
        const result = await processKindleExport(args as { rawText: string });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "initialize_notion_database": {
        const result = await initializeNotionDatabase(
          args as { parentPageId: string }
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "push_to_notion": {
        const result = await pushToNotion(args as PushToNotionToolInput);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "parse_kindle_clippings": {
        const result = parseKindleClippings(args as { rawText: string });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "generate_personal_summary": {
        const result = buildSummaryPromptPackage(
          args as { title: string; author: string; highlights: string[] }
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
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
