"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Rhythm, RhythmPeriod } from "@/domain/value-objects/Rhythm";

interface RhythmSelectorProps {
  value: Rhythm | null;
  onChange: (rhythm: Rhythm | null) => void;
}

const PERIODS: { value: RhythmPeriod; label: string }[] = [
  { value: "weekly", label: "week" },
  { value: "biweekly", label: "2 weeks" },
  { value: "monthly", label: "month" },
  { value: "quarterly", label: "quarter" },
  { value: "annually", label: "year" },
];

export function RhythmSelector({ value, onChange }: RhythmSelectorProps) {
  const hasRhythm = value !== null;

  return (
    <div className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-300">
      <input
        type="checkbox"
        id="rhythm-on"
        checked={hasRhythm}
        onChange={(e) =>
          onChange(e.target.checked ? { period: "weekly", count: 1 } : null)
        }
        className="accent-stone-700"
      />
      <label htmlFor="rhythm-on" className="select-none">
        rhythm
      </label>

      {hasRhythm && (
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={1}
            max={31}
            value={value.count}
            onChange={(e) =>
              onChange({ ...value, count: Math.max(1, Number(e.target.value)) })
            }
            className="w-14 px-2 py-1 bg-transparent border border-stone-300 dark:border-stone-700 rounded text-sm"
          />
          <span>×</span>
          <Select
            value={value.period}
            onValueChange={(p: RhythmPeriod) =>
              onChange({ ...value, period: p })
            }
          >
            <SelectTrigger className="w-32 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map(({ value: v, label }) => (
                <SelectItem key={v} value={v}>
                  per {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
