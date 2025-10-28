# Inline Plan Experience Design

**Date:** 2025-10-26
**Status:** Approved for implementation
**Goal:** Reduce clicks and context switches in Plan tool habit creation

## Problem

Creating habits in the Plan tool requires too many clicks:
1. Click "+ New habit" button
2. Dialog opens (full-screen overlay)
3. Fill form fields
4. Click "Create" button

Users lose visual context when the dialog opens. They cannot see other habits in the area while creating.

## Solution

Add inline controls to area cards. Users type directly in the card without opening dialogs.

### Area Header: Two-Row Layout

**Row 1: Identity controls**
- Emoji picker (existing)
- Area name input (modify to extract #tags)
- Color picker (existing, hover reveal)

**Row 2: Metadata**
- Attitude selector chip (new)
- Tag badges (new, extracted from name)

```
┌─────────────────────────────────────────────┐
│ 🟢 Wellness                            [🎨] │
│ [◇ Beginning]  #focus  #morning             │
└─────────────────────────────────────────────┘
```

### Habit Creation: Always-Visible Input

Replace "+ New habit" button with permanent input field at bottom of card:

```
┌─────────────────────────────────────────────┐
│ Type habit name...                          │
└─────────────────────────────────────────────┘
```

**Interaction:**
1. Type habit name
2. Press Enter
3. Habit appears in list above

**Smart defaults:**
- Area: Pre-selected (card's area)
- Emoji: Auto-suggested from name
- Tags: None (add via edit if needed)

Users can edit habits after creation by clicking them.

## Implementation Changes

### 1. Modify PlanAreaCard Header

Add to area header:
- Tag extraction logic (reuse `useTagExtraction` hook)
- Tag badges row below name
- Attitude selector button

**New components:**
- `AttitudeChip` - Chip-style button for attitude selection
- Uses existing `AttitudeSelector` popover
- Uses existing `TagBadges` component

### 2. Replace "+ New habit" Button

Replace button with permanent input field:
- Auto-focus on mount (optional)
- Enter to create habit
- Escape to clear
- Smart emoji suggestion
- No dialog required

### 3. Area Entity Updates

Areas already have `attitude` and `tags` fields. Wire them to UI:
- `area.attitude: Attitude | null`
- `area.tags: string[]`

### 4. Visual Design

**Attitude chip styling:**
- Border: area color
- Background: white/stone-50
- Icon + label format: `◇ Beginning`
- Clickable, opens AttitudeSelector

**Tag badges:**
- Background: stone-100
- Text only, no icon
- Removable (× button)
- Standard badge component

**Habit input:**
- Full width at card bottom
- Placeholder: "Type habit name..."
- Same styling as existing inputs
- Blur loses focus, doesn't create

## User Flow

### Create Habit (Zero Clicks)
1. Type in input field
2. Press Enter
3. Habit appears

### Set Area Attitude
1. Click attitude chip
2. Select from popover
3. Chip updates

### Add Area Tags
1. Click area name
2. Type "#tagname"
3. Tag extracts to badge row
4. Save name (Enter or blur)

### Edit Habit
1. Click habit (existing behavior)
2. Opens HabitFormDialog
3. Edit details

## Success Criteria

- Habit creation: 1 action (type + Enter)
- Area attitude: 2 actions (click chip + select)
- Area tags: Inline as you edit name
- No context loss: All editing happens in card
- Visual consistency: Matches existing design system

## Notes

- Keeps HabitFormDialog for editing (full feature set)
- Inline creation optimizes for speed (name only)
- Emoji auto-suggestion reduces customization need
- Users edit habits after creation for detailed changes
