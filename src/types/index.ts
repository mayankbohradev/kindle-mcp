export interface KindleHighlight {
  title: string;
  author: string;
  highlights: string[];
}

export interface ParsedClippings {
  books: KindleHighlight[];
}

export interface BookSummary {
  personal_thesis: string;
  core_themes: string[];
  key_ideas: string[];
  actionable_takeaways: string[];
  reflection_questions: string[];
  memory_capsule: string;
}

export interface GeneratePersonalSummaryInput {
  title: string;
  author: string;
  highlights: string[];
}

export interface PushToNotionInput {
  notionDatabaseId: string;
  summary: BookSummary & {
    title?: string;
    author?: string;
  };
}

export interface NotionPageResult {
  id: string;
  url: string;
  created_time: string;
}
