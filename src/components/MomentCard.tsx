/** biome-ignore-all lint/a11y/useKeyWithClickEvents: <explanation> */
"use client";

import { useEffect, useRef, useState } from "react";
import type { Area } from "@/domain/entities/Area";
import type { Moment } from "@/domain/entities/Moment";
import { validateMomentName } from "@/domain/entities/Moment";
import { useVimMode } from "@/hooks/useVimMode";
import { VimMode } from "@/infrastructure/state/vim-mode";
import { getFocusRingClasses } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

interface MomentCardProps {
  moment: Moment;
  area: Area;
  isFocused: boolean;
  onFocus: () => void;
  onUpdate: (name: string) => void;
  onDelete?: () => void;
}

/**
 * MomentCard - Inline editable card for a moment
 *
 * Vim interaction flow:
 * 1. NORMAL mode: Click or navigate (j/k/w/b) to card → purple focus ring
 * 2. Press 'i' → INSERT mode enters with THIS moment's ID
 * 3. Card detects vimFocusedId === moment.id → enables inline editing
 * 4. Type to edit, Tab to cycle areas
 * 5. Enter to save / Esc to cancel → returns to NORMAL mode
 *
 * Features:
 * - Inline editing (no modals)
 * - Consistent purple focus ring (all modes)
 * - Area color on border, monospace font for Vim aesthetic
 * - Real-time validation (1-3 words)
 * - Full accessibility with ARIA labels
 */
export function MomentCard({
  moment,
  area,
  isFocused,
  onFocus,
  onUpdate,
  onDelete,
}: MomentCardProps) {
  const { mode, isInsertMode, focusedMomentId: vimFocusedId, enterNormalMode } = useVimMode();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(moment.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Enter edit mode when THIS specific moment is targeted in INSERT mode
  useEffect(() => {
    const isThisMomentTargeted = isInsertMode && vimFocusedId === moment.id;

    if (isThisMomentTargeted) {
      setIsEditing(true);
      setEditValue(moment.name);
    } else if (mode === VimMode.NORMAL) {
      setIsEditing(false);
    }
  }, [isInsertMode, vimFocusedId, mode, moment.id, moment.name]);

  // Auto-focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Focus the card div when focused
  useEffect(() => {
    if (isFocused && !isEditing && cardRef.current) {
      cardRef.current.focus();
    }
  }, [isFocused, isEditing]);

  const handleSave = () => {
    const validation = validateMomentName(editValue);
    if (validation.valid) {
      onUpdate(editValue.trim());
      setIsEditing(false);
      // Exit INSERT mode and return to NORMAL
      enterNormalMode();
    }
  };

  const handleCancel = () => {
    setEditValue(moment.name);
    setIsEditing(false);
    // Exit INSERT mode and return to NORMAL
    enterNormalMode();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isEditing) {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    }
  };

  const validation = validateMomentName(editValue);

  // Descriptive ARIA label for accessibility
  const ariaLabel = isEditing
    ? `Editing ${moment.name} in ${area.name} area`
    : `${moment.name} in ${area.name} area, press i to edit`;

  return (
    <article
      ref={cardRef}
      className={cn(
        "min-h-[56px] px-4 py-3",
        "rounded-lg border-2",
        "bg-surface transition-all",
        "focus:outline-none",
        // Mode-specific focus rings
        isFocused && !isEditing && getFocusRingClasses("normal"),
        isEditing && getFocusRingClasses("insert")
      )}
      style={{ borderColor: area.color }}
      tabIndex={isFocused && !isEditing ? 0 : -1}
      onFocus={onFocus}
      data-moment-id={moment.id}
      onClick={onFocus}
      aria-label={ariaLabel}
      aria-live={isEditing ? "polite" : "off"}
    >
      {isEditing ? (
        <div className="space-y-2">
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className={cn(
              "text-lg font-semibold bg-transparent outline-none w-full",
              "font-mono text-foreground",
              "placeholder:text-text-tertiary"
            )}
            placeholder="Moment name (1-3 words)"
            aria-label="Moment name input"
            aria-invalid={!validation.valid}
            aria-describedby={
              !validation.valid ? "moment-error" : "moment-hint"
            }
          />
          <div className="flex items-center justify-between text-xs">
            <span
              id={!validation.valid ? "moment-error" : "moment-hint"}
              className={cn(
                "font-mono",
                !validation.valid
                  ? "text-red-500 dark:text-red-400"
                  : "text-text-secondary"
              )}
              role={!validation.valid ? "alert" : "status"}
            >
              {/* {formatWordCount(wordCount)} */}
              {!validation.valid && validation.error && (
                <span className="ml-2">· {validation.error}</span>
              )}
            </span>
            <span className="flex gap-2 text-text-tertiary">
              <span>Enter to save</span>
              <span aria-hidden="true">·</span>
              <span>Esc to cancel</span>
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-hidden="true">
            {area.emoji}
          </span>
          <p className="text-lg font-semibold font-mono text-foreground">
            {moment.name}
          </p>
        </div>
      )}
    </article>
  );
}
