import { useCallback, useRef, useState } from "react";
import { use$ } from "@legendapp/state/react";
import { normalizeTag } from "@/domain/entities/Moment";
import { allTags$ } from "@/infrastructure/state/store";

interface UseTagExtractionProps {
  inputRef: React.RefObject<HTMLInputElement | null>;
  onTagsChange: (tags: string[]) => void;
  onNameChange: (name: string) => void;
}

interface UseTagExtractionResult {
  isTagAutocompleteOpen: boolean;
  currentTagSearch: string;
  handleNameChange: (newValue: string, currentName: string, currentTags: string[]) => void;
  handleNameBlur: (currentName: string, currentTags: string[]) => void;
  addTag: (tag: string, currentName: string, currentTags: string[]) => void;
  extractRemainingTags: (currentName: string, currentTags: string[]) => void;
  setIsTagAutocompleteOpen: (open: boolean) => void;
  setCurrentTagSearch: (search: string) => void;
}

/**
 * useTagExtraction - Reusable hook for inline tag extraction from text input
 *
 * Features:
 * - Detects #tag patterns in input
 * - Shows autocomplete while typing
 * - Extracts tags on space/comma
 * - Extracts remaining tags on blur/save
 * - Manages cursor position after extraction
 */
export function useTagExtraction({
  inputRef,
  onTagsChange,
  onNameChange,
}: UseTagExtractionProps): UseTagExtractionResult {
  const [isTagAutocompleteOpen, setIsTagAutocompleteOpen] = useState(false);
  const [currentTagSearch, setCurrentTagSearch] = useState("");

  const allExistingTags = use$(allTags$);

  // Helper: Extract current tag being typed (if any)
  const extractCurrentTag = useCallback((text: string, cursorPos: number): string | null => {
    // Find the last # before cursor position
    const beforeCursor = text.slice(0, cursorPos);
    const lastHashIndex = beforeCursor.lastIndexOf("#");

    if (lastHashIndex === -1) return null;

    // Extract text after # until cursor
    const afterHash = beforeCursor.slice(lastHashIndex + 1);

    // Check if there's a space after # (which would end the tag)
    if (afterHash.includes(" ")) return null;

    return afterHash;
  }, []);

  // Helper: Add tag from autocomplete or manual typing
  const addTag = useCallback((tag: string, currentName: string, currentTags: string[]) => {
    const normalized = normalizeTag(tag);
    if (!normalized || currentTags.includes(normalized)) return;

    // Add to tags array
    onTagsChange([...currentTags, normalized]);

    // Remove #tag from name input
    const input = inputRef.current;
    if (!input) return;

    const cursorPos = input.selectionStart || 0;
    const beforeCursor = currentName.slice(0, cursorPos);
    const afterCursor = currentName.slice(cursorPos);

    // Find and remove the #tag pattern
    const lastHashIndex = beforeCursor.lastIndexOf("#");
    if (lastHashIndex !== -1) {
      const beforeTag = beforeCursor.slice(0, lastHashIndex);
      const newValue = (beforeTag + afterCursor).replace(/\s+/g, " ").trim();
      onNameChange(newValue);

      // Set cursor position after removal
      setTimeout(() => {
        input.setSelectionRange(beforeTag.length, beforeTag.length);
        input.focus();
      }, 0);
    }

    // Close autocomplete
    setIsTagAutocompleteOpen(false);
    setCurrentTagSearch("");
  }, [inputRef, onNameChange, onTagsChange]);

  // Helper: Check if user just finished typing a tag (space/comma after #tag)
  const checkForCompletedTag = useCallback((text: string, cursorPos: number, currentName: string, currentTags: string[]) => {
    const beforeCursor = text.slice(0, cursorPos);

    // Check if we just typed space or comma after a tag
    const lastChar = beforeCursor[beforeCursor.length - 1];
    if (lastChar !== " " && lastChar !== ",") return;

    // Look for #tag pattern before the space/comma
    const tagMatch = beforeCursor.match(/#([a-z0-9-]+)\s*$/);
    if (tagMatch) {
      const tag = tagMatch[1];
      addTag(tag, currentName, currentTags);
    }
  }, [addTag]);

  // Helper: Extract any remaining #tags from name before saving
  const extractRemainingTags = useCallback((currentName: string, currentTags: string[]) => {
    const tagRegex = /#([a-z0-9-]+)/g;
    const extractedTags: string[] = [];

    let match: RegExpExecArray | null = tagRegex.exec(currentName);
    while (match !== null) {
      const tag = normalizeTag(match[1]);
      if (tag && !currentTags.includes(tag) && !extractedTags.includes(tag)) {
        extractedTags.push(tag);
      }
      match = tagRegex.exec(currentName);
    }

    // If we found tags, add them and clean the name
    if (extractedTags.length > 0) {
      onTagsChange([...currentTags, ...extractedTags]);
      const cleanName = currentName.replace(tagRegex, "").replace(/\s+/g, " ").trim();
      onNameChange(cleanName);
    }
  }, [onNameChange, onTagsChange]);

  // Handle name input change - detect tags for autocomplete and extraction
  const handleNameChange = useCallback((newValue: string, currentName: string, currentTags: string[]) => {
    onNameChange(newValue);

    const input = inputRef.current;
    if (!input) return;

    const cursorPos = input.selectionStart || 0;

    // Check if user completed a tag (typed space/comma after #tag)
    if (newValue.length > currentName.length) {
      checkForCompletedTag(newValue, cursorPos, currentName, currentTags);
    }

    // Check for active tag being typed (for autocomplete)
    const currentTag = extractCurrentTag(newValue, cursorPos);

    if (currentTag !== null && currentTag.length > 0) {
      // User is typing a tag - set search value
      setCurrentTagSearch(currentTag);

      // Only open autocomplete if there are matching tags
      const hasMatches = allExistingTags.some((tag) =>
        tag.toLowerCase().includes(currentTag.toLowerCase())
      );
      setIsTagAutocompleteOpen(hasMatches);
    } else {
      // Not typing a tag
      setIsTagAutocompleteOpen(false);
      setCurrentTagSearch("");
    }
  }, [inputRef, onNameChange, extractCurrentTag, checkForCompletedTag, allExistingTags]);

  // Handle blur - extract remaining tags
  const handleNameBlur = useCallback((currentName: string, currentTags: string[]) => {
    // On blur, close tag autocomplete
    setIsTagAutocompleteOpen(false);

    // Check for any tags in the name to extract
    extractRemainingTags(currentName, currentTags);
  }, [extractRemainingTags]);

  return {
    isTagAutocompleteOpen,
    currentTagSearch,
    handleNameChange,
    handleNameBlur,
    addTag,
    extractRemainingTags,
    setIsTagAutocompleteOpen,
    setCurrentTagSearch,
  };
}
