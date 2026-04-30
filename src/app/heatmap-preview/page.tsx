"use client";

import { useState } from "react";
import { BandedHeatmap } from "@/components/banded-heatmap/BandedHeatmap";
import {
  specimenAreas,
  specimenCycles,
  specimenMoments,
  specimenPhaseConfigs,
  specimenToday,
} from "@/components/banded-heatmap/__fixtures__/specimen";

export default function HeatmapPreviewPage() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-stone-100 p-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <BandedHeatmap
          cycles={specimenCycles}
          moments={specimenMoments}
          areas={specimenAreas}
          phaseConfigs={specimenPhaseConfigs}
          today={specimenToday}
          onCycleSelect={(id) => console.log("cycle", id)}
          onDaySelect={setSelected}
        />

        <p className="font-mono text-xs text-stone-500">
          selected: {selected ?? "—"} · drag to pan · arrows to move · home/esc → today
        </p>
      </div>
    </main>
  );
}
