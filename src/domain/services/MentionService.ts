const MENTION_REGEX = /@([a-z0-9-]+)/g;

export function normalizeMention(mention: string): string | null {
  if (!mention || typeof mention !== "string") return null;

  const normalized = mention
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .substring(0, 40);

  return validateMention(normalized) ? normalized : null;
}

export function validateMention(mention: string): boolean {
  if (!mention || typeof mention !== "string") return false;
  return /^[a-z0-9-]{1,40}$/.test(mention);
}

export function extractMentionsFromText(text: string): string[] {
  if (!text || typeof text !== "string") return [];

  const mentionSet = new Set<string>();
  const matches = text.matchAll(MENTION_REGEX);
  for (const match of matches) {
    const normalized = normalizeMention(match[1]);
    if (normalized) {
      mentionSet.add(normalized);
    }
  }

  return Array.from(mentionSet);
}
