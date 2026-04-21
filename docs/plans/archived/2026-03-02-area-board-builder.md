# Area Board Builder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the split-pane /plant tab (AreaGallery + CyclePane) with a single full-width horizontal-scroll column board where each area is a column.

**Architecture:** Presenter-layer only change. Domain and application layers untouched. New components mirror CycleDeckBuilder's column pattern adapted for areas with habits. DnD handlers stay in PlantPage.

**Tech Stack:** React, @dnd-kit/core + @dnd-kit/sortable, @legendapp/state, Shadcn/ui (Popover, DropdownMenu), existing ColorPicker + EmojiPicker.

---

### Task 1: Create AreaColumnHeader

**Files:**
- Create: `src/components/AreaColumnHeader.tsx`

**Step 1: Create the component**

```tsx
/** biome-ignore-all lint/a11y/noAutofocus: <explanation> */
"use client";

import { Archive, MoreVertical, Pencil } from "lucide-react";
import { useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { ColorPicker } from "@/components/ColorPicker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  EmojiPicker,
  EmojiPickerContent,
  EmojiPickerFooter,
  EmojiPickerSearch,
} from "@/components/ui/emoji-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Area } from "@/domain/entities/Area";

interface AreaColumnHeaderProps {
  area: Area;
  habitCount: number;
  onUpdateArea: (areaId: string, updates: Partial<Area>) => void;
  onArchiveArea: (areaId: string) => void;
}

export function AreaColumnHeader({
  area,
  habitCount,
  onUpdateArea,
  onArchiveArea,
}: AreaColumnHeaderProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(area.name);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const handleSaveName = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== area.name) {
      onUpdateArea(area.id, { name: trimmed });
    }
    setIsEditingName(false);
  };

  const handleStartEditing = () => {
    setEditName(area.name);
    setIsEditingName(true);
  };

  const handleEmojiSelect = (selectedEmoji: string) => {
    onUpdateArea(area.id, { emoji: selectedEmoji });
    setEmojiPickerOpen(false);
  };

  const handleColorChange = (newColor: string) => {
    onUpdateArea(area.id, { color: newColor });
  };

  // Enter to save, Escape to cancel
  useHotkeys(
    "enter",
    () => handleSaveName(),
    { enableOnFormTags: true, enabled: isEditingName },
    [editName]
  );

  useHotkeys(
    "escape",
    () => {
      setEditName(area.name);
      setIsEditingName(false);
    },
    { enableOnFormTags: true, enabled: isEditingName },
    [area.name]
  );

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Emoji Picker */}
        <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="text-xl flex-shrink-0 hover:bg-stone-100 dark:hover:bg-stone-800 rounded w-8 h-8 flex items-center justify-center transition-colors"
              aria-label="Change emoji"
            >
              {area.emoji}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-fit p-0" align="start">
            <EmojiPicker
              className="h-[342px]"
              onEmojiSelect={({ emoji }) => handleEmojiSelect(emoji)}
            >
              <EmojiPickerSearch />
              <EmojiPickerContent />
              <EmojiPickerFooter />
            </EmojiPicker>
          </PopoverContent>
        </Popover>

        {/* Area Name */}
        {isEditingName ? (
          <input
            ref={nameInputRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSaveName}
            autoFocus
            className="flex-1 min-w-0 px-2 py-1 text-sm font-mono font-semibold bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-600 rounded focus:outline-none focus:border-stone-400 dark:focus:border-stone-500"
          />
        ) : (
          <h3 className="text-sm font-mono font-medium text-stone-700 dark:text-stone-300 truncate">
            {area.name}
          </h3>
        )}

        {/* Habit count */}
        <span className="text-xs font-mono text-stone-400 dark:text-stone-500 flex-shrink-0">
          {habitCount}
        </span>
      </div>

      {/* Burger Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded transition-colors flex-shrink-0"
            aria-label="Area settings"
          >
            <MoreVertical className="w-4 h-4 text-stone-500 dark:text-stone-400" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {/* Color Picker (inline) */}
          <div className="px-2 py-2">
            <p className="text-xs font-mono text-stone-500 dark:text-stone-400 mb-2">
              Color
            </p>
            <ColorPicker value={area.color} onChange={handleColorChange} />
          </div>

          <DropdownMenuSeparator />

          {/* Edit Name */}
          <DropdownMenuItem onSelect={handleStartEditing}>
            <Pencil className="w-4 h-4 mr-2" />
            Edit name
          </DropdownMenuItem>

          {/* Archive */}
          <DropdownMenuItem
            onSelect={() => onArchiveArea(area.id)}
            className="text-red-600 dark:text-red-400"
          >
            <Archive className="w-4 h-4 mr-2" />
            Archive area
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/AreaColumnHeader.tsx
git commit -m "feat: add AreaColumnHeader with emoji picker, color picker, and burger menu"
```

---

### Task 2: Create AreaBoardColumn

**Files:**
- Create: `src/components/AreaBoardColumn.tsx`

**Step 1: Create the component**

```tsx
"use client";

import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import { AreaColumnHeader } from "@/components/AreaColumnHeader";
import { PlanHabitsList } from "@/components/PlanHabitsList";
import type { Area } from "@/domain/entities/Area";
import type { Habit } from "@/domain/entities/Habit";
import { columnWidth } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

interface AreaBoardColumnProps {
  area: Area;
  habits: Habit[];
  onUpdateArea: (areaId: string, updates: Partial<Area>) => void;
  onArchiveArea: (areaId: string) => void;
  onEditHabit: (habitId: string) => void;
  onArchiveHabit: (habitId: string) => void;
  onCreateHabit: () => void;
}

export function AreaBoardColumn({
  area,
  habits,
  onUpdateArea,
  onArchiveArea,
  onEditHabit,
  onArchiveHabit,
  onCreateHabit,
}: AreaBoardColumnProps) {
  // Sortable for area reordering (the column itself is draggable)
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: area.id,
    data: {
      type: "area",
      areaId: area.id,
    },
  });

  // Droppable for receiving habits from other areas
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `area-${area.id}`,
    data: {
      targetType: "area",
      targetAreaId: area.id,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={(node) => {
        setSortableRef(node);
        setDroppableRef(node);
      }}
      style={style}
      className={cn(
        "flex flex-col snap-start rounded-lg",
        columnWidth.scrollableClassName,
        isOver && "ring-2 ring-stone-400 dark:ring-stone-500 bg-stone-50 dark:bg-stone-800/50",
      )}
    >
      {/* Draggable Header (drag handle for area reorder) */}
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <AreaColumnHeader
          area={area}
          habitCount={habits.length}
          onUpdateArea={onUpdateArea}
          onArchiveArea={onArchiveArea}
        />
      </div>

      {/* Colored Divider */}
      <div
        className="h-[3px] mx-4 mb-2"
        style={{ backgroundColor: area.color }}
      />

      {/* Habits List */}
      <div className="flex flex-col gap-3 p-4 min-h-[300px] flex-1">
        {habits.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[240px] gap-3 py-8">
            <div className="text-4xl opacity-20">{area.emoji}</div>
            <div className="text-center space-y-1">
              <p className="text-sm text-stone-500 dark:text-stone-400 font-mono">
                No habits yet
              </p>
              <p className="text-xs text-stone-400 dark:text-stone-500">
                Click below to add one
              </p>
            </div>
          </div>
        ) : (
          <PlanHabitsList
            habits={habits}
            areaId={area.id}
            areaColor={area.color}
            onEditHabit={onEditHabit}
            onArchiveHabit={onArchiveHabit}
          />
        )}
      </div>

      {/* Add Habit Button */}
      <div className="px-4 pb-4 pt-2">
        <button
          type="button"
          onClick={onCreateHabit}
          className={cn(
            "w-full px-4 py-2.5 rounded-md",
            "flex items-center justify-center gap-2",
            "text-sm font-mono font-medium",
            "bg-white dark:bg-stone-900",
            "border-2 border-stone-300 dark:border-stone-600",
            "hover:border-stone-400 dark:hover:border-stone-500",
            "hover:shadow-sm",
            "text-stone-700 dark:text-stone-300",
            "transition-all duration-150",
          )}
          style={{ borderColor: `${area.color}40` }}
        >
          <Plus className="w-4 h-4" />
          <span>Add habit</span>
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/AreaBoardColumn.tsx
git commit -m "feat: add AreaBoardColumn with sortable/droppable DnD and habits list"
```

---

### Task 3: Create EmptyAreaColumn

**Files:**
- Create: `src/components/EmptyAreaColumn.tsx`

**Step 1: Create the component**

Adapts `EmptyAreaCard` to column form factor using `columnWidth.scrollableClassName`.

```tsx
/** biome-ignore-all lint/a11y/noAutofocus: <explanation> */
"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { ColorPicker } from "@/components/ColorPicker";
import {
  EmojiPicker,
  EmojiPickerContent,
  EmojiPickerFooter,
  EmojiPickerSearch,
} from "@/components/ui/emoji-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  extractLeadingEmoji,
  suggestEmojiForAreaName,
} from "@/lib/emoji-utils";
import { columnWidth } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

interface EmptyAreaColumnProps {
  onCreateArea: (name: string, emoji: string, color: string) => void;
}

export function EmptyAreaColumn({ onCreateArea }: EmptyAreaColumnProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("⭐");
  const [color, setColor] = useState("#3b82f6");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const handleCancel = () => {
    setIsCreating(false);
    setName("");
    setEmoji("⭐");
    setColor("#3b82f6");
  };

  const handleSave = () => {
    if (!name.trim()) {
      handleCancel();
      return;
    }
    onCreateArea(name.trim(), emoji, color);
    handleCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleNameChange = (value: string) => {
    setName(value);

    const { emoji: leadingEmoji, remainingText } = extractLeadingEmoji(value);
    if (leadingEmoji && remainingText.length > 0) {
      setEmoji(leadingEmoji);
      setName(remainingText);
      return;
    }

    if (!leadingEmoji && value.trim().length >= 2) {
      const suggested = suggestEmojiForAreaName(value);
      if (suggested) {
        setEmoji(suggested);
      }
    }
  };

  const handleEmojiSelect = (selectedEmoji: string) => {
    setEmoji(selectedEmoji);
    setEmojiPickerOpen(false);
  };

  if (isCreating) {
    return (
      <div
        className={cn(
          "flex flex-col snap-start rounded-lg overflow-hidden",
          "border border-stone-300 dark:border-stone-600",
          columnWidth.scrollableClassName,
        )}
        style={{ backgroundColor: `${color}08` }}
      >
        {/* Header — editing mode */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-2">
            <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="text-xl flex-shrink-0 hover:bg-stone-100 dark:hover:bg-stone-800 rounded w-8 h-8 flex items-center justify-center transition-colors"
                  aria-label="Change emoji"
                >
                  {emoji}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-fit p-0" align="start">
                <EmojiPicker
                  className="h-[342px]"
                  onEmojiSelect={({ emoji }) => handleEmojiSelect(emoji)}
                >
                  <EmojiPickerSearch />
                  <EmojiPickerContent />
                  <EmojiPickerFooter />
                </EmojiPicker>
              </PopoverContent>
            </Popover>

            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              autoFocus
              placeholder="Area name..."
              className="flex-1 min-w-0 px-2 py-1 text-sm font-mono font-medium bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-600 rounded focus:outline-none focus:border-stone-400 dark:focus:border-stone-500"
            />

            <div className="flex-shrink-0">
              <ColorPicker value={color} onChange={setColor} />
            </div>
          </div>
        </div>

        {/* Colored Divider */}
        <div
          className="h-[3px] mx-4 mb-2"
          style={{ backgroundColor: color }}
        />

        {/* Content */}
        <div className="flex-1 p-4 min-h-[300px] flex flex-col items-center justify-center">
          <p className="text-xs font-mono text-stone-400 dark:text-stone-500 text-center">
            Press Enter to save, Escape to cancel
          </p>
        </div>
      </div>
    );
  }

  // Default: clickable empty column
  return (
    <button
      type="button"
      onClick={() => setIsCreating(true)}
      className={cn(
        "group flex flex-col snap-start rounded-lg overflow-hidden text-left",
        "border border-dashed border-stone-300 dark:border-stone-600",
        "hover:border-stone-400 dark:hover:border-stone-500",
        "bg-stone-50/50 dark:bg-stone-900/30",
        "hover:bg-stone-100/50 dark:hover:bg-stone-800/30",
        "transition-colors duration-200 cursor-pointer",
        columnWidth.scrollableClassName,
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2">
        <div className="w-8 h-8 rounded flex items-center justify-center bg-stone-200/60 dark:bg-stone-700/60 group-hover:bg-stone-300/60 dark:group-hover:bg-stone-600/60 transition-colors flex-shrink-0">
          <Plus className="w-4 h-4 text-stone-500 dark:text-stone-400" />
        </div>
        <span className="text-sm font-mono font-medium text-stone-500 dark:text-stone-400 group-hover:text-stone-700 dark:group-hover:text-stone-200 transition-colors">
          New area
        </span>
      </div>

      {/* Divider placeholder */}
      <div className="h-[3px] mx-4 mb-2 bg-stone-200 dark:bg-stone-700" />

      {/* Content */}
      <div className="flex-1 p-4 min-h-[300px] flex flex-col items-center justify-center gap-1">
        <p className="text-xs font-mono text-stone-400 dark:text-stone-500 text-center">
          Click to create a new area
        </p>
      </div>
    </button>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/EmptyAreaColumn.tsx
git commit -m "feat: add EmptyAreaColumn with inline creation form"
```

---

### Task 4: Create AreaBoardBuilder

**Files:**
- Create: `src/components/AreaBoardBuilder.tsx`

**Step 1: Create the component**

The orchestrating container — horizontal scroll, maps areas to columns, includes empty column at end.

```tsx
"use client";

import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { observer, use$ } from "@legendapp/state/react";
import { AreaService } from "@/application/services/AreaService";
import { HabitService } from "@/application/services/HabitService";
import { AreaBoardColumn } from "@/components/AreaBoardColumn";
import { EmptyAreaColumn } from "@/components/EmptyAreaColumn";
import { HabitFormDialog } from "@/components/HabitFormDialog";
import type { Area, UpdateAreaProps } from "@/domain/entities/Area";
import type { CreateHabitProps, UpdateHabitProps } from "@/domain/entities/Habit";
import { activeAreas$, activeHabits$ } from "@/infrastructure/state/store";
import {
  habitFormState$,
  openHabitFormCreate,
  openHabitFormEdit,
} from "@/infrastructure/state/ui-store";

export const AreaBoardBuilder = observer(() => {
  const areaService = new AreaService();
  const habitService = new HabitService();

  const areas = use$(activeAreas$);
  const habits = use$(activeHabits$);

  const sortedAreas = [...areas].sort((a, b) => a.order - b.order);

  // Group habits by area
  const habitsByArea: Record<string, typeof habits> = {};
  for (const habit of habits) {
    if (!habitsByArea[habit.areaId]) {
      habitsByArea[habit.areaId] = [];
    }
    habitsByArea[habit.areaId].push(habit);
  }

  // Area CRUD
  const handleCreateArea = (name: string, emoji: string, color: string) => {
    const result = areaService.createArea({
      name,
      emoji,
      color,
      order: areas.length,
    });
    if ("error" in result) {
      alert(`Failed to create area: ${result.error}`);
    }
  };

  const handleUpdateArea = (areaId: string, updates: UpdateAreaProps) => {
    const result = areaService.updateArea(areaId, updates);
    if ("error" in result) {
      alert(`Failed to update area: ${result.error}`);
    }
  };

  const handleArchiveArea = (areaId: string) => {
    const result = areaService.archiveArea(areaId);
    if ("error" in result) {
      alert(`Failed to archive area: ${result.error}`);
    }
  };

  // Habit CRUD
  const handleOpenCreateHabit = (areaId: string) => {
    openHabitFormCreate({ areaId });
  };

  const handleEditHabit = (habitId: string) => {
    const habit = habits.find((h) => h.id === habitId);
    if (habit) {
      openHabitFormEdit(habitId, habit);
    }
  };

  const handleArchiveHabit = (habitId: string) => {
    const result = habitService.archiveHabit(habitId);
    if ("error" in result) {
      alert(`Failed to archive habit: ${result.error}`);
    }
  };

  const handleSaveHabit = (props: CreateHabitProps | UpdateHabitProps) => {
    const formState = habitFormState$.peek();

    if (formState.mode === "edit" && formState.editingHabitId) {
      const result = habitService.updateHabit(formState.editingHabitId, props);
      if ("error" in result) {
        alert(`Failed to update habit: ${result.error}`);
      }
    } else {
      const areaHabits = habitsByArea[props.areaId!] || [];
      const result = habitService.createHabit({
        ...props,
        order: areaHabits.length,
      } as CreateHabitProps);
      if ("error" in result) {
        alert(`Failed to create habit: ${result.error}`);
      }
    }
  };

  const handleDeleteHabit = () => {
    const formState = habitFormState$.peek();
    if (!formState.editingHabitId) return;

    const result = habitService.archiveHabit(formState.editingHabitId);
    if ("error" in result) {
      alert(`Failed to archive habit: ${result.error}`);
    }
  };

  return (
    <>
      <SortableContext
        items={sortedAreas.map((a) => a.id)}
        strategy={horizontalListSortingStrategy}
      >
        <div className="flex gap-4 overflow-x-auto px-4 py-4 h-full snap-x snap-mandatory scroll-smooth">
          {sortedAreas.map((area: Area) => (
            <AreaBoardColumn
              key={area.id}
              area={area}
              habits={habitsByArea[area.id] || []}
              onUpdateArea={handleUpdateArea}
              onArchiveArea={handleArchiveArea}
              onEditHabit={handleEditHabit}
              onArchiveHabit={handleArchiveHabit}
              onCreateHabit={() => handleOpenCreateHabit(area.id)}
            />
          ))}

          <EmptyAreaColumn onCreateArea={handleCreateArea} />
        </div>
      </SortableContext>

      <HabitFormDialog onSave={handleSaveHabit} onDelete={handleDeleteHabit} />
    </>
  );
});
```

**Step 2: Commit**

```bash
git add src/components/AreaBoardBuilder.tsx
git commit -m "feat: add AreaBoardBuilder with horizontal scroll columns and habit CRUD"
```

---

### Task 5: Simplify PlantPage

**Files:**
- Modify: `src/app/plant/page.tsx`

**Step 1: Rewrite PlantPage**

Remove PanelGroup, CyclePane, PaneHeader. Keep DndContext with simplified drag handlers (drop Case 3 for cycle-deck). Use AreaBoardBuilder as the sole content.

```tsx
"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { observer, use$ } from "@legendapp/state/react";
import { useState } from "react";
import { AreaService } from "@/application/services/AreaService";
import { HabitService } from "@/application/services/HabitService";
import { AreaBoardBuilder } from "@/components/AreaBoardBuilder";
import { DraggableHabitItem } from "@/components/DraggableHabitItem";
import { LandscapePrompt } from "@/components/LandscapePrompt";
import {
  activeAreas$,
  activeHabits$,
  areas$,
} from "@/infrastructure/state/store";

const PlantPage = observer(() => {
  const areaService = new AreaService();
  const habitService = new HabitService();
  const areas = use$(activeAreas$);
  const habits = use$(activeHabits$);

  const [activeId, setActiveId] = useState<string | null>(null);

  // Custom collision detection
  const customCollisionDetection = (args: any) => {
    const { active } = args;
    const activeData = active?.data?.current;

    if (activeData?.type === "habit") {
      const pointerCollisions = pointerWithin(args);
      const areaCollisions = pointerCollisions.filter((collision: any) =>
        collision.id.toString().startsWith("area-")
      );
      if (areaCollisions.length > 0) {
        return areaCollisions;
      }
      return rectIntersection(args);
    }

    return closestCenter(args);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const dragData = active.data.current as {
      habitId?: string;
      sourceAreaId?: string;
      type?: string;
    };
    const dropData = over.data.current as {
      habitId?: string;
      sourceAreaId?: string;
      targetType?: string;
      targetAreaId?: string;
      type?: string;
    };

    // Case 1: Reorder habits within same area
    if (
      dragData?.type === "habit" &&
      dropData?.type === "habit" &&
      dragData.sourceAreaId === dropData.sourceAreaId &&
      active.id !== over.id
    ) {
      const areaId = dragData.sourceAreaId;
      if (!areaId) return;

      const areaHabits = habits
        .filter((h) => h.areaId === areaId)
        .sort((a, b) => a.order - b.order);

      const oldIndex = areaHabits.findIndex((h) => h.id === active.id);
      const newIndex = areaHabits.findIndex((h) => h.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(areaHabits, oldIndex, newIndex);
      for (const [index, habit] of reordered.entries()) {
        const result = habitService.updateHabit(habit.id, { order: index });
        if ("error" in result) {
          console.error(`Failed to update habit order: ${result.error}`);
        }
      }
      return;
    }

    // Case 2: Drag habit to different area
    if (dragData?.type === "habit" && dropData?.targetType === "area") {
      const habitId = dragData.habitId;
      const sourceAreaId = dragData.sourceAreaId;
      const targetAreaId = dropData.targetAreaId;

      if (habitId && targetAreaId && sourceAreaId !== targetAreaId) {
        const result = habitService.updateHabit(habitId, { areaId: targetAreaId });
        if ("error" in result) {
          alert(`Failed to move habit: ${result.error}`);
        }
      }
      return;
    }

    // Case 3: Area reordering
    if (dragData?.type === "area" && (dropData?.type === "area" || !dropData?.type)) {
      const sortedAreas = [...areas].sort((a, b) => a.order - b.order);
      const oldIndex = sortedAreas.findIndex((area) => area.id === active.id);
      const newIndex = sortedAreas.findIndex((area) => area.id === over.id);

      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      const reordered = arrayMove(sortedAreas, oldIndex, newIndex);
      for (const [index, area] of reordered.entries()) {
        const updated = areaService.updateArea(area.id, { order: index });
        if ("error" in updated) return;
        areas$[area.id].set(updated);
      }
      return;
    }
  };

  return (
    <>
      <LandscapePrompt />

      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        autoScroll={{
          threshold: { x: 0.05, y: 0.05 },
          acceleration: 5,
        }}
      >
        <div className="h-dvh bg-background transition-colors">
          <AreaBoardBuilder />
        </div>

        <DragOverlay>
          {activeId
            ? (() => {
                const activeHabit = habits.find((h) => h.id === activeId);
                if (!activeHabit) return null;

                const area = areas.find((a) => a.id === activeHabit.areaId);
                if (!area?.color) return null;

                return (
                  <DraggableHabitItem
                    habit={activeHabit}
                    areaColor={area.color}
                    onEdit={() => {}}
                  />
                );
              })()
            : null}
        </DragOverlay>
      </DndContext>
    </>
  );
});

export default PlantPage;
```

**Step 2: Verify the app compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors related to plant page or new components.

**Step 3: Commit**

```bash
git add src/app/plant/page.tsx
git commit -m "feat: simplify plant page to full-width AreaBoardBuilder, remove CyclePane"
```

---

### Task 6: Visual QA and cleanup

**Step 1: Check for unused imports in old components**

Verify these files are no longer imported from anywhere critical:
- `src/components/AreaGallery.tsx` — check if imported elsewhere besides plant page
- `src/components/PlanAreaCard.tsx` — check if imported elsewhere besides AreaGallery
- `src/components/CyclePane.tsx` — check if imported elsewhere besides plant page

If any are only imported from files we've changed, they're safe to leave (not delete — they may be useful reference).

**Step 2: Verify removed imports don't break anything**

Run: `pnpm tsc --noEmit`
Expected: Clean compilation.

**Step 3: Manual visual QA**

Check in the running app:
- Columns scroll horizontally with snap
- Emoji picker opens from column header
- Burger menu shows color picker + edit name + archive
- Habits display correctly in each column
- Drag habits between columns (changes area)
- Drag habits within a column (reorders)
- Drag columns to reorder areas
- Empty "New area" column appears at end and works
- Add habit button in each column opens the habit form
- HabitFormDialog still works for create and edit

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: visual QA adjustments for area board builder"
```
