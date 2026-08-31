"use client";

import { use$ } from "@legendapp/state/react";
import Fuse from "fuse.js";
import { Link2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  createRelationship,
  type EntityType,
} from "@/domain/entities/Relationship";
import { displayName } from "@/domain/entities/Person";
import {
  areas$,
  habits$,
  people$,
  places$,
  relationships$,
} from "@/infrastructure/state/store";
import { cn } from "@/lib/utils";

interface SearchableEntity {
  id: string;
  type: EntityType;
  name: string;
  searchTerms: string[];
  emoji: string | null;
}

interface RelationshipTaggerProps {
  entityType: EntityType;
  entityId: string;
  excludeLabels?: string[];
  collisionBoundary?: Element | null | Array<Element | null>;
}

export function RelationshipTagger({
  entityType,
  entityId,
  excludeLabels = [],
  collisionBoundary,
}: RelationshipTaggerProps) {
  const allRelationships = use$(relationships$);
  const allAreas = use$(areas$);
  const allPeople = use$(people$);
  const allPlaces = use$(places$);
  const allHabits = use$(habits$);

  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);

  const entityRels = useMemo(() => {
    const excludeSet = new Set(excludeLabels);
    return Object.values(allRelationships).filter((r) => {
      if (excludeSet.has(r.label)) return false;
      if (r.fromType === entityType && r.fromId === entityId) return true;
      if (r.toType === entityType && r.toId === entityId && r.direction === "mutual") return true;
      return false;
    });
  }, [allRelationships, entityType, entityId, excludeLabels]);

  const existingLabels = useMemo(() => {
    const labels = new Set<string>();
    for (const r of Object.values(allRelationships)) {
      if (r.label) labels.add(r.label);
    }
    return [...labels].sort();
  }, [allRelationships]);

  const allEntities = useMemo((): SearchableEntity[] => {
    const items: SearchableEntity[] = [];

    for (const area of Object.values(allAreas)) {
      items.push({
        id: area.id,
        type: "area",
        name: area.name,
        searchTerms: [area.name],
        emoji: area.emoji,
      });
    }
    for (const person of Object.values(allPeople)) {
      if (person.id === entityId && entityType === "person") continue;
      items.push({
        id: person.id,
        type: "person",
        name: displayName(person),
        searchTerms: [person.name, ...(person.aliases ?? [])],
        emoji: person.emoji,
      });
    }
    for (const place of Object.values(allPlaces)) {
      if (place.id === entityId && entityType === "place") continue;
      items.push({
        id: place.id,
        type: "place",
        name: place.name,
        searchTerms: [place.name],
        emoji: place.emoji,
      });
    }
    for (const habit of Object.values(allHabits)) {
      if (habit.isArchived) continue;
      if (habit.id === entityId && entityType === "habit") continue;
      items.push({
        id: habit.id,
        type: "habit",
        name: habit.name,
        searchTerms: [habit.name, ...(habit.aliases ?? [])],
        emoji: habit.emoji,
      });
    }

    return items;
  }, [allAreas, allPeople, allPlaces, allHabits, entityType, entityId]);

  const alreadyLinkedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of entityRels) {
      const otherId = (r.fromType === entityType && r.fromId === entityId)
        ? r.toId
        : r.fromId;
      ids.add(otherId);
    }
    return ids;
  }, [entityRels, entityType, entityId]);

  const filteredEntities = useMemo(() => {
    const available = allEntities.filter((e) => !alreadyLinkedIds.has(e.id));
    const trimmed = search.trim().toLowerCase();

    if (!trimmed) return available.slice(0, 8);

    const exact: SearchableEntity[] = [];
    const prefix: SearchableEntity[] = [];
    const contains: SearchableEntity[] = [];

    for (const item of available) {
      const terms = item.searchTerms.map((t) => t.toLowerCase());
      if (terms.some((t) => t === trimmed)) {
        exact.push(item);
      } else if (terms.some((t) => t.startsWith(trimmed))) {
        prefix.push(item);
      } else if (terms.some((t) => t.includes(trimmed))) {
        contains.push(item);
      }
    }

    const searched = new Set([...exact, ...prefix, ...contains]);
    const remaining = available.filter((i) => !searched.has(i));

    let fuzzy: SearchableEntity[] = [];
    if (remaining.length > 0) {
      const fuse = new Fuse(remaining, {
        keys: ["name", "searchTerms"],
        threshold: 0.4,
        distance: 100,
      });
      fuzzy = fuse.search(trimmed).map((r) => r.item);
    }

    return [...exact, ...prefix, ...contains, ...fuzzy].slice(0, 8);
  }, [search, allEntities, alreadyLinkedIds]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredEntities.length]);

  const handleAddRelationship = (target: SearchableEntity) => {
    const rel = createRelationship({
      fromType: entityType,
      fromId: entityId,
      toType: target.type,
      toId: target.id,
      label: "",
    });
    relationships$[rel.id].set(rel);
    setSearch("");
    setSearchOpen(false);
    setEditingLabelId(rel.id);
    setLabelDraft("");
  };

  const handleRemove = (relId: string) => {
    relationships$[relId].delete();
    if (editingLabelId === relId) setEditingLabelId(null);
  };

  const commitLabel = (relId: string) => {
    const trimmed = labelDraft.trim();
    const rel = allRelationships[relId];
    if (rel && trimmed !== rel.label) {
      relationships$[relId].set({
        ...rel,
        label: trimmed,
        updatedAt: new Date().toISOString(),
      });
    }
    setEditingLabelId(null);
  };

  const resolveEntity = (type: EntityType, id: string): { name: string; emoji: string | null } | null => {
    switch (type) {
      case "area": { const a = allAreas[id]; return a ? { name: a.name, emoji: a.emoji } : null; }
      case "person": { const p = allPeople[id]; return p ? { name: displayName(p), emoji: p.emoji } : null; }
      case "place": { const p = allPlaces[id]; return p ? { name: p.name, emoji: p.emoji } : null; }
      case "habit": { const h = allHabits[id]; return h ? { name: h.name, emoji: h.emoji } : null; }
      default: return null;
    }
  };

  const otherEnd = (r: typeof entityRels[number]): { type: EntityType; id: string } => {
    if (r.fromType === entityType && r.fromId === entityId) {
      return { type: r.toType, id: r.toId };
    }
    return { type: r.fromType, id: r.fromId };
  };

  const labelSuggestions = useMemo(() => {
    const trimmed = labelDraft.trim().toLowerCase();
    if (!trimmed) return existingLabels.slice(0, 6);
    return existingLabels.filter((l) => l.toLowerCase().includes(trimmed)).slice(0, 6);
  }, [labelDraft, existingLabels]);

  useEffect(() => {
    if (editingLabelId && labelInputRef.current) {
      labelInputRef.current.focus();
    }
  }, [editingLabelId]);

  const typeLabel = (t: EntityType) => {
    switch (t) {
      case "area": return "area";
      case "person": return "person";
      case "place": return "place";
      case "habit": return "habit";
    }
  };

  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-mono text-stone-500 dark:text-stone-400 mb-2">
        <Link2 className="w-3 h-3" />
        Relationships
      </label>

      {entityRels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {entityRels.map((r) => {
            const end = otherEnd(r);
            const entity = resolveEntity(end.type, end.id);
            const isEditingLabel = editingLabelId === r.id;

            return (
              <span
                key={r.id}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-xs font-mono text-stone-700 dark:text-stone-300"
              >
                {entity?.emoji && <span>{entity.emoji}</span>}
                {isEditingLabel ? (
                  <span className="relative">
                    <input
                      ref={labelInputRef}
                      type="text"
                      value={labelDraft}
                      onChange={(e) => setLabelDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          e.stopPropagation();
                          e.nativeEvent.stopImmediatePropagation();
                          commitLabel(r.id);
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setEditingLabelId(null);
                        }
                      }}
                      onBlur={() => commitLabel(r.id)}
                      placeholder="label…"
                      className="w-20 bg-transparent text-xs font-mono text-stone-500 dark:text-stone-400 placeholder:text-stone-400 focus:outline-none border-b border-stone-300 dark:border-stone-600"
                      list={`rel-labels-${r.id}`}
                    />
                    <datalist id={`rel-labels-${r.id}`}>
                      {labelSuggestions.map((l) => (
                        <option key={l} value={l} />
                      ))}
                    </datalist>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingLabelId(r.id);
                      setLabelDraft(r.label);
                    }}
                    className="text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
                    title="Click to edit label"
                  >
                    {r.label || "…"}
                  </button>
                )}
                <span>{entity?.name ?? end.id}</span>
                <span className="text-stone-400 dark:text-stone-500">({typeLabel(end.type)})</span>
                <button
                  type="button"
                  onClick={() => handleRemove(r.id)}
                  className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors ml-0.5"
                  aria-label="Remove relationship"
                >
                  <X className="w-3 h-3" strokeWidth={2} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      <Popover
        open={searchOpen}
        onOpenChange={(isOpen) => {
          setSearchOpen(isOpen);
          if (isOpen) {
            setSearch("");
            setTimeout(() => searchInputRef.current?.focus(), 50);
          }
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className="text-xs font-mono text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
          >
            + add relationship
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-72 p-2 border-stone-200/50 dark:border-stone-700/50 shadow-sm bg-white/95 dark:bg-stone-900/95 backdrop-blur-sm"
          collisionBoundary={collisionBoundary}
          side="bottom"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex((prev) =>
                  prev < filteredEntities.length - 1 ? prev + 1 : 0,
                );
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex((prev) =>
                  prev > 0 ? prev - 1 : filteredEntities.length - 1,
                );
              } else if (e.key === "Enter" && filteredEntities[selectedIndex]) {
                e.preventDefault();
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
                handleAddRelationship(filteredEntities[selectedIndex]);
              } else if (e.key === "Escape") {
                e.preventDefault();
                setSearchOpen(false);
              }
            }}
            placeholder="Search people, places, areas…"
            className="w-full px-2 py-1.5 text-xs font-mono bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-md text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none mb-1"
          />
          <div className="flex flex-col gap-0.5 max-h-48 overflow-auto">
            {filteredEntities.map((item, index) => (
              <button
                key={`${item.type}-${item.id}`}
                type="button"
                onClick={() => handleAddRelationship(item)}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors cursor-pointer",
                  "text-stone-600 dark:text-stone-400",
                  index === selectedIndex
                    ? "bg-stone-200 dark:bg-stone-700"
                    : "hover:bg-stone-100 dark:hover:bg-stone-800",
                )}
              >
                {item.emoji && (
                  <span className="text-xs flex-shrink-0">{item.emoji}</span>
                )}
                <span className="text-xs font-mono flex-1 min-w-0 truncate">
                  {item.name}
                </span>
                <span className="text-[10px] text-stone-400 dark:text-stone-500 flex-shrink-0 uppercase">
                  {typeLabel(item.type)}
                </span>
              </button>
            ))}
            {filteredEntities.length === 0 && (
              <span className="text-xs font-mono text-stone-400 dark:text-stone-500 px-2 py-1.5">
                No matches
              </span>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
