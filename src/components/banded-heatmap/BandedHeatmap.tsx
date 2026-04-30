/** biome-ignore-all lint/a11y/noStaticElementInteractions: <explanation> */
/** biome-ignore-all lint/a11y/noNoninteractiveTabindex: <explanation> */
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
// Tailwind `gap-x-1` between segments — must match the value on the segments
// flex row below. Segment offsets accumulate this between segments.
const SEGMENT_FLEX_GAP_PX = 4;

interface BandedHeatmapProps {
  cycles: Cycle[];
  moments: Moment[];
  areas: Area[];
  phaseConfigs: PhaseConfig[];
  today: string;
  selectedCycleId?: string | null;
  selectedDay?: string | null;
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
  selectedDay,
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

  // x-position of each day in the rendered strip. Accounts for the
  // gap-x-1 (4px) inserted between segments by the flex row.
  const dayX = useMemo(() => {
    const out = new Array<number>(vm.days.length);
    let x = 0;
    for (const seg of vm.segments) {
      const count = seg.endIndex - seg.startIndex + 1;
      for (let j = 0; j < count; j++) {
        out[seg.startIndex + j] = x;
        x += STRIDE;
      }
      x += SEGMENT_FLEX_GAP_PX;
    }
    return out;
  }, [vm.segments, vm.days.length]);

  const totalRenderedWidth = useMemo(() => {
    if (vm.segments.length === 0) return 0;
    const last = vm.segments[vm.segments.length - 1];
    return (
      dayX[last.endIndex] + STRIDE + (vm.segments.length - 1) * 0
    );
  }, [vm.segments, dayX]);

  const indexAtX = useCallback(
    (x: number): number | null => {
      if (vm.days.length === 0) return null;
      let lo = 0;
      let hi = vm.days.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (dayX[mid] <= x) lo = mid;
        else hi = mid - 1;
      }
      // Click on or past the last cell snaps to that cell. Click in inter-
      // segment gap snaps to whichever neighbor is closer.
      if (x < dayX[lo] + STRIDE) return lo;
      if (lo + 1 >= vm.days.length) return lo;
      const distToHere = x - (dayX[lo] + CELL_SIZE);
      const distToNext = dayX[lo + 1] - x;
      return distToHere < distToNext ? lo : lo + 1;
    },
    [dayX, vm.days.length],
  );

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

  // Scroll to today on mount only — never re-snap after the user has panned
  // or selected a far-away day.
  const didInitialScrollRef = useRef(false);
  useLayoutEffect(() => {
    if (didInitialScrollRef.current) return;
    const el = scrollRef.current;
    if (!el || vm.todayIndex < 0 || dayX.length === 0) return;
    const target = dayX[vm.todayIndex] + CELL_SIZE / 2 - el.clientWidth / 2;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.scrollLeft = Math.max(0, target);
        didInitialScrollRef.current = true;
      });
    });
  }, [vm.todayIndex, dayX]);

  const ensureVisible = useCallback(
    (index: number) => {
      const el = scrollRef.current;
      if (!el) return;
      const cellLeft = dayX[index] ?? 0;
      const cellRight = cellLeft + CELL_SIZE;
      const viewLeft = el.scrollLeft + KEEP_ON_SCREEN_PADDING;
      const viewRight = el.scrollLeft + el.clientWidth - KEEP_ON_SCREEN_PADDING;
      if (cellLeft < viewLeft) {
        el.scrollLeft = cellLeft - KEEP_ON_SCREEN_PADDING;
      } else if (cellRight > viewRight) {
        el.scrollLeft = cellRight - el.clientWidth + KEEP_ON_SCREEN_PADDING;
      }
    },
    [dayX],
  );

  // Externally-controlled selection: when the parent updates selectedDay
  // (e.g. the global "Today" button), sync internal selectedIndex and pan to it.
  useEffect(() => {
    if (!selectedDay) return;
    const idx = vm.days.findIndex((d) => d.date === selectedDay);
    if (idx < 0) return;
    setSelectedIndex((prev) => {
      if (prev === idx) return prev;
      ensureVisible(idx);
      return idx;
    });
  }, [selectedDay, vm.days, ensureVisible]);

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
      return indexAtX(clientX - rect.left);
    },
    [indexAtX],
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
          className="relative py-2"
          style={{
            width: totalRenderedWidth,
            minWidth: totalRenderedWidth,
            touchAction: "pan-x",
          }}
        >
          <div className="flex gap-x-1" style={{ height: segmentRowHeight }}>
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

          <BandedHeatmapAxis
            days={vm.days}
            todayIndex={vm.todayIndex}
            dayX={dayX}
          />

          <div
            className="absolute left-0 right-0 top-2"
            style={{
              height: segmentRowHeight,
              pointerEvents: "none",
            }}
          >
            <BandedHeatmapNeedle
              x={
                vm.todayIndex >= 0
                  ? dayX[vm.todayIndex] + CELL_SIZE / 2
                  : null
              }
            />
            <BandedHeatmapSelectionCursor
              x={selectedIndex >= 0 ? dayX[selectedIndex] : null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
