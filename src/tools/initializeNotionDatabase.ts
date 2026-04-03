import { z } from "zod";
import { Client } from "@notionhq/client";
import { saveLocalDatabaseId } from "../services/configService.js";

export const InitializeNotionDatabaseInputSchema = z.object({
  parentPageId: z.string().min(1, "parentPageId must not be empty"),
});

export type InitializeNotionDatabaseInput = z.infer<
  typeof InitializeNotionDatabaseInputSchema
>;

const DB_TITLE = "Kindle Book Summaries";

export async function initializeNotionDatabase(
  input: InitializeNotionDatabaseInput
): Promise<{ database_id: string; message: string }> {
  const { parentPageId } = InitializeNotionDatabaseInputSchema.parse(input);

  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    throw new Error("NOTION_API_KEY is not set.");
  }

  const notion = new Client({ auth: apiKey });

  const database = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId },
    title: [{ type: "text", text: { content: DB_TITLE } }],
    properties: {
      Name: { title: {} },
      Author: { rich_text: {} },
      Title: { rich_text: {} },
    },
  });

  saveLocalDatabaseId(database.id);

  return {
    database_id: database.id,
    message: `Database "${DB_TITLE}" created successfully. Now call process_kindle_export again with the original file to continue.`,
  };
}
