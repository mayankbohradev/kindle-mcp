import { z } from "zod";
import { pushSummaryToNotion } from "../services/notionService.js";
import { NotionPageResult, PushToNotionInput } from "../types/index.js";

const BookSummarySchema = z.object({
  title: z.string().optional(),
  author: z.string().optional(),
  personal_thesis: z.string().min(1),
  core_themes: z.array(z.string().min(1)).min(1),
  key_ideas: z.array(z.string().min(1)).min(1),
  actionable_takeaways: z.array(z.string().min(1)).min(1),
  reflection_questions: z.array(z.string().min(1)).min(1),
  memory_capsule: z.string().min(1),
});

export const PushToNotionInputSchema = z.object({
  notionDatabaseId: z.string().min(1, "notionDatabaseId must not be empty"),
  summary: BookSummarySchema,
});

export type PushToNotionToolInput = z.infer<typeof PushToNotionInputSchema>;

export async function pushToNotion(
  input: PushToNotionToolInput
): Promise<NotionPageResult> {
  const validated = PushToNotionInputSchema.parse(input);

  const serviceInput: PushToNotionInput = {
    notionDatabaseId: validated.notionDatabaseId,
    summary: validated.summary,
  };

  return pushSummaryToNotion(serviceInput);
}
