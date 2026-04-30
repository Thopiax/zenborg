"use client";

import { useMemo } from "react";
import type { Area } from "@/domain/entities/Area";
import type { Cycle, CreateCycleProps } from "@/domain/entities/Cycle";
import type { Moment } from "@/domain/entities/Moment";
import {
  Phase,
  type PhaseConfig,
  getVisiblePhases,
} from "@/domain/value-objects/Phase";
import {
  deriveBandedHeatmapViewModel,
  type HeatmapViewModel,
} from "@/infrastructure/state/bandedHeatmapViewModel";
import { BandedHeatmapAxis } from "./BandedHeatmapAxis";
import { BandedHeatmapBand } from "./BandedHeatmapBand";
import { BandedHeatmapBracket } from "./BandedHeatmapBracket";
import { BandedHeatmapGrid } from "./BandedHeatmapGrid";
import { BandedHeatmapNeedle } from "./BandedHeatmapNeedle";
import {
  AXIS_HEIGHT,
  BRACKET_HEIGHT,
  GUTTER_WIDTH,
  HAIR_COLOR,
  HEATMAP_HEIGHT,
} from "./constants";

interface BandedHeatmapProps {
  cycles: Cycle[];
  moments: Moment[];
  areas: Area[];
  phaseConfigs: PhaseConfig[];
  today: string;
  onCycleSelect?: (cycleId: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onCycleCreate?: (props: CreateCycleProps) => void;
}

const PHASE_LABELS: Record<Phase, string> = {
  [Phase.MORNING]: "AM",
  [Phase.AFTERNOON]: "PM",
  [Phase.EVENING]: "EVE",
  [Phase.NIGHT]: "NGT",
};

export function BandedHeatmap({
  cycles,
  moments,
  areas,
  phaseConfigs,
  today,
  onCycleSelect,
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
    [cycles, moments, areas, phaseConfigs, today]
  );

  const areaById = useMemo(
    () => new Map(areas.map((a) => [a.id, a])),
    [areas]
  );

  const visiblePhaseConfigs = useMemo(
    () => getVisiblePhases(phaseConfigs),
    [phaseConfigs]
  );

  return (
    <div
      style={{
        position: "relative",
        height: HEATMAP_HEIGHT,
        background: "var(--zb-canvas, #f0eee9)",
        border: `1px solid ${HAIR_COLOR}`,
        padding: `14px 0 14px ${GUTTER_WIDTH + 8}px`,
        boxSizing: "border-box",
        userSelect: "none",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          padding: "0 16px 10px 0",
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "rgba(42, 37, 31, 0.55)",
            fontWeight: 500,
          }}
        >
          cycles
        </div>
      </div>

      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: 56,
          width: GUTTER_WIDTH,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-around",
          fontSize: 9,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "rgba(42, 37, 31, 0.55)",
          padding: "20px 12px 18px 16px",
          boxSizing: "border-box",
          height: 76,
          pointerEvents: "none",
        }}
      >
        {visiblePhaseConfigs.map((cfg) => (
          <span key={cfg.id}>{PHASE_LABELS[cfg.phase]}</span>
        ))}
      </div>

      <div
        style={{
          overflowX: "auto",
          overflowY: "hidden",
          position: "relative",
          scrollbarWidth: "thin",
        }}
      >
        <div style={{ position: "relative", paddingBottom: 4, minWidth: "fit-content" }}>
          <div
            style={{
              position: "relative",
              height: BRACKET_HEIGHT,
              marginBottom: 4,
              zIndex: 2,
            }}
          >
            {vm.bands.map((band) => (
              <BandedHeatmapBracket
                key={band.cycleId}
                band={band}
                onSelect={onCycleSelect}
              />
            ))}
          </div>

          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              bottom: AXIS_HEIGHT + 6,
              pointerEvents: "none",
              zIndex: 0,
            }}
          >
            {vm.bands.map((band) => (
              <BandedHeatmapBand key={band.cycleId} band={band} />
            ))}
          </div>

          <div style={{ position: "relative" }}>
            <BandedHeatmapGrid
              days={vm.days}
              rows={vm.rows}
              areaById={areaById}
            />
            <BandedHeatmapNeedle todayIndex={vm.todayIndex} />
          </div>

          <BandedHeatmapAxis days={vm.days} todayIndex={vm.todayIndex} />
        </div>
      </div>
    </div>
  );
}
