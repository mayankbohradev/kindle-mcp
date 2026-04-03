import { z } from "zod";
import { GeneratePersonalSummaryInput } from "../types/index.js";

export const GeneratePersonalSummaryInputSchema = z.object({
  title: z.string().min(1, "title must not be empty"),
  author: z.string().min(1, "author must not be empty"),
  highlights: z
    .array(z.string().min(1))
    .min(1, "highlights must contain at least one item"),
});

export type GeneratePersonalSummaryToolInput = z.infer<
  typeof GeneratePersonalSummaryInputSchema
>;

const SYSTEM_PROMPT = `You are a personal reading memory assistant.
Your ONLY source of information is the highlights provided — do not use any external knowledge about the book, author, or subject matter.
Analyze the highlights strictly as written and produce the summary.
Respond with a single valid JSON object matching the output_schema exactly. No prose, no markdown, no code fences.`;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    personal_thesis: {
      type: "string",
      description:
        "One sentence capturing the core argument or insight that emerges from the highlights as a whole.",
    },
    core_themes: {
      type: "array",
      items: { type: "string" },
      description: "3–5 recurring themes or concepts found across the highlights.",
    },
    key_ideas: {
      type: "array",
      items: { type: "string" },
      description: "5–8 distinct ideas or insights drawn directly from the highlights.",
    },
    actionable_takeaways: {
      type: "array",
      items: { type: "string" },
      description: "3–5 concrete actions or practices implied by the highlights.",
    },
    reflection_questions: {
      type: "array",
      items: { type: "string" },
      description: "3–5 thought-provoking questions the highlights raise for the reader.",
    },
    memory_capsule: {
      type: "string",
      description:
        "A 3–4 sentence paragraph distilling the essence of all highlights into a memorable personal narrative.",
    },
  },
  required: [
    "personal_thesis",
    "core_themes",
    "key_ideas",
    "actionable_takeaways",
    "reflection_questions",
    "memory_capsule",
  ],
};

export interface PromptPackage {
  system_prompt: string;
  user_prompt: string;
  output_schema: typeof OUTPUT_SCHEMA;
  instructions: string;
}

function deduplicateHighlights(highlights: string[]): string[] {
  const seen = new Set<string>();
  return highlights.filter((h) => {
    const key = h.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatHighlights(highlights: string[]): string {
  return highlights.map((h, i) => `[${i + 1}] "${h}"`).join("\n\n");
}

export function buildSummaryPromptPackage(
  input: GeneratePersonalSummaryToolInput
): PromptPackage {
  const validated = GeneratePersonalSummaryInputSchema.parse(input);
  const deduped = deduplicateHighlights(validated.highlights);
  const formattedHighlights = formatHighlights(deduped);

  const user_prompt = `Here are my Kindle highlights from "${validated.title}" by ${validated.author} (${deduped.length} highlights):\n\n${formattedHighlights}\n\nGenerate a structured personal memory summary based solely on these highlights. Respond with a JSON object matching the output_schema.`;

  return {
    system_prompt: SYSTEM_PROMPT,
    user_prompt,
    output_schema: OUTPUT_SCHEMA,
    instructions:
      "Use system_prompt as your system instruction, user_prompt as the user message, and produce a JSON object matching output_schema. Do not use any knowledge beyond the highlights provided.",
  };
}
