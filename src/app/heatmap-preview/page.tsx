"use client";

import { BandedHeatmap } from "@/components/banded-heatmap/BandedHeatmap";
import {
  specimenAreas,
  specimenCycles,
  specimenMoments,
  specimenPhaseConfigs,
  specimenToday,
} from "@/components/banded-heatmap/__fixtures__/specimen";

export default function HeatmapPreviewPage() {
  return (
    <main className="min-h-screen bg-stone-100 p-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl text-stone-900">banded heatmap preview</h1>
          <p className="text-sm text-stone-500">
            Phase 2 static render. Mock cycles + moments centered on{" "}
            <code className="font-mono text-xs">{specimenToday}</code>. Compare
            against{" "}
            <code className="font-mono text-xs">
              ~/Downloads/Banded heatmap spec.html
            </code>
            .
          </p>
        </header>

        <BandedHeatmap
          cycles={specimenCycles}
          moments={specimenMoments}
          areas={specimenAreas}
          phaseConfigs={specimenPhaseConfigs}
          today={specimenToday}
          onCycleSelect={(id) => console.log("select", id)}
        />

        <section className="space-y-2 text-sm text-stone-600">
          <h2 className="text-base text-stone-900">expected</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>4 bands: barcelona (past) · rest (past) · paris (active) · may block (future)</li>
            <li>active band has paper fill + ink L/R borders; others transparent + hair borders</li>
            <li>vermillion needle frames today's column</li>
            <li>3 phase rows: AM / PM / EVE (NIGHT hidden)</li>
            <li>past cells 55% opacity; future planted cells 70%; today 100%</li>
            <li>fallow = soft fill; unplanted future = dashed hairline square</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
