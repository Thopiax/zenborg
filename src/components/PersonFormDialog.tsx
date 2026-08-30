"use client";

import { use$ } from "@legendapp/state/react";
import { AtSign, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EmojiPicker,
  EmojiPickerContent,
  EmojiPickerFooter,
  EmojiPickerSearch,
} from "@/components/ui/emoji-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Cadence } from "@/domain/value-objects/Cadence";
import {
  closePersonForm,
  personFormState$,
} from "@/infrastructure/state/ui-store";
import { cn } from "@/lib/utils";

const CADENCES: { value: Cadence | null; label: string }[] = [
  { value: null, label: "none" },
  { value: "weekly", label: "weekly" },
  { value: "monthly", label: "monthly" },
  { value: "quarterly", label: "quarterly" },
  { value: "yearly", label: "yearly" },
];

interface PersonFormDialogProps {
  onSave: (props: {
    name: string;
    emoji: string | null;
    aliases: string[];
    category: string | null;
    basePlace: string | null;
    cadence: Cadence | null;
    status: "active" | "paused";
  }) => void;
  onDelete?: () => void;
}

export function PersonFormDialog({ onSave, onDelete }: PersonFormDialogProps) {
  const formState = use$(personFormState$);
  const {
    open,
    mode,
    name,
    emoji,
    aliases,
    category,
    basePlace,
    cadence,
    status,
  } = formState;

  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [aliasesOpen, setAliasesOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValidationError(null);
      setEmojiPickerOpen(false);
      setAliasesOpen(false);
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setValidationError("Name cannot be empty");
      return;
    }
    onSave({
      name: trimmed,
      emoji: emoji || null,
      aliases,
      category: category?.trim() || null,
      basePlace: basePlace?.trim() || null,
      cadence,
      status,
    });
    closePersonForm();
  };

  const hotkeysEnabled = !emojiPickerOpen && !aliasesOpen && open;

  useHotkeys(
    "enter",
    (e) => {
      e.preventDefault();
      handleSave();
    },
    { enableOnFormTags: true, enabled: hotkeysEnabled },
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && closePersonForm()}>
      <DialogContent
        className="p-0 gap-0 max-w-2xl"
        onEscapeKeyDown={(e) => {
          const target = e.target as HTMLElement;
          if (target.tagName === "INPUT") {
            target.blur();
            e.preventDefault();
          } else if (name.trim().length > 0) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader className="border-b border-stone-200 dark:border-stone-700">
          <DialogTitle className="text-sm font-medium text-stone-600 dark:text-stone-400">
            {mode === "create" ? "New person" : "Edit person"}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-6 flex-1 overflow-y-auto">
          {/* Name + Emoji */}
          <div className="relative mb-6 w-full">
            <div className="flex items-baseline gap-3">
              <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="text-4xl flex-shrink-0 hover:bg-stone-100 dark:hover:bg-stone-800 rounded w-14 h-14 flex items-center justify-center transition-colors mt-1"
                    aria-label="Change emoji"
                  >
                    {emoji || "👤"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-fit p-0" align="start">
                  <EmojiPicker
                    className="h-[342px]"
                    onEmojiSelect={({ emoji: e }) => {
                      personFormState$.emoji.set(e);
                      setEmojiPickerOpen(false);
                    }}
                  >
                    <EmojiPickerSearch />
                    <EmojiPickerContent />
                    <EmojiPickerFooter />
                  </EmojiPicker>
                </PopoverContent>
              </Popover>

              <input
                ref={nameInputRef}
                type="text"
                value={name}
                onChange={(e) => personFormState$.name.set(e.target.value)}
                placeholder="Name..."
                className="flex-1 text-4xl font-bold bg-transparent text-stone-900 dark:text-stone-100 placeholder:text-stone-300 dark:placeholder:text-stone-600 focus:outline-none"
              />
            </div>
            {validationError && (
              <p className="text-sm text-red-500 dark:text-red-400 mt-2" role="alert">
                {validationError}
              </p>
            )}
          </div>

          {/* Category + Base Place */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-xs font-mono text-stone-500 dark:text-stone-400 mb-1.5">
                Category
              </label>
              <input
                type="text"
                value={category ?? ""}
                onChange={(e) => personFormState$.category.set(e.target.value || null)}
                placeholder="friends, family, lovers..."
                className="w-full px-3 py-2 text-sm font-mono bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-md text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:border-stone-400"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-stone-500 dark:text-stone-400 mb-1.5">
                Base place
              </label>
              <input
                type="text"
                value={basePlace ?? ""}
                onChange={(e) => personFormState$.basePlace.set(e.target.value || null)}
                placeholder="london, berlin..."
                className="w-full px-3 py-2 text-sm font-mono bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-md text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:border-stone-400"
              />
            </div>
          </div>

          {/* Cadence */}
          <div className="mb-6">
            <label className="block text-xs font-mono text-stone-500 dark:text-stone-400 mb-1.5">
              Cadence
            </label>
            <div className="flex gap-1">
              {CADENCES.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => personFormState$.cadence.set(c.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-sm text-xs font-mono transition-colors",
                    cadence === c.value
                      ? "bg-stone-800 dark:bg-stone-200 text-stone-100 dark:text-stone-800"
                      : "text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Aliases + Status row */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Aliases */}
            <Popover
              open={aliasesOpen}
              onOpenChange={(isOpen) => {
                if (isOpen) setAliasesOpen(true);
                else setAliasesOpen(false);
              }}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
                >
                  <AtSign className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span className="text-xs font-mono">
                    {aliases.length > 0
                      ? `${aliases.length} alias${aliases.length > 1 ? "es" : ""}`
                      : "aliases"}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-80 p-3 border-stone-200/50 dark:border-stone-700/50 shadow-sm bg-white/95 dark:bg-stone-900/95 "
              >
                <AliasesEditor
                  value={aliases}
                  onChange={(next) => personFormState$.aliases.set(next)}
                />
              </PopoverContent>
            </Popover>

            {/* Status toggle */}
            <button
              type="button"
              onClick={() =>
                personFormState$.status.set(
                  status === "active" ? "paused" : "active",
                )
              }
              className={cn(
                "px-2.5 py-1 rounded-sm text-xs font-mono transition-colors",
                status === "active"
                  ? "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400"
                  : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
              )}
            >
              {status}
            </button>
          </div>
        </div>

        <DialogFooter className="border-t border-stone-200 dark:border-stone-700 px-6 py-4">
          <div className="flex items-center justify-between w-full">
            {mode === "edit" && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="px-3 py-2 rounded-md text-xs font-mono text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                onClick={closePersonForm}
                className="px-4 py-2 rounded-sm font-mono text-sm bg-stone-200 hover:bg-stone-300 text-stone-900 dark:bg-stone-700 dark:hover:bg-stone-600 dark:text-stone-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 rounded-sm font-mono text-sm bg-stone-800 hover:bg-stone-900 text-white dark:bg-stone-200 dark:hover:bg-stone-300 dark:text-stone-900 transition-colors"
              >
                {mode === "create" ? "Create" : "Save"}
              </button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AliasesEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const commitDraft = () => {
    const trimmed = draft.trim();
    if (!trimmed || value.some((a) => a.toLowerCase() === trimmed.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, trimmed]);
    setDraft("");
  };

  return (
    <>
      <div className="flex items-center gap-1.5 mb-2">
        <AtSign className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500" />
        <span className="text-[10px] uppercase tracking-wider text-stone-400 dark:text-stone-500 font-medium">
          Aliases
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 items-center border border-stone-200 dark:border-stone-700 rounded-md px-2 py-1.5 focus-within:border-stone-400 dark:focus-within:border-stone-500">
        {value.map((alias, index) => (
          <span
            key={`${alias}-${index}`}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-xs font-mono text-stone-700 dark:text-stone-300"
          >
            {alias}
            <button
              type="button"
              onClick={() => onChange(value.filter((_, i) => i !== index))}
              className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
              aria-label={`Remove alias ${alias}`}
            >
              <X className="w-3 h-3" strokeWidth={2} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          autoCapitalize="none"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
              commitDraft();
            } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
              e.preventDefault();
              onChange(value.slice(0, -1));
            }
          }}
          placeholder={value.length === 0 ? "Add alias…" : ""}
          className="flex-1 min-w-[80px] bg-transparent text-xs font-mono text-stone-700 dark:text-stone-300 placeholder:text-stone-400 focus:outline-none"
        />
      </div>
      <p className="mt-2 text-[11px] font-mono text-stone-400 dark:text-stone-500">
        Enter to add. Alternate names that match when searching.
      </p>
    </>
  );
}
