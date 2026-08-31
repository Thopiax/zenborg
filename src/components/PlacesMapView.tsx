"use client";

import { observer, use$ } from "@legendapp/state/react";
import { useMemo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";
import type { Cycle } from "@/domain/entities/Cycle";
import type { Place } from "@/domain/entities/Place";
import {
  cycles$,
  places$,
} from "@/infrastructure/state/store";
import {
  openPlaceFormEdit,
} from "@/infrastructure/state/ui-store";

const GEO_URL = "/geo/world-110m.json";

function cycleDays(cycle: Cycle): number {
  const start = new Date(cycle.startDate);
  const end = cycle.endDate ? new Date(cycle.endDate) : new Date();
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

function computeWeights(
  places: Place[],
  cycles: Record<string, Cycle>,
): Map<string, number> {
  const weights = new Map<string, number>();
  for (const cycle of Object.values(cycles)) {
    const days = cycleDays(cycle);
    for (const pid of cycle.placeIds ?? []) {
      weights.set(pid, (weights.get(pid) ?? 0) + days);
    }
  }
  return weights;
}

function markerRadius(days: number, maxDays: number): number {
  if (maxDays <= 0) return 4;
  const normalized = days / maxDays;
  return 4 + normalized * 16;
}

export const PlacesMapView = observer(() => {
  const places = use$(places$);
  const cycles = use$(cycles$);
  const [tooltip, setTooltip] = useState<{
    name: string;
    days: number;
    x: number;
    y: number;
  } | null>(null);

  const allPlaces = useMemo(() => Object.values(places), [places]);

  const placesWithCoords = useMemo(
    () => allPlaces.filter((p) => p.coordinates != null),
    [allPlaces],
  );

  const weights = useMemo(() => computeWeights(allPlaces, cycles), [allPlaces, cycles]);

  const maxWeight = useMemo(() => {
    let max = 0;
    for (const w of weights.values()) {
      if (w > max) max = w;
    }
    return max;
  }, [weights]);

  if (placesWithCoords.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-stone-400 dark:text-stone-500 text-sm font-mono">
        no places with coordinates
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden relative">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 140, center: [0, 30] }}
        className="w-full h-full"
        style={{ width: "100%", height: "100%" }}
      >
        <ZoomableGroup>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo, i) => (
                <Geography
                  key={geo.rpiKey ?? i}
                  geography={geo}
                  fill="currentColor"
                  className="text-stone-200 dark:text-stone-700"
                  stroke="currentColor"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: "none" },
                    hover: { outline: "none", opacity: 0.8 },
                    pressed: { outline: "none" },
                  }}
                />
              ))
            }
          </Geographies>

          {placesWithCoords.map((place) => {
            const coords = place.coordinates!;
            const days = weights.get(place.id) ?? 0;
            const r = markerRadius(days, maxWeight);

            return (
              <Marker
                key={place.id}
                coordinates={[coords.lng, coords.lat]}
                onClick={() => openPlaceFormEdit(place.id, place)}
                onMouseEnter={(e) =>
                  setTooltip({
                    name: place.emoji ? `${place.emoji} ${place.name}` : place.name,
                    days,
                    x: e.clientX,
                    y: e.clientY,
                  })
                }
                onMouseLeave={() => setTooltip(null)}
                style={{ default: { cursor: "pointer" }, hover: { cursor: "pointer" }, pressed: {} }}
              >
                <circle
                  r={r}
                  fill="currentColor"
                  className="text-stone-500 dark:text-stone-400"
                  opacity={0.7}
                  stroke="currentColor"
                  strokeWidth={1}
                />
                <text
                  textAnchor="middle"
                  y={r + 12}
                  className="text-stone-600 dark:text-stone-400"
                  style={{
                    fontSize: "8px",
                    fontFamily: "monospace",
                    fill: "currentColor",
                    pointerEvents: "none",
                  }}
                >
                  {place.name}
                </text>
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>

      {tooltip && (
        <div
          className="fixed z-50 px-2 py-1 rounded-sm bg-stone-800 dark:bg-stone-200 text-stone-100 dark:text-stone-800 text-xs font-mono pointer-events-none"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y - 8,
          }}
        >
          {tooltip.name}
          {tooltip.days > 0 && (
            <span className="ml-1.5 text-stone-400 dark:text-stone-500 tabular-nums">
              {tooltip.days}d
            </span>
          )}
        </div>
      )}
    </div>
  );
});
