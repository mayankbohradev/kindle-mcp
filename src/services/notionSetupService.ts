import { Client } from "@notionhq/client";
import { getLocalDatabaseId, saveLocalDatabaseId } from "./configService.js";

const DB_TITLE = "Kindle Book Summaries";

export class NotionSetupRequiredError extends Error {
  constructor() {
    super("NOTION_SETUP_REQUIRED");
    this.name = "NotionSetupRequiredError";
  }
}

async function findExistingDatabase(notion: Client): Promise<string | null> {
  const response = await notion.search({
    query: DB_TITLE,
    filter: { value: "database", property: "object" },
    page_size: 10,
  });

  const match = response.results.find(
    (r) =>
      r.object === "database" &&
      "title" in r &&
      r.title
        .map((t) => ("plain_text" in t ? t.plain_text : ""))
        .join("")
        .trim() === DB_TITLE
  );

  return match ? match.id : null;
}

async function findParentPage(notion: Client): Promise<string | null> {
  const response = await notion.search({
    filter: { value: "page", property: "object" },
    page_size: 1,
  });
  return response.results.length > 0 ? response.results[0].id : null;
}

async function createDatabase(notion: Client): Promise<string> {
  const parentPageId = await findParentPage(notion);

  if (!parentPageId) {
    throw new NotionSetupRequiredError();
  }

  const database = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId },
    title: [{ type: "text", text: { content: DB_TITLE } }],
    properties: {
      Name: { title: {} },
      Author: { rich_text: {} },
      Title: { rich_text: {} },
    },
  });

  return database.id;
}

export async function resolveNotionDatabaseId(): Promise<string> {
  // 1. Explicit env var always wins
  if (process.env.NOTION_DATABASE_ID) {
    return process.env.NOTION_DATABASE_ID;
  }

  // 2. Saved from a previous auto-setup
  const saved = getLocalDatabaseId();
  if (saved) return saved;

  // 3. Auto-setup: find existing or create new
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    throw new Error(
      "NOTION_API_KEY is not set. Add it to your Claude Desktop MCP env config."
    );
  }

  const notion = new Client({ auth: apiKey });

  let databaseId = await findExistingDatabase(notion);

  if (!databaseId) {
    databaseId = await createDatabase(notion);
  }

  saveLocalDatabaseId(databaseId);
  return databaseId;
}
