# kindle-mcp

An MCP server that reads a Kindle highlight export and returns the highlights grouped by book and by highlight color.

It only parses the file. It does not call an AI API and it does not write to Notion or anywhere else.

## What it does

1. You share a Kindle notebook HTML export or `My Clippings.txt` with the host model.
2. The model calls `parse_kindle_clippings` with the raw file text.
3. You get each book's highlights split into `yellow`, `blue`, `pink`, and `orange`.

Color comes from the Kindle notebook HTML export (`Highlight(<span class="highlight_yellow">yellow</span>)` and the same pattern for blue, pink, and orange). `My Clippings.txt` does not record color, so those highlights come back under `unknown`.

## Requirements

- An MCP host such as Claude Desktop or Cursor
- [Node.js](https://nodejs.org) 18+

## Installation

Add this inside `"mcpServers"`:

```json
"kindle-mcp": {
  "command": "npx",
  "args": ["-y", "kindle-mcp"]
}
```

Claude Desktop config paths:

- **Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

## Usage

Attach the Kindle file and say: **Use the parse_kindle_clippings tool on this file.**

The tool returns:

```json
{
  "books": [
    {
      "title": "Atomic Habits",
      "author": "James Clear",
      "highlights_by_color": {
        "yellow": ["You do not rise to the level of your goals."],
        "blue": ["Every action is a vote for the type of person you wish to become."]
      }
    }
  ]
}
```

Empty colors are omitted. Bookmarks and personal notes are skipped.

## Tools

| Tool | What it does |
|---|---|
| `list_kindle_books` | Lists books in your Kindle notebook, including uploaded PDFs and EPUBs |
| `get_kindle_highlights` | Fetches those highlights grouped by color. Pass a title, author, or ASIN, or omit it to fetch every book |
| `parse_kindle_clippings` | Parses a notebook HTML file or `My Clippings.txt` you already downloaded |

Highlights you make in the Kindle app on uploaded files sync to [read.amazon.com/notebook](https://read.amazon.com/notebook). `list_kindle_books` and `get_kindle_highlights` read that page. Set `KINDLE_COOKIE` to the Cookie header from a browser tab where the notebook is already signed in.

```bash
npx wrangler secret put KINDLE_COOKIE
```

If the notebook opens on `read.amazon.in`, also set `KINDLE_HOST=read.amazon.in`. The cookie expires and stays in the Worker secret, not in chat.

## Local development

```bash
npm install
npm run build
npm start
```

To point a host at a local build:

```json
"kindle-mcp": {
  "command": "/opt/homebrew/bin/node",
  "args": ["/absolute/path/to/kindle-mcp/dist/index.js"]
}
```
