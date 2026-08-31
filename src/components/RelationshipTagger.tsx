"use client";

import { use$ } from "@legendapp/state/react";
import { Link2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createRelationship,
  type EntityType,
} from "@/domain/entities/Relationship";
import { displayName } from "@/domain/entities/Person";
import { normalizeMention } from "@/domain/services/MentionService";
import {
  areas$,
  habits$,
  people$,
  places$,
  relationships$,
} from "@/infrastructure/state/store";

interface RelationshipTaggerProps {
  entityType: EntityType;
  entityId: string;
}

export function RelationshipTagger({
  entityType,
  entityId,
}: RelationshipTaggerProps) {
  const allRelationships = use$(relationships$);
  const allAreas = use$(areas$);
  const allPeople = use$(people$);
  const allPlaces = use$(places$);
  const allHabits = use$(habits$);

  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const labelInputRef = useRef<HTMLInputElement>(null);

  const entityRels = useMemo(() => {
    return Object.values(allRelationships).filter((r) => {
      if (r.fromType === entityType && r.fromId === entityId) return true;
      if (r.toType === entityType && r.toId === entityId && r.direction === "mutual") return true;
      return false;
    });
  }, [allRelationships, entityType, entityId]);

  const existingLabels = useMemo(() => {
    const labels = new Set<string>();
    for (const r of Object.values(allRelationships)) {
      if (r.label) labels.add(r.label);
    }
    return [...labels].sort();
  }, [allRelationships]);

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

  if (entityRels.length === 0) return null;

  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-mono text-stone-500 dark:text-stone-400 mb-2">
        <Link2 className="w-3 h-3" />
        Relationships
      </label>

      <div className="flex flex-wrap gap-1.5">
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
    </div>
  );
}

export function useRelationshipFromMention(
  entityType: EntityType,
  entityId: string | null,
) {
  const allPeople = use$(people$);
  const allPlaces = use$(places$);
  const allAreas = use$(areas$);
  const allRelationships = use$(relationships$);

  return useCallback(
    (key: string) => {
      if (!entityId) return;

      let targetId: string | null = null;
      let targetType: EntityType = "person";

      for (const person of Object.values(allPeople)) {
        if (person.key === key) {
          targetId = person.id;
          targetType = "person";
          break;
        }
      }
      if (!targetId) {
        for (const place of Object.values(allPlaces)) {
          if (place.key === key) {
            targetId = place.id;
            targetType = "place";
            break;
          }
        }
      }
      if (!targetId) {
        for (const area of Object.values(allAreas)) {
          if (normalizeMention(area.name) === key) {
            targetId = area.id;
            targetType = "area";
            break;
          }
        }
      }

      if (!targetId || (targetType === entityType && targetId === entityId)) return;

      let label = "";
      if (entityType === "person" && targetType === "place") {
        const hasBasedIn = Object.values(allRelationships).some(
          (r) =>
            r.label === "based-in" &&
            ((r.fromType === "person" && r.fromId === entityId) ||
             (r.toType === "person" && r.toId === entityId && r.direction === "mutual")),
        );
        if (!hasBasedIn) label = "based-in";
      }

      const rel = createRelationship({
        fromType: entityType,
        fromId: entityId,
        toType: targetType,
        toId: targetId,
        label,
      });
      relationships$[rel.id].set(rel);
    },
    [entityType, entityId, allPeople, allPlaces, allAreas, allRelationships],
  );
}
