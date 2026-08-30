"use client";

import { observer, use$ } from "@legendapp/state/react";
import { Plus, User } from "lucide-react";
import { useState } from "react";
import { displayName, createPerson } from "@/domain/entities/Person";
import type { Person } from "@/domain/entities/Person";
import { slugify } from "@/domain/entities/Moment";
import { people$, places$ } from "@/infrastructure/state/store";
import { columnWidth } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

const UNCATEGORIZED = "uncategorized";

function groupByCategory(people: Person[]): Record<string, Person[]> {
  const groups: Record<string, Person[]> = {};
  for (const person of people) {
    const cat = person.category || UNCATEGORIZED;
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(person);
  }
  for (const list of Object.values(groups)) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  return groups;
}

const CATEGORY_ORDER = ["family", "friends", "lovers"];

function sortedCategories(groups: Record<string, Person[]>): string[] {
  const cats = Object.keys(groups);
  return cats.sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    if (a === UNCATEGORIZED) return 1;
    if (b === UNCATEGORIZED) return -1;
    return a.localeCompare(b);
  });
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

function CategoryColumn({
  category,
  people,
  onAddPerson,
}: {
  category: string;
  people: Person[];
  onAddPerson: (category: string) => void;
}) {
  const label = category === UNCATEGORIZED ? "uncategorized" : category;

  return (
    <div
      className={cn(
        "flex flex-col snap-start rounded-lg",
        columnWidth.scrollableClassName,
      )}
    >
      {/* Header */}
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
          onClick={() => onAddPerson(category)}
          className="ml-auto p-1 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
          aria-label={`Add person to ${label}`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Divider */}
      <div className="h-[3px] mx-4 bg-stone-300 dark:bg-stone-600" />

      {/* People list */}
      <div
        className="flex flex-col gap-3 p-4 flex-1 overflow-y-auto"
        style={{ maxHeight: "calc(100vh - 16rem)" }}
      >
        {people.length === 0 ? (
          <button
            type="button"
            onClick={() => onAddPerson(category)}
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
      category: category === UNCATEGORIZED ? null : category,
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

export const PeopleBoardBuilder = observer(() => {
  const allPeople = use$(people$);
  const [addingToCategory, setAddingToCategory] = useState<string | null>(null);

  const people = Object.values(allPeople).filter((p) => !p.isSelf);
  const groups = groupByCategory(people);
  const categories = sortedCategories(groups);

  // If no people exist at all, show a single empty-state column
  if (categories.length === 0) {
    return (
      <div className="flex gap-4 overflow-x-auto px-4 py-4 h-full snap-x snap-mandatory scroll-smooth">
        <CategoryColumn
          category={UNCATEGORIZED}
          people={[]}
          onAddPerson={(cat) => setAddingToCategory(cat)}
        />
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto px-4 py-4 h-full snap-x snap-mandatory scroll-smooth">
      {categories.map((cat) => (
        <div key={cat} className="flex flex-col">
          <CategoryColumn
            category={cat}
            people={groups[cat]}
            onAddPerson={(c) => setAddingToCategory(c)}
          />
          {addingToCategory === cat && (
            <InlineAddPerson
              category={cat}
              onClose={() => setAddingToCategory(null)}
            />
          )}
        </div>
      ))}
    </div>
  );
});
