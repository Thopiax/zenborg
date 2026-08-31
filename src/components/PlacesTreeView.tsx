"use client";

import { observer, use$ } from "@legendapp/state/react";
import { Check, ChevronDown, ChevronRight, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Place } from "@/domain/entities/Place";
import { activeHabits$, places$ } from "@/infrastructure/state/store";
import { cn } from "@/lib/utils";

interface TreeNode {
  place: Place;
  children: TreeNode[];
  habitCount: number;
}

function buildTree(
  places: Place[],
  habitCountByPlaceId: Map<string, number>,
): TreeNode[] {
  const byParentKey = new Map<string | null, Place[]>();
  for (const p of places) {
    const list = byParentKey.get(p.parentKey) ?? [];
    list.push(p);
    byParentKey.set(p.parentKey, list);
  }

  const build = (parentKey: string | null): TreeNode[] => {
    const children = byParentKey.get(parentKey) ?? [];
    return children
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((place) => ({
        place,
        children: build(place.key),
        habitCount: habitCountByPlaceId.get(place.id) ?? 0,
      }));
  };

  return build(null);
}

function subtreeMatchesFilter(node: TreeNode, filter: string): boolean {
  if (
    node.place.name.toLowerCase().includes(filter) ||
    node.place.key.includes(filter)
  )
    return true;
  return node.children.some((c) => subtreeMatchesFilter(c, filter));
}

function PlaceEditForm({
  place,
  allPlaces,
  onClose,
}: {
  place: Place;
  allPlaces: Place[];
  onClose: () => void;
}) {
  const [name, setName] = useState(place.name);
  const [emoji, setEmoji] = useState(place.emoji ?? "");
  const [parentKey, setParentKey] = useState(place.parentKey ?? "");
  const [lat, setLat] = useState(
    place.coordinates?.lat.toString() ?? "",
  );
  const [lng, setLng] = useState(
    place.coordinates?.lng.toString() ?? "",
  );

  const possibleParents = allPlaces.filter((p) => p.key !== place.key);

  const handleSave = () => {
    const parsedLat = Number.parseFloat(lat);
    const parsedLng = Number.parseFloat(lng);
    const coordinates =
      !Number.isNaN(parsedLat) && !Number.isNaN(parsedLng)
        ? { lat: parsedLat, lng: parsedLng }
        : null;

    places$[place.id].set({
      ...place,
      name: name.trim() || place.name,
      emoji: emoji.trim() || null,
      parentKey: parentKey || null,
      coordinates,
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <div className="flex flex-col gap-1.5 py-1.5 px-3 bg-stone-50 dark:bg-stone-800/50 rounded-sm">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          placeholder="📍"
          className="w-8 text-center bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-sm text-sm px-0.5 py-0.5"
          maxLength={2}
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder="Name"
          className="flex-1 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-sm text-sm font-mono px-2 py-0.5 text-stone-900 dark:text-stone-100"
          autoFocus
        />
      </div>
      <div className="flex items-center gap-2">
        <select
          value={parentKey}
          onChange={(e) => setParentKey(e.target.value)}
          className="flex-1 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-sm text-xs font-mono px-1.5 py-0.5 text-stone-700 dark:text-stone-300"
        >
          <option value="">no parent (root)</option>
          {possibleParents.map((p) => (
            <option key={p.key} value={p.key}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          placeholder="lat"
          className="w-16 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-sm text-xs font-mono px-1.5 py-0.5 text-stone-700 dark:text-stone-300"
        />
        <input
          type="text"
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          placeholder="lng"
          className="w-16 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-sm text-xs font-mono px-1.5 py-0.5 text-stone-700 dark:text-stone-300"
        />
      </div>
      <div className="flex items-center gap-1 justify-end">
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function PlaceNode({
  node,
  depth,
  filter,
  allPlaces,
  editingId,
  onEdit,
}: {
  node: TreeNode;
  depth: number;
  filter: string;
  allPlaces: Place[];
  editingId: string | null;
  onEdit: (id: string | null) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const hasChildren = node.children.length > 0;
  const isEditing = editingId === node.place.id;

  const matchesFilter =
    !filter ||
    node.place.name.toLowerCase().includes(filter) ||
    node.place.key.includes(filter);

  if (filter && !subtreeMatchesFilter(node, filter)) return null;

  const coords = node.place.coordinates;

  return (
    <>
      {isEditing ? (
        <div style={{ paddingLeft: `${depth * 1.5 + 0.75}rem` }}>
          <PlaceEditForm
            place={node.place}
            allPlaces={allPlaces}
            onClose={() => onEdit(null)}
          />
        </div>
      ) : (
        <div
          className={cn(
            "flex items-center gap-2 py-1.5 px-3 rounded-sm transition-colors cursor-pointer",
            "hover:bg-stone-100 dark:hover:bg-stone-800",
            filter && matchesFilter && "bg-stone-50 dark:bg-stone-800/50",
          )}
          style={{ paddingLeft: `${depth * 1.5 + 0.75}rem` }}
          onClick={() => onEdit(node.place.id)}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCollapsed((v) => !v);
            }}
            className={cn(
              "p-0.5 text-stone-400 dark:text-stone-500 transition-colors",
              hasChildren
                ? "hover:text-stone-600 dark:hover:text-stone-300"
                : "invisible",
            )}
          >
            {collapsed ? (
              <ChevronRight className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>

          <span className="w-5 text-center text-sm leading-none">
            {node.place.emoji ??
              (depth === 0 ? "🌍" : depth === 1 ? "📍" : "·")}
          </span>

          <span
            className={cn(
              "text-sm font-mono",
              depth === 0
                ? "font-medium text-stone-700 dark:text-stone-300"
                : "text-stone-600 dark:text-stone-400",
            )}
          >
            {node.place.name}
          </span>

          {node.habitCount > 0 && (
            <span className="text-[10px] font-mono text-stone-400 dark:text-stone-500 tabular-nums">
              {node.habitCount}
            </span>
          )}

          {coords && (
            <span className="ml-auto text-[10px] font-mono text-stone-300 dark:text-stone-600 tabular-nums">
              {coords.lat.toFixed(2)}, {coords.lng.toFixed(2)}
            </span>
          )}
        </div>
      )}

      {!collapsed &&
        hasChildren &&
        node.children.map((child) => (
          <PlaceNode
            key={child.place.id}
            node={child}
            depth={depth + 1}
            filter={filter}
            allPlaces={allPlaces}
            editingId={editingId}
            onEdit={onEdit}
          />
        ))}
    </>
  );
}

export const PlacesTreeView = observer(
  ({ filter }: { filter: string }) => {
    const places = use$(places$);
    const habits = use$(activeHabits$);
    const [editingId, setEditingId] = useState<string | null>(null);

    const allPlaces = useMemo(
      () => Object.values(places),
      [places],
    );

    const habitCountByPlaceId = useMemo(() => {
      const counts = new Map<string, number>();
      for (const h of habits) {
        for (const pid of h.placeIds ?? []) {
          counts.set(pid, (counts.get(pid) ?? 0) + 1);
        }
      }
      return counts;
    }, [habits]);

    const tree = useMemo(
      () => buildTree(allPlaces, habitCountByPlaceId),
      [allPlaces, habitCountByPlaceId],
    );

    const normalizedFilter = filter.trim().toLowerCase();

    if (tree.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-stone-400 dark:text-stone-500 text-sm font-mono">
          no places
        </div>
      );
    }

    return (
      <div className="h-full overflow-y-auto p-2">
        <div className="max-w-lg mx-auto">
          {tree.map((node) => (
            <PlaceNode
              key={node.place.id}
              node={node}
              depth={0}
              filter={normalizedFilter}
              allPlaces={allPlaces}
              editingId={editingId}
              onEdit={setEditingId}
            />
          ))}
        </div>
      </div>
    );
  },
);
