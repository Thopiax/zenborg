"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Area } from "@/domain/entities/Area";
import type { CreateCycleProps, Cycle } from "@/domain/entities/Cycle";
import type { Moment } from "@/domain/entities/Moment";
import type { PhaseConfig } from "@/domain/value-objects/Phase";
import {
  deriveBandedHeatmapViewModel,
  type HeatmapViewModel,
} from "@/infrastructure/state/bandedHeatmapViewModel";
import { BandedHeatmapAxis } from "./BandedHeatmapAxis";
import { BandedHeatmapCycleBlock } from "./BandedHeatmapCycleBlock";
import { BandedHeatmapGapSegment } from "./BandedHeatmapGapSegment";
import { BandedHeatmapNeedle } from "./BandedHeatmapNeedle";
import { BandedHeatmapSelectionCursor } from "./BandedHeatmapSelectionCursor";
import {
  BRACKET_HEIGHT,
  CELL_SIZE,
  GUTTER_WIDTH,
  HEATMAP_HEIGHT,
  ROW_GAP,
  STRIDE,
  VERTICAL_PADDING,
} from "./constants";

const DRAG_THRESHOLD_PX = 4;
const KEEP_ON_SCREEN_PADDING = STRIDE * 2;

interface BandedHeatmapProps {
  cycles: Cycle[];
  moments: Moment[];
  areas: Area[];
  phaseConfigs: PhaseConfig[];
  today: string;
  selectedCycleId?: string | null;
  onCycleSelect?: (cycleId: string) => void;
  onDaySelect?: (date: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onCycleCreate?: (props: CreateCycleProps) => void;
}

export function BandedHeatmap({
  cycles,
  moments,
  areas,
  phaseConfigs,
  today,
  selectedCycleId,
  onCycleSelect,
  onDaySelect,
}: BandedHeatmapProps) {
  const vm: HeatmapViewModel = useMemo(
    () =>
      deriveBandedHeatmapViewModel({
        cycles,
        moments,
        areas,
        phaseConfigs,
        today,
      }),
    [cycles, moments, areas, phaseConfigs, today],
  );

  const areaById = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas]);

  // Phase gradient — getting darker as the day progresses, matches the
  // visual language Timeline uses for phase backgrounds (mapped to stone).
  const phaseFallowClasses: string[] = [
    "bg-stone-100 dark:bg-stone-800",
    "bg-stone-200 dark:bg-stone-700",
    "bg-stone-300 dark:bg-stone-600",
    "bg-stone-400 dark:bg-stone-500",
  ];

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startScrollLeft: number;
    moved: boolean;
  } | null>(null);

  const [selectedIndex, setSelectedIndex] = useState<number>(() =>
    vm.todayIndex >= 0 ? vm.todayIndex : 0,
  );

  useEffect(() => {
    setSelectedIndex((prev) =>
      prev < 0 || prev >= vm.days.length ? Math.max(0, vm.todayIndex) : prev,
    );
  }, [vm.days.length, vm.todayIndex]);

  useEffect(() => {
    if (selectedIndex >= 0 && selectedIndex < vm.days.length) {
      onDaySelect?.(vm.days[selectedIndex].date);
    }
  }, [selectedIndex, vm.days, onDaySelect]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || vm.todayIndex < 0) return;
    const target = vm.todayIndex * STRIDE + CELL_SIZE / 2 - el.clientWidth / 2;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.scrollLeft = Math.max(0, target);
      });
    });
  }, [vm.todayIndex, vm.days.length]);

  const ensureVisible = useCallback((index: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const cellLeft = index * STRIDE;
    const cellRight = cellLeft + CELL_SIZE;
    const viewLeft = el.scrollLeft + KEEP_ON_SCREEN_PADDING;
    const viewRight = el.scrollLeft + el.clientWidth - KEEP_ON_SCREEN_PADDING;
    if (cellLeft < viewLeft) {
      el.scrollLeft = cellLeft - KEEP_ON_SCREEN_PADDING;
    } else if (cellRight > viewRight) {
      el.scrollLeft = cellRight - el.clientWidth + KEEP_ON_SCREEN_PADDING;
    }
  }, []);

  const moveSelection = useCallback(
    (delta: number) => {
      setSelectedIndex((prev) => {
        const next = Math.max(0, Math.min(vm.days.length - 1, prev + delta));
        ensureVisible(next);
        return next;
      });
    },
    [vm.days.length, ensureVisible],
  );

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    if (e.button !== 0) return;
    dragRef.current = {
      startX: e.clientX,
      startScrollLeft: el.scrollLeft,
      moved: false,
    };
    setIsDragging(true);
    el.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const el = scrollRef.current;
    if (!drag || !el) return;
    const dx = e.clientX - drag.startX;
    if (Math.abs(dx) > DRAG_THRESHOLD_PX) drag.moved = true;
    el.scrollLeft = drag.startScrollLeft - dx;
  }, []);

  const indexFromClientX = useCallback(
    (clientX: number): number | null => {
      const el = scrollRef.current;
      if (!el) return null;
      const inner = el.firstElementChild as HTMLElement | null;
      if (!inner) return null;
      const rect = inner.getBoundingClientRect();
      const x = clientX - rect.left;
      const idx = Math.floor(x / STRIDE);
      if (idx < 0 || idx >= vm.days.length) return null;
      return idx;
    },
    [vm.days.length],
  );

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      const el = scrollRef.current;
      if (drag && !drag.moved) {
        const target = e.target as HTMLElement | null;
        const isBracket = target?.closest("button[data-cycle-bracket]");
        if (!isBracket) {
          const idx = indexFromClientX(e.clientX);
          if (idx !== null) setSelectedIndex(idx);
        }
      }
      dragRef.current = null;
      setIsDragging(false);
      if (el?.hasPointerCapture(e.pointerId)) {
        el.releasePointerCapture(e.pointerId);
      }
    },
    [indexFromClientX],
  );

  const onWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (!e.shiftKey) return;
    e.preventDefault();
    el.scrollLeft += e.deltaY;
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          moveSelection(e.shiftKey ? -7 : -1);
          break;
        case "ArrowRight":
          e.preventDefault();
          moveSelection(e.shiftKey ? 7 : 1);
          break;
        case "Home":
        case "Escape":
          e.preventDefault();
          if (vm.todayIndex >= 0) {
            setSelectedIndex(vm.todayIndex);
            ensureVisible(vm.todayIndex);
          }
          break;
      }
    },
    [moveSelection, vm.todayIndex, ensureVisible],
  );

  const totalWidth = vm.days.length * STRIDE;
  const segmentRowHeight = BRACKET_HEIGHT + CELL_SIZE * 3 + ROW_GAP * 2;

  return (
    <div
      className="relative bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-md select-none font-sans"
      style={{
        height: HEATMAP_HEIGHT,
        padding: `${VERTICAL_PADDING}px ${GUTTER_WIDTH}px`,
        boxSizing: "border-box",
      }}
    >
      <div
        ref={scrollRef}
        tabIndex={0}
        className={`relative overflow-x-auto overflow-y-hidden [scrollbar-width:thin] outline-none focus-visible:ring-1 focus-visible:ring-stone-400 ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
      >
        <div
          className="relative"
          style={{
            width: totalWidth,
            minWidth: totalWidth,
            touchAction: "pan-x",
          }}
        >
          <div className="flex px-2" style={{ height: segmentRowHeight }}>
            {vm.segments.map((seg) => {
              const segDays = vm.days.slice(seg.startIndex, seg.endIndex + 1);
              if (seg.band) {
                return (
                  <BandedHeatmapCycleBlock
                    key={`cycle-${seg.band.cycleId}-${seg.startIndex}`}
                    band={seg.band}
                    days={segDays}
                    rows={vm.rows}
                    areaById={areaById}
                    phaseFallowClasses={phaseFallowClasses}
                    isSelected={seg.band.cycleId === selectedCycleId}
                    onSelect={onCycleSelect}
                  />
                );
              }
              return (
                <BandedHeatmapGapSegment
                  key={`gap-${seg.startIndex}`}
                  days={segDays}
                  rows={vm.rows}
                  areaById={areaById}
                  phaseFallowClasses={phaseFallowClasses}
                />
              );
            })}
          </div>

          <BandedHeatmapAxis days={vm.days} todayIndex={vm.todayIndex} />

          <div
            className="absolute"
            style={{
              left: 0,
              right: 0,
              top: 0,
              height: segmentRowHeight,
              pointerEvents: "none",
            }}
          >
            <BandedHeatmapNeedle todayIndex={vm.todayIndex} />
            <BandedHeatmapSelectionCursor selectedIndex={selectedIndex} />
          </div>
        </div>
      </div>
    </div>
  );
}
