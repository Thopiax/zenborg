"use client";

import { Calendar, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Schedule } from "@/domain/value-objects/Schedule";
import { type Weekday, WEEKDAY_ORDER } from "@/domain/value-objects/Schedule";
import { cn } from "@/lib/utils";

interface ScheduleSelectorProps {
  open: boolean;
  selectedSchedule: Schedule | null;
  onSelectSchedule: (schedule: Schedule | null) => void;
  onClose: () => void;
  onOpen?: () => void;
  trigger: React.ReactNode;
  collisionBoundary?: Element | null | Array<Element | null>;
}

const WEEKDAY_LABELS: Record<Weekday, string> = {
  MON: "M",
  TUE: "T",
  WED: "W",
  THU: "T",
  FRI: "F",
  SAT: "S",
  SUN: "S",
};

const WEEKDAY_FULL: Record<Weekday, string> = {
  MON: "Mon",
  TUE: "Tue",
  WED: "Wed",
  THU: "Thu",
  FRI: "Fri",
  SAT: "Sat",
  SUN: "Sun",
};

interface ScheduleDraft {
  weekdays: Weekday[];
  startTime: string;
  durationMin: number;
}

const DEFAULT_DRAFT: ScheduleDraft = {
  weekdays: [],
  startTime: "09:00",
  durationMin: 60,
};

function draftFromSchedule(schedule: Schedule): ScheduleDraft {
  return {
    weekdays: [...schedule.weekdays] as Weekday[],
    startTime: schedule.startTime,
    durationMin: schedule.durationMin,
  };
}

function isDraftValid(draft: ScheduleDraft): boolean {
  return draft.weekdays.length > 0 && draft.startTime.length > 0 && draft.durationMin > 0;
}

export function scheduleLabel(schedule: Schedule | null): string {
  if (!schedule) return "no schedule";
  const days = schedule.weekdays.map((d) => WEEKDAY_FULL[d]).join(", ");
  return `${days} ${schedule.startTime} (${schedule.durationMin}m)`;
}

export function ScheduleSelector({
  open,
  selectedSchedule,
  onSelectSchedule,
  onClose,
  onOpen,
  trigger,
  collisionBoundary,
}: ScheduleSelectorProps) {
  const [draft, setDraft] = useState<ScheduleDraft>(DEFAULT_DRAFT);

  useEffect(() => {
    if (open) {
      setDraft(selectedSchedule ? draftFromSchedule(selectedSchedule) : DEFAULT_DRAFT);
    }
  }, [open, selectedSchedule]);

  const toggleWeekday = (day: Weekday) => {
    setDraft((prev) => {
      const has = prev.weekdays.includes(day);
      const next = has
        ? prev.weekdays.filter((d) => d !== day)
        : [...prev.weekdays, day].sort(
            (a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b),
          );
      return { ...prev, weekdays: next };
    });
  };

  const handleSave = () => {
    if (isDraftValid(draft)) {
      onSelectSchedule({
        weekdays: draft.weekdays,
        startTime: draft.startTime,
        durationMin: draft.durationMin,
      });
    }
    onClose();
  };

  const handleClear = () => {
    onSelectSchedule(null);
    onClose();
  };

  return (
    <Popover
      open={open}
      onOpenChange={(isOpen) => {
        if (isOpen) {
          onOpen?.();
        } else {
          onClose();
        }
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 p-3 border-stone-200/50 dark:border-stone-700/50 shadow-sm bg-white/95 dark:bg-stone-900/95 backdrop-blur-sm"
        collisionBoundary={collisionBoundary}
        side="bottom"
        sideOffset={4}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          onClose();
        }}
      >
        <div className="flex items-center gap-1.5 mb-3">
          <Calendar className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500" />
          <span className="text-[10px] uppercase tracking-wider text-stone-400 dark:text-stone-500 font-medium">
            Schedule
          </span>
        </div>

        {/* Weekday toggles */}
        <div className="flex gap-1 mb-3">
          {WEEKDAY_ORDER.map((day) => {
            const selected = draft.weekdays.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleWeekday(day)}
                title={WEEKDAY_FULL[day]}
                className={cn(
                  "w-9 h-9 rounded text-xs font-mono transition-colors",
                  selected
                    ? "bg-stone-800 text-white dark:bg-stone-200 dark:text-stone-900"
                    : "bg-stone-100 text-stone-500 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-stone-700",
                )}
              >
                {WEEKDAY_LABELS[day]}
              </button>
            );
          })}
        </div>

        {/* Start time */}
        <div className="flex items-center gap-2 mb-3">
          <label className="text-xs font-mono text-stone-500 dark:text-stone-400 w-12">
            at
          </label>
          <input
            type="time"
            value={draft.startTime}
            step={900}
            onChange={(e) => setDraft((prev) => ({ ...prev, startTime: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.nativeEvent.stopImmediatePropagation();
                handleSave();
              }
            }}
            className="flex-1 px-2 py-1.5 bg-transparent border border-stone-300 dark:border-stone-700 rounded text-sm font-mono text-stone-700 dark:text-stone-300 focus:outline-none focus:border-stone-400 dark:focus:border-stone-500"
          />
        </div>

        {/* Duration */}
        <div className="flex items-center gap-2 mb-3">
          <label className="text-xs font-mono text-stone-500 dark:text-stone-400 w-12">
            for
          </label>
          <input
            type="number"
            min={5}
            max={480}
            step={5}
            value={draft.durationMin}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                durationMin: Math.max(5, Number(e.target.value)),
              }))
            }
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") {
                e.preventDefault();
                e.nativeEvent.stopImmediatePropagation();
                handleSave();
              }
            }}
            className="w-20 px-2 py-1.5 bg-transparent border border-stone-300 dark:border-stone-700 rounded text-sm font-mono text-stone-700 dark:text-stone-300 focus:outline-none focus:border-stone-400 dark:focus:border-stone-500"
          />
          <span className="text-xs font-mono text-stone-400 dark:text-stone-500">
            min
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-stone-200 dark:border-stone-700">
          {selectedSchedule ? (
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1 text-xs font-mono text-stone-400 dark:text-stone-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            >
              <X className="w-3 h-3" />
              clear
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDraftValid(draft)}
            className="px-3 py-1.5 rounded text-xs font-mono bg-stone-800 text-white dark:bg-stone-200 dark:text-stone-900 hover:bg-stone-900 dark:hover:bg-stone-300 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            set
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
