"use client";

import { Timer } from "lucide-react";
import { useMemo, useState } from "react";
import {
  type SelectorOption,
  SelectorPopover,
} from "@/components/SelectorPopover";
import type { Rhythm, RhythmPeriod } from "@zenborg/core/domain/value-objects/Rhythm";

interface RhythmSelectorProps {
  open: boolean;
  selectedRhythm: Rhythm | null;
  onSelectRhythm: (rhythm: Rhythm | null) => void;
  onClose: () => void;
  onOpen?: () => void;
  trigger: React.ReactNode;
  collisionBoundary?: Element | null | Array<Element | null>;
}

interface RhythmPreset {
  value: Rhythm | null;
  label: string;
  description: string;
  icon: string;
  hotkey: string;
  className?: string;
}

const RHYTHM_PRESETS: RhythmPreset[] = [
  {
    value: null,
    label: "No rhythm",
    description: "No declared cadence",
    icon: "○",
    hotkey: "X",
    className: "font-mono text-stone-500 dark:text-stone-400",
  },
  {
    value: { period: "weekly", count: 7 },
    label: "Daily",
    description: "Every day",
    icon: "▪▪▪▪▪▪▪",
    hotkey: "D",
    className: "font-mono text-stone-700 dark:text-stone-300",
  },
  {
    value: { period: "weekly", count: 3 },
    label: "3x / week",
    description: "Three times per week",
    icon: "▪·▪·▪··",
    hotkey: "3",
    className: "font-mono text-stone-700 dark:text-stone-300",
  },
  {
    value: { period: "weekly", count: 2 },
    label: "2x / week",
    description: "Twice per week",
    icon: "▪··▪···",
    hotkey: "2",
    className: "font-mono text-stone-700 dark:text-stone-300",
  },
  {
    value: { period: "weekly", count: 1 },
    label: "Weekly",
    description: "Once per week",
    icon: "▪······",
    hotkey: "W",
    className: "font-mono text-stone-700 dark:text-stone-300",
  },
  {
    value: { period: "biweekly", count: 1 },
    label: "Biweekly",
    description: "Once every two weeks",
    icon: "▪·",
    hotkey: "B",
    className: "font-mono text-stone-700 dark:text-stone-300",
  },
  {
    value: { period: "monthly", count: 1 },
    label: "Monthly",
    description: "Once per month",
    icon: "▪",
    hotkey: "M",
    className: "font-mono text-stone-700 dark:text-stone-300",
  },
];

function rhythmsEqual(a: Rhythm | null, b: Rhythm | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.period === b.period && a.count === b.count;
}

export function rhythmLabel(rhythm: Rhythm | null): string {
  if (!rhythm) return "no rhythm";
  const preset = RHYTHM_PRESETS.find((p) => rhythmsEqual(p.value, rhythm));
  if (preset) return preset.label.toLowerCase();
  return `${rhythm.count}x / ${rhythm.period}`;
}

export function rhythmIcon(rhythm: Rhythm | null): string {
  if (!rhythm) return "○";
  const preset = RHYTHM_PRESETS.find((p) => rhythmsEqual(p.value, rhythm));
  return preset?.icon ?? "▪";
}

function CustomRhythmEditor({
  value,
  onChange,
}: {
  value: Rhythm;
  onChange: (r: Rhythm) => void;
}) {
  const PERIODS: { value: RhythmPeriod; label: string }[] = [
    { value: "weekly", label: "week" },
    { value: "biweekly", label: "2 weeks" },
    { value: "monthly", label: "month" },
    { value: "quarterly", label: "quarter" },
    { value: "annually", label: "year" },
  ];

  return (
    <div className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-300">
      <input
        type="number"
        min={0.1}
        max={31}
        step="any"
        value={value.count}
        onChange={(e) =>
          onChange({
            ...value,
            count: Math.max(0.1, Number(e.target.value)),
          })
        }
        onKeyDown={(e) => e.stopPropagation()}
        className="w-14 px-2 py-1 bg-transparent border border-stone-300 dark:border-stone-700 rounded text-sm font-mono"
      />
      <span className="text-stone-400">per</span>
      <select
        value={value.period}
        onChange={(e) =>
          onChange({ ...value, period: e.target.value as RhythmPeriod })
        }
        className="px-2 py-1 bg-transparent border border-stone-300 dark:border-stone-700 rounded text-sm font-mono"
      >
        {PERIODS.map(({ value: v, label }) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function RhythmSelector({
  open,
  selectedRhythm,
  onSelectRhythm,
  onClose,
  onOpen,
  trigger,
  collisionBoundary,
}: RhythmSelectorProps) {
  const [customMode, setCustomMode] = useState(false);
  const [customDraft, setCustomDraft] = useState<Rhythm>({
    period: "weekly",
    count: 1,
  });

  const isCustom =
    selectedRhythm !== null &&
    !RHYTHM_PRESETS.some((p) => rhythmsEqual(p.value, selectedRhythm));

  const options: SelectorOption<Rhythm | null>[] = useMemo(
    () =>
      RHYTHM_PRESETS.map((preset) => ({
        value: preset.value,
        label: preset.label,
        description: preset.description,
        icon: preset.icon,
        hotkey: preset.hotkey,
        className: preset.className,
      })),
    [],
  );

  const handleSelect = (value: Rhythm | null) => {
    setCustomMode(false);
    onSelectRhythm(value);
  };

  return (
    <SelectorPopover
      open={open}
      options={options}
      selectedValue={
        isCustom
          ? undefined
          : RHYTHM_PRESETS.find((p) => rhythmsEqual(p.value, selectedRhythm))
              ?.value
      }
      onSelect={handleSelect}
      onClose={() => {
        if (customMode) {
          onSelectRhythm(customDraft);
        }
        setCustomMode(false);
        onClose();
      }}
      onOpen={() => {
        if (isCustom && selectedRhythm) {
          setCustomDraft(selectedRhythm);
        }
        onOpen?.();
      }}
      trigger={trigger}
      enableHotkeys={!customMode}
      collisionBoundary={collisionBoundary}
      actions={
        <div className="px-2">
          {customMode ? (
            <div className="flex flex-col gap-2 py-1">
              <span className="text-[10px] uppercase tracking-wider text-stone-400 dark:text-stone-500 font-medium">
                Custom rhythm
              </span>
              <CustomRhythmEditor
                value={customDraft}
                onChange={setCustomDraft}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setCustomDraft(
                  selectedRhythm ?? { period: "weekly", count: 1 },
                );
                setCustomMode(true);
              }}
              className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-mono text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              Custom...
            </button>
          )}
        </div>
      }
    />
  );
}
