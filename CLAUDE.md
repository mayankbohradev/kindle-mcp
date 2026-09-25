# Kindle MCP — Project Context

## What This Is
An MCP server that parses Kindle highlight exports and returns highlights grouped by book and by highlight color. Built in Node.js + TypeScript.

It does not call an AI API and it does not write to Notion.

## Current Status
- [x] Parses Kindle notebook HTML and `My Clippings.txt`
- [x] Groups highlights by color (`yellow`, `blue`, `pink`, `orange`, or `unknown`)
- [x] Published previously as `kindle-mcp` 1.0.3 (Notion summaries). Local package version is now **2.0.0** and has not been published.

## Project Structure
```
src/
├── index.ts                         # MCP server, single tool
├── types/index.ts                   # Book + color types
└── tools/parseKindleClippings.ts    # HTML + plain text parser
```

## MCP Tool

### `parse_kindle_clippings`
- Input: `rawText` (full HTML notebook export or `My Clippings.txt`)
- Returns `{ books: [{ title, author, highlights_by_color }] }`
- HTML colors come from `class="highlight_yellow|blue|pink|orange"` or a parenthetical color word in the heading
- `My Clippings.txt` has no color, so those highlights are `unknown`
- Bookmarks and notes are skipped

## Build
```bash
npm run build
npm start
```
