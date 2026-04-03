import { Client } from "@notionhq/client";
import type { BlockObjectRequest } from "@notionhq/client/build/src/api-endpoints.js";
import { NotionPageResult, PushToNotionInput } from "../types/index.js";

function buildRichText(text: string) {
  return [{ type: "text" as const, text: { content: text } }];
}

function buildBulletList(items: string[]) {
  return items.map((item) => ({
    object: "block" as const,
    type: "bulleted_list_item" as const,
    bulleted_list_item: {
      rich_text: buildRichText(item),
    },
  }));
}

function buildHeading2(text: string) {
  return {
    object: "block" as const,
    type: "heading_2" as const,
    heading_2: {
      rich_text: buildRichText(text),
    },
  };
}

function buildParagraph(text: string) {
  return {
    object: "block" as const,
    type: "paragraph" as const,
    paragraph: {
      rich_text: buildRichText(text),
    },
  };
}

function buildCallout(text: string): BlockObjectRequest {
  return {
    object: "block",
    type: "callout",
    callout: {
      rich_text: buildRichText(text),
      icon: { type: "emoji", emoji: "🧠" },
      color: "blue_background",
    },
  };
}

export async function pushSummaryToNotion(
  input: PushToNotionInput
): Promise<NotionPageResult> {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    throw new Error("NOTION_API_KEY environment variable is not set.");
  }

  const notion = new Client({ auth: apiKey });

  const { summary, notionDatabaseId } = input;
  const pageTitle = summary.title
    ? `${summary.title}${summary.author ? ` — ${summary.author}` : ""}`
    : "Kindle Book Summary";

  const children: BlockObjectRequest[] = [
    buildCallout(summary.personal_thesis),
    buildHeading2("Core Themes"),
    ...buildBulletList(summary.core_themes),
    buildHeading2("Key Ideas"),
    ...buildBulletList(summary.key_ideas),
    buildHeading2("Actionable Takeaways"),
    ...buildBulletList(summary.actionable_takeaways),
    buildHeading2("Reflection Questions"),
    ...buildBulletList(summary.reflection_questions),
    buildHeading2("Memory Capsule"),
    buildParagraph(summary.memory_capsule),
  ];

  const page = await notion.pages.create({
    parent: { database_id: notionDatabaseId },
    properties: {
      Name: {
        title: buildRichText(pageTitle),
      },
      ...(summary.author && {
        Author: {
          rich_text: buildRichText(summary.author),
        },
      }),
      ...(summary.title && {
        Title: {
          rich_text: buildRichText(summary.title),
        },
      }),
    },
    children,
  });

  return {
    id: page.id,
    url: (page as { url: string }).url,
    created_time: (page as { created_time: string }).created_time,
  };
}
