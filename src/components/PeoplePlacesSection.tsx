"use client";

import { use$ } from "@legendapp/state/react";
import { MapPin, Plus, Trash2, User } from "lucide-react";
import { useState } from "react";
import { createPerson } from "@zenborg/core/domain/entities/Person";
import { createPlace } from "@zenborg/core/domain/entities/Place";
import { slugify } from "@zenborg/core/domain/entities/Moment";
import { people$, places$ } from "@/infrastructure/state/store";
import { cn } from "@/lib/utils";

export function PeoplePlacesSection() {
  const allPeople = use$(people$);
  const allPlaces = use$(places$);

  const [tab, setTab] = useState<"people" | "places">("people");
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleAddPerson = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    const person = createPerson({
      name: trimmed,
      key: slugify(trimmed),
      emoji: newEmoji.trim() || null,
    });

    people$[person.id].set(person);
    setNewName("");
    setNewEmoji("");
  };

  const handleAddPlace = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    const place = createPlace({
      name: trimmed,
      key: slugify(trimmed),
      emoji: newEmoji.trim() || null,
    });

    places$[place.id].set(place);
    setNewName("");
    setNewEmoji("");
  };

  const handleDelete = (id: string) => {
    if (deleteConfirm === id) {
      if (tab === "people") {
        people$[id].delete();
      } else {
        places$[id].delete();
      }
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const people = Object.values(allPeople).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const places = Object.values(allPlaces).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const items = tab === "people" ? people : places;

  return (
    <div className="space-y-3 px-2">
      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-stone-100 dark:bg-stone-800 rounded-lg">
        <button
          type="button"
          onClick={() => setTab("people")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
            tab === "people"
              ? "bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm"
              : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300",
          )}
        >
          <User className="w-3 h-3" />
          People ({people.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("places")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
            tab === "places"
              ? "bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm"
              : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300",
          )}
        >
          <MapPin className="w-3 h-3" />
          Places ({places.length})
        </button>
      </div>

      {/* Add form */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newEmoji}
          onChange={(e) => setNewEmoji(e.target.value)}
          placeholder={tab === "people" ? "👤" : "📍"}
          className="w-10 text-center bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-md text-sm px-1 py-1.5"
          maxLength={2}
        />
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              tab === "people" ? handleAddPerson() : handleAddPlace();
            }
          }}
          placeholder={tab === "people" ? "Name..." : "Place name..."}
          className="flex-1 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-md text-sm px-3 py-1.5 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500"
        />
        <button
          type="button"
          onClick={tab === "people" ? handleAddPerson : handleAddPlace}
          disabled={!newName.trim()}
          className="px-2 py-1.5 bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 rounded-md transition-colors disabled:opacity-40"
        >
          <Plus className="w-4 h-4 text-stone-600 dark:text-stone-400" />
        </button>
      </div>

      {/* List */}
      <div className="space-y-1 max-h-60 overflow-y-auto">
        {items.length === 0 && (
          <p className="text-xs text-stone-400 dark:text-stone-500 text-center py-4">
            No {tab} yet. Add one above or type @name in a moment.
          </p>
        )}
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800 group"
          >
            <span className="w-6 text-center text-sm flex-shrink-0">
              {item.emoji || (tab === "people" ? "👤" : "📍")}
            </span>
            <span className="flex-1 text-sm text-stone-700 dark:text-stone-300 truncate">
              {item.name}
            </span>
            <span className="text-xs text-stone-400 dark:text-stone-500 font-mono">
              @{item.key}
            </span>
            <button
              type="button"
              onClick={() => handleDelete(item.id)}
              className={cn(
                "p-1 rounded transition-colors",
                deleteConfirm === item.id
                  ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                  : "opacity-0 group-hover:opacity-100 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300",
              )}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
