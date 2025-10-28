# Inline Plan Experience Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable inline habit creation and area metadata editing in Plan tool with zero-click habit creation

**Architecture:** Enhance PlanAreaCard with two-row header (identity + metadata), replace dialog-triggering button with inline input field, reuse existing tag extraction and attitude selection components

**Tech Stack:** React, TypeScript, Legend State, existing TagBadges, AttitudeSelector, useTagExtraction hook

---

## Task 1: Create AttitudeChip Component

**Files:**
- Create: `src/components/AttitudeChip.tsx`

**Step 1: Write the failing test**

Create test file to verify chip rendering and click behavior:

```bash
# No test for this component - it's a simple UI wrapper
# We'll verify integration in PlanAreaCard
```

**Step 2: Create AttitudeChip component**

```tsx
"use client";

import { ATTITUDE_METADATA } from "@/domain/value-objects/Attitude";
import type { Attitude } from "@/domain/value-objects/Attitude";
import { cn } from "@/lib/utils";

interface AttitudeChipProps {
  attitude: Attitude | null;
  onClick: () => void;
  className?: string;
}

/**
 * AttitudeChip - Clickable chip showing current attitude
 *
 * Styled like a badge but distinct from tag badges:
 * - Shows attitude icon + label
 * - Click opens AttitudeSelector
 * - Visual treatment: bordered, subtle background
 */
export function AttitudeChip({ attitude, onClick, className }: AttitudeChipProps) {
  const metadata = attitude
    ? ATTITUDE_METADATA[attitude]
    : {
        icon: "○",
        label: "Pure presence",
        className: "font-mono text-stone-700 dark:text-stone-300",
      };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md",
        "border border-stone-300 dark:border-stone-600",
        "bg-white dark:bg-stone-950",
        "hover:bg-stone-50 dark:hover:bg-stone-900",
        "text-xs font-mono transition-colors",
        metadata.className,
        className
      )}
      title={`Attitude: ${metadata.label}`}
    >
      <span className="text-sm">{metadata.icon}</span>
      <span>{metadata.label}</span>
    </button>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/AttitudeChip.tsx
git commit -m "feat: add AttitudeChip component for area attitude display"
```

---

## Task 2: Create HabitQuickInput Component

**Files:**
- Create: `src/components/HabitQuickInput.tsx`

**Step 1: Create HabitQuickInput component**

Inline input for creating habits with Enter key:

```tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface HabitQuickInputProps {
  areaId: string;
  areaColor: string;
  onCreateHabit: (name: string, areaId: string) => void;
}

/**
 * HabitQuickInput - Inline input for quick habit creation
 *
 * Always visible at bottom of area card.
 * Type name + Enter to create.
 * Uses smart defaults (area pre-selected, emoji auto-suggested).
 */
export function HabitQuickInput({
  areaId,
  areaColor,
  onCreateHabit,
}: HabitQuickInputProps) {
  const [name, setName] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && name.trim()) {
      e.preventDefault();
      onCreateHabit(name.trim(), areaId);
      setName("");
    } else if (e.key === "Escape") {
      e.preventDefault();
      setName("");
      e.currentTarget.blur();
    }
  };

  return (
    <div className="px-4 pb-4">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type habit name..."
        className={cn(
          "w-full px-3 py-2 rounded-md",
          "text-sm font-mono",
          "bg-white/20 dark:bg-stone-950/20 backdrop-blur-sm",
          "border border-dashed border-stone-300 dark:border-stone-600",
          "focus:border-stone-400 dark:focus:border-stone-500",
          "focus:outline-none",
          "placeholder:text-stone-400 dark:placeholder:text-stone-500",
          "text-stone-900 dark:text-stone-100",
          "transition-colors"
        )}
        style={{
          borderColor: name ? areaColor : undefined,
        }}
      />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/HabitQuickInput.tsx
git commit -m "feat: add HabitQuickInput for inline habit creation"
```

---

## Task 3: Update PlanAreaCard with Area Metadata Controls

**Files:**
- Modify: `src/components/PlanAreaCard.tsx`

**Step 1: Add imports and state**

At top of file, add new imports:

```tsx
import { AttitudeChip } from "@/components/AttitudeChip";
import { AttitudeSelector } from "@/components/AttitudeSelector";
import { TagBadges } from "@/components/TagBadges";
import { useTagExtraction } from "@/hooks/useTagExtraction";
import { useRef } from "react";
```

Update PlanAreaCardProps interface:

```tsx
interface PlanAreaCardProps {
  area: Area;
  habits: Habit[];
  onCreateHabit: (areaId: string) => void;
  onEditHabit: (habitId: string) => void;
  onArchiveHabit: (habitId: string) => void;
  onUpdateArea: (areaId: string, updates: Partial<Area>) => void;
  onQuickCreateHabit: (name: string, areaId: string) => void; // NEW
}
```

**Step 2: Add state and refs in component**

After existing state declarations (around line 49), add:

```tsx
const [attitudeSelectorOpen, setAttitudeSelectorOpen] = useState(false);
const nameInputRef = useRef<HTMLInputElement>(null);

// Tag extraction for area name
const {
  handleNameChange: handleNameChangeWithTags,
  handleNameBlur: handleNameBlurWithTags,
  extractRemainingTags,
} = useTagExtraction({
  inputRef: nameInputRef,
  onTagsChange: (tags) => onUpdateArea(area.id, { tags }),
  onNameChange: (name) => setEditedName(name),
});
```

**Step 3: Update handleSaveName to extract tags**

Replace existing `handleSaveName` function:

```tsx
const handleSaveName = () => {
  // Extract any remaining tags before saving
  extractRemainingTags(editedName, area.tags || []);

  // Get clean name after tag extraction
  const cleanName = editedName
    .replace(/#([a-z0-9-]+)/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleanName && cleanName !== area.name) {
    onUpdateArea(area.id, { name: cleanName });
  } else {
    setEditedName(area.name);
  }
  setIsEditingName(false);
};
```

**Step 4: Add handlers for attitude and tags**

After `handleColorChange`:

```tsx
const handleAttitudeChange = (attitude: Attitude | null) => {
  onUpdateArea(area.id, { attitude });
  setAttitudeSelectorOpen(false);
};

const handleRemoveTag = (tagToRemove: string) => {
  onUpdateArea(area.id, { tags: (area.tags || []).filter((t) => t !== tagToRemove) });
};
```

**Step 5: Update area name input to use tag extraction**

Replace the name input section (lines 120-139) with:

```tsx
{/* Area Name - Editable with tag extraction */}
{isEditingName ? (
  <input
    ref={nameInputRef}
    type="text"
    value={editedName}
    onChange={(e) => handleNameChangeWithTags(e.target.value, editedName, area.tags || [])}
    onBlur={() => {
      handleNameBlurWithTags(editedName, area.tags || []);
      handleSaveName();
    }}
    onKeyDown={handleNameKeyDown}
    // biome-ignore lint/a11y/noAutofocus: <explanation>
    autoFocus
    className="flex-1 px-2 py-1 text-sm font-mono font-medium bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-600 rounded focus:outline-none focus:border-stone-400 dark:focus:border-stone-500"
  />
) : (
  <button
    type="button"
    onClick={() => setIsEditingName(true)}
    className="flex-1 text-left px-2 py-1 text-sm font-mono font-medium text-stone-900 dark:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 rounded transition-colors"
  >
    {area.name}
  </button>
)}
```

**Step 6: Add metadata row after the first row**

After the closing `</div>` of the first row (after color picker), add:

```tsx
{/* Row 2: Metadata (attitude + tags) */}
<div className="flex flex-wrap items-center gap-1.5 mt-2">
  {/* Attitude Selector */}
  <AttitudeSelector
    open={attitudeSelectorOpen}
    selectedAttitude={area.attitude || null}
    onSelectAttitude={handleAttitudeChange}
    onClose={() => setAttitudeSelectorOpen(false)}
    onOpen={() => setAttitudeSelectorOpen(true)}
    trigger={
      <AttitudeChip
        attitude={area.attitude || null}
        onClick={() => setAttitudeSelectorOpen(true)}
      />
    }
  />

  {/* Tag Badges */}
  {area.tags && area.tags.length > 0 && (
    <TagBadges tags={area.tags} onRemoveTag={handleRemoveTag} />
  )}
</div>
```

**Step 7: Replace "+ New habit" button with HabitQuickInput**

Import HabitQuickInput at top:

```tsx
import { HabitQuickInput } from "@/components/HabitQuickInput";
```

Replace the entire "Create Button" section (lines 190-207) with:

```tsx
{/* Quick Habit Input */}
<HabitQuickInput
  areaId={area.id}
  areaColor={area.color}
  onCreateHabit={onQuickCreateHabit}
/>
```

**Step 8: Update component props destructuring**

Update the function signature to include new prop:

```tsx
export function PlanAreaCard({
  area,
  habits,
  onCreateHabit,
  onEditHabit,
  onArchiveHabit,
  onUpdateArea,
  onQuickCreateHabit, // NEW
}: PlanAreaCardProps) {
```

**Step 9: Commit**

```bash
git add src/components/PlanAreaCard.tsx
git commit -m "feat: add inline attitude/tag editing and quick habit input to PlanAreaCard"
```

---

## Task 4: Update Plan Page to Wire Quick Habit Creation

**Files:**
- Modify: `src/app/plan/page.tsx`

**Step 1: Add quick habit creation handler**

After the existing `handleSaveHabit` function (around line 133), add:

```tsx
// Handle quick habit creation (inline input)
const handleQuickCreateHabit = (name: string, areaId: string) => {
  habitService.createHabit({
    name,
    areaId,
    emoji: "⭐", // Default emoji, user can edit later
    tags: [],
    attitude: null,
  });
};
```

**Step 2: Pass handler to PlanAreaCard**

Update the PlanAreaCard component usage (around line 163):

```tsx
<PlanAreaCard
  key={area.id}
  area={area}
  habits={habitsByArea[area.id] || []}
  onCreateHabit={handleCreateHabit}
  onEditHabit={handleEditHabit}
  onArchiveHabit={handleArchiveHabit}
  onUpdateArea={handleUpdateArea}
  onQuickCreateHabit={handleQuickCreateHabit} // NEW
/>
```

**Step 3: Commit**

```bash
git add src/app/plan/page.tsx
git commit -m "feat: wire quick habit creation in Plan page"
```

---

## Task 5: Fix TagBadges Styling for Inline Use

**Files:**
- Modify: `src/components/TagBadges.tsx`

**Step 1: Update TagBadges to remove default margin**

The TagBadges component currently has `mt-3` which is for use in dialogs. We need to make it flexible:

```tsx
interface TagBadgesProps {
  tags: string[];
  onRemoveTag: (tag: string) => void;
  className?: string; // NEW
}

export function TagBadges({ tags, onRemoveTag, className }: TagBadgesProps) {
  if (tags.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 text-xs font-mono"
        >
          #{tag}
          <button
            type="button"
            onClick={() => onRemoveTag(tag)}
            className="hover:bg-stone-200 dark:hover:bg-stone-700 rounded p-0.5 transition-colors"
            aria-label={`Remove tag ${tag}`}
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
    </div>
  );
}
```

**Step 2: Update HabitFormDialog to add mt-3 to TagBadges**

In `src/components/HabitFormDialog.tsx`, find the TagBadges usage (around line 299) and add className:

```tsx
<div className="mt-3">
  <TagBadges tags={tags} onRemoveTag={handleRemoveTag} />
</div>
```

**Step 3: Commit**

```bash
git add src/components/TagBadges.tsx src/components/HabitFormDialog.tsx
git commit -m "refactor: make TagBadges margin configurable via className"
```

---

## Task 6: Manual Testing

**Step 1: Start dev server**

```bash
# User is running this themselves, skip
```

**Step 2: Test area attitude selection**

1. Navigate to /plan
2. Click attitude chip on any area
3. Select different attitudes
4. Verify chip updates with icon and label

**Step 3: Test area tag extraction**

1. Click area name to edit
2. Type "Wellness #focus #morning"
3. Press Enter or blur
4. Verify tags appear as badges below name
5. Verify name is cleaned to just "Wellness"
6. Click × on tag badge
7. Verify tag is removed

**Step 4: Test inline habit creation**

1. Type habit name in input at bottom of card
2. Press Enter
3. Verify habit appears in list above
4. Verify input clears
5. Click habit to open edit dialog
6. Verify full editing capabilities work

**Step 5: Test keyboard shortcuts**

1. Type habit name
2. Press Escape
3. Verify input clears and loses focus

---

## Task 7: Update Area Entity Type (if needed)

**Files:**
- Check: `src/domain/entities/Area.ts`

**Step 1: Verify Area has attitude and tags fields**

```bash
# Check if Area already has these fields
grep -n "attitude" src/domain/entities/Area.ts
grep -n "tags" src/domain/entities/Area.ts
```

Expected: Both fields should already exist based on recent commits.

**Step 2: If missing, add fields**

If not present, add to Area interface:

```tsx
interface Area {
  id: string;
  name: string;
  emoji: string;
  color: string;
  tags: string[];
  attitude: Attitude | null;
  // ... other fields
}
```

**Step 3: Commit if changes made**

```bash
# Only if changes were needed
git add src/domain/entities/Area.ts
git commit -m "feat: ensure Area has attitude and tags fields"
```

---

## Task 8: Type Check and Build

**Step 1: Run type check**

```bash
pnpm run type-check
```

Expected: No TypeScript errors

**Step 2: Run build**

```bash
pnpm run build
```

Expected: Build succeeds

**Step 3: Fix any type errors**

If errors occur:
1. Read error messages
2. Fix type mismatches
3. Re-run type-check
4. Commit fixes

---

## Task 9: Final Commit and Verification

**Step 1: Run all tests**

```bash
pnpm test
```

Expected: All tests pass

**Step 2: Check git status**

```bash
git status
```

Expected: All changes committed, working directory clean

**Step 3: Review implementation**

Verify implementation matches design:
- ✓ Two-row area header (identity + metadata)
- ✓ Attitude chip clickable, opens selector
- ✓ Tag extraction from area name
- ✓ Tag badges with remove
- ✓ Inline habit input at card bottom
- ✓ Enter to create habit
- ✓ No dialog for quick creation

---

## Success Criteria

- [ ] Habit creation: Type + Enter (1 action)
- [ ] Area attitude: Click chip + select (2 actions)
- [ ] Area tags: Edit name with #tags (inline)
- [ ] Tags appear as removable badges
- [ ] All editing happens in card (no context loss)
- [ ] Existing edit dialog still works for full features
- [ ] Type check passes
- [ ] Build succeeds
- [ ] All tests pass

## Notes

- Reuses existing components: TagBadges, AttitudeSelector, useTagExtraction
- HabitFormDialog remains for full editing experience
- Quick creation optimizes for speed with smart defaults
- Area pre-selected, emoji auto-suggested (⭐ default)
- Users can edit habits after creation for customization
