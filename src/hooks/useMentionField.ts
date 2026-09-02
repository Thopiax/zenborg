import { observable } from "@legendapp/state";
import { useObservable, useValue } from "@legendapp/state/react";
import { normalizeMention } from "@zenborg/core/domain/services/MentionService";

export interface MentionField {
  isMentionOpen: boolean;
  mentionSearch: string;
  mentionIds: string[];

  setFromInput: (value: string, cursorPos: number) => void;
  selectMention: (key: string) => { cleanedText: string };
  removeMention: (key: string) => void;
  extractRemainingMentions: (text: string) => string[];
  reset: () => void;
  reinitialize: (mentionIds: string[]) => void;
}

export function useMentionField(
  initialMentionIds: string[] = [],
): MentionField {
  const state$ = useObservable(() =>
    observable({
      mentionIds: initialMentionIds,
      autocomplete: {
        isOpen: false,
        searchValue: "",
        cursorPosition: 0,
      },
    }),
  );

  const isMentionOpen = useValue(state$.autocomplete.isOpen);
  const mentionSearch = useValue(state$.autocomplete.searchValue);
  const mentionIds = useValue(state$.mentionIds);

  const extractCurrentMention = (
    text: string,
    cursorPos: number,
  ): string | null => {
    const beforeCursor = text.slice(0, cursorPos);
    const lastAtIndex = beforeCursor.lastIndexOf("@");
    if (lastAtIndex === -1) return null;

    const afterAt = beforeCursor.slice(lastAtIndex + 1);
    if (afterAt.includes(" ")) return null;

    return afterAt;
  };

  return {
    isMentionOpen,
    mentionSearch,
    mentionIds,

    setFromInput: (value: string, cursorPos: number) => {
      state$.autocomplete.cursorPosition.set(cursorPos);

      const currentMention = extractCurrentMention(value, cursorPos);

      if (currentMention !== null && currentMention.length > 0) {
        state$.autocomplete.searchValue.set(currentMention);
        state$.autocomplete.isOpen.set(true);
      } else {
        state$.autocomplete.isOpen.set(false);
        state$.autocomplete.searchValue.set("");
      }
    },

    selectMention: (key: string) => {
      const normalized = normalizeMention(key);
      const currentIds = state$.mentionIds.peek();

      if (normalized && !currentIds.includes(normalized)) {
        state$.mentionIds.set([...currentIds, normalized]);
      }

      state$.autocomplete.isOpen.set(false);
      state$.autocomplete.searchValue.set("");

      return { cleanedText: "" };
    },

    removeMention: (key: string) => {
      const currentIds = state$.mentionIds.peek();
      state$.mentionIds.set(currentIds.filter((id) => id !== key));
    },

    extractRemainingMentions: (text: string) => {
      const matches = text.matchAll(/@([a-z0-9-]+)/g);
      const extracted: string[] = [];
      for (const match of matches) {
        const normalized = normalizeMention(match[1]);
        if (normalized) extracted.push(normalized);
      }
      return extracted;
    },

    reset: () => {
      state$.mentionIds.set([]);
      state$.autocomplete.isOpen.set(false);
      state$.autocomplete.searchValue.set("");
      state$.autocomplete.cursorPosition.set(0);
    },

    reinitialize: (newMentionIds: string[]) => {
      state$.mentionIds.set(newMentionIds);
      state$.autocomplete.isOpen.set(false);
      state$.autocomplete.searchValue.set("");
    },
  };
}
