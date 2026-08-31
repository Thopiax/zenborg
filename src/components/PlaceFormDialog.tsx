"use client";

import { use$ } from "@legendapp/state/react";
import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Coordinates } from "@/domain/entities/Place";
import {
  closePlaceForm,
  placeFormState$,
} from "@/infrastructure/state/ui-store";
import { places$ } from "@/infrastructure/state/store";
import { cn } from "@/lib/utils";

interface PlaceFormDialogProps {
  onSave: (props: {
    name: string;
    emoji: string | null;
    parentKey: string | null;
    coordinates: Coordinates | null;
    address: string | null;
    url: string | null;
    tags: string[];
  }) => void;
  onDelete?: () => void;
}

export function PlaceFormDialog({ onSave, onDelete }: PlaceFormDialogProps) {
  const formState = use$(placeFormState$);
  const { open, mode, name, emoji, parentKey, lat, lng, address, url, tags, editingPlaceId } =
    formState;

  const allPlaces = use$(places$);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (open) {
      setValidationError(null);
      setDeleteConfirm(false);
    }
  }, [open]);

  const possibleParents = useMemo(() => {
    const currentKey = editingPlaceId
      ? allPlaces[editingPlaceId]?.key
      : null;
    return Object.values(allPlaces)
      .filter((p) => p.key !== currentKey)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allPlaces, editingPlaceId]);

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setValidationError("Name cannot be empty");
      return;
    }

    const parsedLat = Number.parseFloat(lat);
    const parsedLng = Number.parseFloat(lng);
    const coordinates: Coordinates | null =
      !Number.isNaN(parsedLat) && !Number.isNaN(parsedLng)
        ? { lat: parsedLat, lng: parsedLng }
        : null;

    onSave({
      name: trimmedName,
      emoji: emoji || null,
      parentKey: parentKey || null,
      coordinates,
      address: address.trim() || null,
      url: url.trim() || null,
      tags,
    });
  };

  const handleDelete = () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setTimeout(() => setDeleteConfirm(false), 3000);
      return;
    }
    onDelete?.();
  };

  useHotkeys(
    "enter",
    (e) => {
      e.preventDefault();
      handleSave();
    },
    { enableOnFormTags: ["INPUT", "SELECT"], enabled: open },
  );

  const inputClass =
    "w-full bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-sm text-sm font-mono px-2 py-1 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500";
  const labelClass = "text-[10px] font-mono text-stone-400 dark:text-stone-500 uppercase tracking-wider";

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && closePlaceForm()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">
            {mode === "edit" ? "Edit Place" : "New Place"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          {validationError && (
            <p className="text-xs text-red-500 font-mono">{validationError}</p>
          )}

          {/* Name + Emoji */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={emoji ?? ""}
              onChange={(e) => placeFormState$.emoji.set(e.target.value || null)}
              placeholder="📍"
              className="w-10 text-center bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-sm text-sm px-0.5 py-1"
              maxLength={2}
            />
            <input
              type="text"
              value={name}
              onChange={(e) => placeFormState$.name.set(e.target.value)}
              placeholder="Place name..."
              className={cn(inputClass, "flex-1")}
              autoFocus
            />
          </div>

          {/* Parent */}
          <div className="flex flex-col gap-0.5">
            <span className={labelClass}>parent</span>
            <select
              value={parentKey ?? ""}
              onChange={(e) =>
                placeFormState$.parentKey.set(e.target.value || null)
              }
              className={inputClass}
            >
              <option value="">no parent (root)</option>
              {possibleParents.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.emoji ? `${p.emoji} ` : ""}
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Coordinates */}
          <div className="flex gap-2">
            <div className="flex-1 flex flex-col gap-0.5">
              <span className={labelClass}>lat</span>
              <input
                type="text"
                value={lat}
                onChange={(e) => placeFormState$.lat.set(e.target.value)}
                placeholder="48.8566"
                className={inputClass}
              />
            </div>
            <div className="flex-1 flex flex-col gap-0.5">
              <span className={labelClass}>lng</span>
              <input
                type="text"
                value={lng}
                onChange={(e) => placeFormState$.lng.set(e.target.value)}
                placeholder="2.3522"
                className={inputClass}
              />
            </div>
          </div>

          {/* Address */}
          <div className="flex flex-col gap-0.5">
            <span className={labelClass}>address</span>
            <input
              type="text"
              value={address}
              onChange={(e) => placeFormState$.address.set(e.target.value)}
              placeholder="196 avenue Jean Jaurès, Paris 75019"
              className={inputClass}
            />
          </div>

          {/* URL */}
          <div className="flex flex-col gap-0.5">
            <span className={labelClass}>url</span>
            <input
              type="text"
              value={url}
              onChange={(e) => placeFormState$.url.set(e.target.value)}
              placeholder="https://maps.app.goo.gl/..."
              className={inputClass}
            />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          {mode === "edit" && onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-1 rounded-sm text-xs font-mono transition-colors",
                deleteConfirm
                  ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                  : "text-stone-400 hover:text-stone-600 dark:hover:text-stone-300",
              )}
            >
              <Trash2 className="w-3 h-3" />
              {deleteConfirm ? "confirm" : "delete"}
            </button>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={closePlaceForm}
              className="px-3 py-1 rounded-sm text-xs font-mono text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
            >
              cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-3 py-1 rounded-sm text-xs font-mono bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-300 dark:hover:bg-stone-600 transition-colors"
            >
              save
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
