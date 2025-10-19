import compactEmojis from "emojibase-data/en/compact.json";
import Fuse from "fuse.js";

const emojiSet = new Set(compactEmojis.map((emoji) => emoji.unicode));

const fuse = new Fuse(compactEmojis, {
  keys: [
    {
      name: "label",
      weight: 2,
    },
    {
      name: "shortcodes",
      weight: 1,
    },
    {
      name: "tags",
      weight: 0.7,
    },
    {
      name: "group",
      weight: 0.5,
    },
  ],
  minMatchCharLength: 2,
  threshold: 0.2,
  includeScore: true,
});

export interface EmojiSearchResult {
  unicode: string;
  label: string;
  score?: number;
}

/**
 * Search emojis by query string using fuzzy search
 *
 * @param _query - Search query (e.g., "wellness", "run", "work")
 * @returns Array of matching emojis with their labels and scores
 */
export const searchEmoji = (_query: string): EmojiSearchResult[] => {
  const query = _query.toLowerCase().trim();

  if (!query) {
    return [];
  }

  const results = fuse.search(query);

  return results.map((result) => ({
    unicode: result.item.unicode,
    label: result.item.label,
    score: result.score,
  }));
};

/**
 * Check if text starts with an emoji
 *
 * @param text - Text to check
 * @returns True if text starts with an emoji
 */
export function startsWithEmoji(text: string): boolean {
  if (text.length === 0) return false;

  // Check if the first two characters form an emoji
  if (emojiSet.has(text.slice(0, 2))) return true;

  // Check if the first character is an emoji
  return emojiSet.has(text[0]);
}

/**
 * Extract the leading emoji if it exists
 *
 * @param text - Text to extract emoji from
 * @returns Object with emoji and remaining text
 */
export function extractLeadingEmoji(text: string): {
  emoji: string | null;
  remainingText: string;
} {
  if (!startsWithEmoji(text)) {
    return { emoji: null, remainingText: text };
  }

  if (emojiSet.has(text.slice(0, 2))) {
    return { emoji: text.slice(0, 2), remainingText: text.slice(2).trim() };
  }

  return { emoji: text[0], remainingText: text.slice(1).trim() };
}

/**
 * Get a suggested emoji for an area name
 * Returns the best match or null if no good match found
 *
 * @param name - Area name (e.g., "Wellness", "Work")
 * @returns Suggested emoji or null
 */
export function suggestEmojiForAreaName(name: string): string | null {
  const results = searchEmoji(name);

  if (results.length === 0) {
    return null;
  }

  // Return the best match (first result has best score)
  return results[0].unicode;
}
