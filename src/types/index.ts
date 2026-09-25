export const HIGHLIGHT_COLORS = ["yellow", "blue", "pink", "orange"] as const;

export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number] | "unknown";

export interface ColoredHighlight {
  text: string;
  color: HighlightColor;
}

export interface KindleBook {
  title: string;
  author: string;
  highlights_by_color: Partial<Record<HighlightColor, string[]>>;
}

export interface ParsedClippings {
  books: KindleBook[];
}
