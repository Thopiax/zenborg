"use client";

import { use$, useValue } from "@legendapp/state/react";
import { CultivateWeekView } from "@/components/CultivateWeekView";
import { CultivateZoomToggle } from "@/components/CultivateZoomToggle";
import { CycleDeck } from "@/components/CycleDeck";
import { DnDProvider } from "@/components/DnDProvider";
import { LandscapePrompt } from "@/components/LandscapePrompt";
import { MomentFormDialog } from "@/components/MomentFormDialog";
import { Timeline } from "@/components/Timeline";
import type { CustomMetric } from "@/domain/value-objects/Attitude";
import type { Phase } from "@/domain/value-objects/Phase";
import { useGlobalKeyboard } from "@/hooks/useGlobalKeyboard";
import { useGlobalSelection } from "@/hooks/useGlobalSelection";
import { useSelection } from "@/hooks/useSelection";
import { moments$ } from "@/infrastructure/state/store";
import {
  cultivateZoom$,
  momentFormState$,
} from "@/infrastructure/state/ui-store";
import { cn } from "@/lib/utils";

export default function CultivatePage() {
  const { handleCreateMoment, handleSaveEdit, handleDeleteEdit } =
    useGlobalKeyboard();

  const zoom = use$(cultivateZoom$);

  const handleMomentFormSave = (
    name: string,
    areaId: string,
    phase: Phase | null,
    createMore?: boolean,
    emoji?: string | null,
    tags?: string[],
    customMetric?: CustomMetric,
    startTime?: string,
  ) => {
    const mode = momentFormState$.mode.peek();
    if (mode === "create") {
      handleCreateMoment(
        name,
        areaId,
        phase,
        createMore,
        emoji,
        tags,
        customMetric,
        startTime,
      );
    } else {
      handleSaveEdit(name, areaId, phase, emoji, tags, customMetric, startTime);
    }
  };

  const allMoments = useValue(moments$);
  useGlobalSelection(Object.keys(allMoments));

  const { clearSelection, hasAnySelected } = useSelection();

  const handleBackgroundClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isClickOnMoment = target.closest("button[data-moment-id]");
    const isClickOnInteractive = target.closest(
      "button, a, input, select, textarea",
    );

    if (!isClickOnMoment && !isClickOnInteractive && hasAnySelected) {
      clearSelection();
    }
  };

  return (
    <DnDProvider>
      <LandscapePrompt />

      {/* biome-ignore lint/a11y/noStaticElementInteractions: Background click to clear selection */}
      <div
        className="h-full bg-background transition-colors flex flex-col overflow-hidden"
        onMouseDown={handleBackgroundClick}
      >
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-shrink-0 flex justify-end px-4 py-1.5">
            <CultivateZoomToggle />
          </div>

          {zoom === "phase" ? (
            <div
              className={cn(
                "flex-1 min-h-0 overflow-hidden",
                "flex flex-col justify-center",
              )}
              style={{
                paddingLeft: "env(safe-area-inset-left)",
              }}
            >
              <Timeline />
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-hidden">
              <CultivateWeekView />
            </div>
          )}

          {zoom === "phase" && (
            <div className="flex-shrink-0">
              <CycleDeck />
            </div>
          )}
        </main>

        <MomentFormDialog
          onSave={handleMomentFormSave}
          onDelete={handleDeleteEdit}
        />
      </div>
    </DnDProvider>
  );
}
