# kindle-mcp

An MCP (Model Context Protocol) server that turns your Kindle highlights into structured personal book memory summaries saved directly to Notion.

**Zero external AI API calls.** All reasoning is performed by the host model (Claude Desktop) in its own context window. The server parses files, builds prompts, and writes to Notion — nothing else.

---

## What it does

1. You share a Kindle highlight export file in Claude Desktop
2. Claude parses your highlights, generates a personal memory summary, and saves it to your Notion database
3. You get back a Notion page URL — nothing else shown in chat

All automatic. No copy-pasting. No manual steps.

---

## Requirements

- [Claude Desktop](https://claude.ai/download)
- [Notion](https://notion.so) account
- [Node.js](https://nodejs.org) 18+ installed
- Notion MCP server running alongside this one (for first-run auto-setup)

---

## Installation

### 1. Get a Notion API key

- Go to [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
- Click **New integration** → give it a name → click **Submit**
- Copy the **Internal Integration Secret** (starts with `secret_...`)

### 2. Add to Claude Desktop config

Open your Claude Desktop config file:
- **Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Add the following inside `"mcpServers"`:

```json
"kindle-mcp": {
  "command": "npx",
  "args": ["-y", "kindle-mcp"],
  "env": {
    "NOTION_API_KEY": "secret_..."
  }
}
```

### 3. Restart Claude Desktop

Fully quit (Cmd+Q on Mac) and reopen. You should see the tools available via the hammer icon in the chat input.

---

## First-time use

On first run, the server needs a Notion page to create the **Kindle Book Summaries** database under. If you also have the [Notion MCP](https://www.notion.so/help/guides/using-notion-mcp) running, this happens **automatically** — Claude will create the page and database without asking you anything.

If you don't have the Notion MCP, create any page in Notion and connect your integration to it first:
1. Open a Notion page → click `...` top right → **Connections** → select your integration

After the first run, the database ID is saved locally at `~/.kindle-mcp/config.json` and never needs to be set up again.

---

## Usage

In Claude Desktop:

1. Attach your Kindle export file (`.html` from the Kindle app, or `My Clippings.txt` from a Kindle device)
2. Say: **"Use the process_kindle_export tool on this file"**
3. Claude processes everything and returns your Notion page URL

---

## Supported Kindle export formats

| Format | How to get it |
|---|---|
| **HTML** | Kindle app (iOS/Android/Mac) → open book → Notes → Export |
| **Plain text** | `My Clippings.txt` on Kindle device via USB |

Both formats are auto-detected — no configuration needed.

---

## Summary output structure

Each book gets a Notion page with:

| Field | Description |
|---|---|
| `personal_thesis` | One sentence capturing the core insight from your highlights |
| `core_themes` | 3–5 recurring themes |
| `key_ideas` | 5–8 distinct ideas drawn from your highlights |
| `actionable_takeaways` | 3–5 concrete actions implied by your highlights |
| `reflection_questions` | 3–5 questions your highlights raise |
| `memory_capsule` | A 3–4 sentence personal narrative distilling everything |

Summaries are generated **only from your highlights** — the model uses no external knowledge about the book.

---

## Tools

| Tool | Description |
|---|---|
| `process_kindle_export` | **Primary tool.** Parses a Kindle file and orchestrates the full flow |
| `initialize_notion_database` | Creates the Notion database on first run (called automatically) |
| `push_to_notion` | Pushes a generated summary to Notion as a structured page |
| `parse_kindle_clippings` | Parses a Kindle file and returns raw highlights grouped by book |
| `generate_personal_summary` | Builds a prompt package for the host model to generate a summary |

---

## Notion database schema

The **Kindle Book Summaries** database is created automatically with:

| Property | Type |
|---|---|
| `Name` | Title |
| `Author` | Rich Text |
| `Title` | Rich Text |

All summary content (thesis, themes, ideas, etc.) is written as page body blocks.

---

## License

MIT
