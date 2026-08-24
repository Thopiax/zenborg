"use client";

import { Clock, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { snapToGrid } from "@/domain/value-objects/TimeGrid.ts";
import { updateMomentWithHistory } from "@/infrastructure/state/history-middleware";
import { cn } from "@/lib/utils";

interface MomentTimePickerProps {
  momentId: string;
  startTime?: string;
  textColorClass: string;
}

export function MomentTimePicker({
  momentId,
  startTime,
  textColorClass,
}: MomentTimePickerProps) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleOpen = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setEditing(true);
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (!raw) return;
      const snapped = snapToGrid(raw, 60);
      updateMomentWithHistory(momentId, { startTime: snapped.startTime });
      setEditing(false);
    },
    [momentId],
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      updateMomentWithHistory(momentId, {
        startTime: undefined,
      } as any);
      setEditing(false);
    },
    [momentId],
  );

  const handleBlur = useCallback(() => {
    setEditing(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setEditing(false);
      }
    },
    [],
  );

  if (editing) {
    return (
      <span
        className="flex items-center gap-0.5 flex-shrink-0 ml-auto"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="time"
          defaultValue={startTime ?? ""}
          step={900}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={cn(
            "w-[5rem] text-xs font-mono bg-transparent border-none outline-none",
            "appearance-none [&::-webkit-calendar-picker-indicator]:hidden",
            textColorClass,
          )}
        />
      </span>
    );
  }

  return (
    <span
      className="flex items-center gap-0.5 flex-shrink-0 ml-auto opacity-60 hover:opacity-100 transition-opacity"
      onClick={handleOpen}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Clock className={cn("w-3 h-3", textColorClass)} strokeWidth={1.5} />
      {startTime && (
        <>
          <span className={cn("text-xs font-mono", textColorClass)}>
            {startTime}
          </span>
          <button
            type="button"
            onClick={handleClear}
            className={cn(
              "w-3 h-3 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10",
              textColorClass,
            )}
            aria-label="Clear time"
          >
            <X className="w-2 h-2" strokeWidth={2} />
          </button>
        </>
      )}
    </span>
  );
}
