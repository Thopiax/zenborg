"use client";

import { observer, use$ } from "@legendapp/state/react";
import { Plus, User } from "lucide-react";
import { useState } from "react";
import { displayName, createPerson } from "@/domain/entities/Person";
import type { Person } from "@/domain/entities/Person";
import { slugify } from "@/domain/entities/Moment";
import { people$, places$ } from "@/infrastructure/state/store";
import type { PeopleGroupBy } from "@/infrastructure/state/ui-store";
import { columnWidth } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

const NONE_KEY = "__none__";
const CATEGORY_ORDER = ["family", "friends", "lovers"];

const NONE_LABELS: Record<PeopleGroupBy, string> = {
  category: "No category",
  basePlace: "No place",
  status: "No status",
};

function groupPeople(
  people: Person[],
  groupBy: PeopleGroupBy,
): { key: string; label: string; people: Person[] }[] {
  const groups = new Map<string, { label: string; people: Person[] }>();

  for (const person of people) {
    let key: string;
    let label: string;
    switch (groupBy) {
      case "category":
        key = person.category || NONE_KEY;
        label = person.category || NONE_LABELS.category;
        break;
      case "basePlace":
        key = person.basePlace || NONE_KEY;
        label = person.basePlace || NONE_LABELS.basePlace;
        break;
      case "status":
        key = person.status;
        label = person.status;
        break;
    }
    if (!groups.has(key)) groups.set(key, { label, people: [] });
    groups.get(key)!.people.push(person);
  }

  for (const { people: list } of groups.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  const entries = [...groups.entries()];
  entries.sort(([a], [b]) => {
    if (groupBy === "category") {
      const ai = CATEGORY_ORDER.indexOf(a);
      const bi = CATEGORY_ORDER.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
    }
    if (a === NONE_KEY) return 1;
    if (b === NONE_KEY) return -1;
    return a.localeCompare(b);
  });

  return entries.map(([key, { label, people }]) => ({ key, label, people }));
}

function PersonCard({ person }: { person: Person }) {
  const allPlaces = use$(places$);
  const basePlace = person.basePlace
    ? Object.values(allPlaces).find((p) => p.key === person.basePlace)
    : null;

  return (
    <div className="group flex items-center gap-2 px-3 py-3 rounded-md bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors">
      <span className="text-lg flex-shrink-0">
        {person.emoji || "👤"}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-mono font-semibold text-stone-800 dark:text-stone-200 truncate block">
          {displayName(person)}
        </span>
        {basePlace && (
          <span className="text-xs font-mono text-stone-500 dark:text-stone-400 truncate block">
            {basePlace.emoji ? `${basePlace.emoji} ` : ""}{basePlace.name}
          </span>
        )}
      </div>
      {person.status === "paused" && (
        <span className="text-xs font-mono text-stone-400 dark:text-stone-500">
          paused
        </span>
      )}
    </div>
  );
}

function PeopleColumn({
  label,
  people,
  onAddPerson,
}: {
  label: string;
  people: Person[];
  onAddPerson: (group: string) => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col snap-start rounded-lg",
        columnWidth.scrollableClassName,
      )}
    >
      <div className="px-4 py-3 flex items-center gap-2">
        <User className="w-4 h-4 text-stone-400 dark:text-stone-500" />
        <span className="text-sm font-mono font-medium text-stone-700 dark:text-stone-300">
          {label}
        </span>
        <span className="text-xs font-mono text-stone-400 dark:text-stone-500">
          {people.length}
        </span>
        <button
          type="button"
          onClick={() => onAddPerson(label)}
          className="ml-auto p-1 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
          aria-label={`Add person to ${label}`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="h-[3px] mx-4 bg-stone-300 dark:bg-stone-600" />

      <div
        className="flex flex-col gap-3 p-4 flex-1 overflow-y-auto"
        style={{ maxHeight: "calc(100vh - 16rem)" }}
      >
        {people.length === 0 ? (
          <button
            type="button"
            onClick={() => onAddPerson(label)}
            className="flex items-center justify-center gap-2 py-6 text-stone-400 dark:text-stone-500 hover:text-stone-500 dark:hover:text-stone-400 transition-colors cursor-pointer"
          >
            <span className="text-sm font-mono">Add first person</span>
          </button>
        ) : (
          people.map((person) => (
            <PersonCard key={person.id} person={person} />
          ))
        )}
      </div>
    </div>
  );
}

function InlineAddPerson({
  category,
  onClose,
}: {
  category: string;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const person = createPerson({
      name: trimmed,
      key: slugify(trimmed),
      emoji: emoji.trim() || null,
      category: category === NONE_KEY ? null : category,
    });
    people$[person.id].set(person);
    setName("");
    setEmoji("");
    onClose();
  };

  return (
    <div className="flex gap-2 px-4 pb-4">
      <input
        type="text"
        value={emoji}
        onChange={(e) => setEmoji(e.target.value)}
        placeholder="👤"
        className="w-10 text-center bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-md text-sm px-1 py-1.5"
        maxLength={2}
      />
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
          if (e.key === "Escape") onClose();
        }}
        placeholder="Name..."
        className="flex-1 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-md text-sm px-3 py-1.5 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500"
        autoFocus
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!name.trim()}
        className="px-2 py-1.5 bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 rounded-md transition-colors disabled:opacity-40"
      >
        <Plus className="w-4 h-4 text-stone-600 dark:text-stone-400" />
      </button>
    </div>
  );
}

export const PeopleBoardBuilder = observer(
  ({
    groupBy,
    filter,
    showEmpty,
  }: {
    groupBy: PeopleGroupBy;
    filter: string;
    showEmpty: boolean;
  }) => {
    const allPeople = use$(people$);
    const [addingToGroup, setAddingToGroup] = useState<string | null>(null);

    let people = Object.values(allPeople).filter((p) => !p.isSelf);
    if (filter) {
      const q = filter.toLowerCase();
      people = people.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          displayName(p).toLowerCase().includes(q),
      );
    }

    let groups = groupPeople(people, groupBy);
    if (!showEmpty) {
      groups = groups.filter((g) => g.people.length > 0);
    }

    if (groups.length === 0) {
      return (
        <div className="flex gap-4 overflow-x-auto px-4 py-4 h-full snap-x snap-mandatory scroll-smooth">
          <PeopleColumn
            label={NONE_LABELS[groupBy]}
            people={[]}
            onAddPerson={(g) => setAddingToGroup(g)}
          />
        </div>
      );
    }

    return (
      <div className="flex gap-4 overflow-x-auto px-4 py-4 h-full snap-x snap-mandatory scroll-smooth">
        {groups.map((g) => (
          <div key={g.key} className="flex flex-col">
            <PeopleColumn
              label={g.label}
              people={g.people}
              onAddPerson={() => setAddingToGroup(g.key)}
            />
            {addingToGroup === g.key && (
              <InlineAddPerson
                category={g.label}
                onClose={() => setAddingToGroup(null)}
              />
            )}
          </div>
        ))}
      </div>
    );
  },
);
