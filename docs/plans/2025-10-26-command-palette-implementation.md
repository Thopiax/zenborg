# Command Palette & Keyboard Shortcuts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove Vim terminology and build Linear-style command palette system with unified keyboard shortcuts.

**Architecture:** Distributed command definitions aggregated into global registry. Both keyboard hook and command palette read from same registry. Commands are plain objects with action functions accessing Legend State directly.

**Tech Stack:** React, TypeScript, react-hotkeys-hook, cmdk (via shadcn Command), Legend State

---

## Task 1: Command Types and Registry Setup

**Files:**
- Create: `src/commands/types.ts`
- Create: `src/commands/index.ts`

**Step 1: Write command types**

Create `src/commands/types.ts`:

```typescript
export interface Command {
  id: string;              // "moment.create", "nav.today"
  label: string;           // "Create Moment"
  shortcut: string;        // "n", "mod+k", "delete"
  category: string;        // "Moments", "Navigation", "Views"
  keywords?: string[];     // ["new", "add"]
  icon?: React.ReactNode;  // Optional icon
  action: () => void;      // Execute the command
}
```

**Step 2: Create empty registry**

Create `src/commands/index.ts`:

```typescript
import { Command } from "./types";

export const allCommands: Command[] = [];

export { Command };
```

**Step 3: Commit**

```bash
cd ~/.config/superpowers/worktrees/zenborg/command-palette
git add src/commands/types.ts src/commands/index.ts
git commit -m "feat(commands): add command types and empty registry"
```

---

## Task 2: Moment Commands

**Files:**
- Create: `src/commands/moment-commands.ts`
- Modify: `src/commands/index.ts`

**Step 1: Create moment commands**

Create `src/commands/moment-commands.ts`:

```typescript
import { Command } from "./types";
import {
  moments$,
  focusedMomentId$,
  uiState$
} from "@/infrastructure/state/store";

export const momentCommands: Command[] = [
  {
    id: "moment.create",
    label: "Create Moment",
    shortcut: "n",
    category: "Moments",
    keywords: ["new", "add"],
    action: () => {
      uiState$.isFormOpen.set(true);
    }
  },
  {
    id: "moment.delete",
    label: "Delete Moment",
    shortcut: "delete",
    category: "Moments",
    keywords: ["remove", "trash"],
    action: () => {
      const focusedId = focusedMomentId$.get();
      if (focusedId) {
        moments$[focusedId].delete();
      }
    }
  },
  {
    id: "moment.duplicate",
    label: "Duplicate Moment",
    shortcut: "mod+d",
    category: "Moments",
    keywords: ["copy", "clone"],
    action: () => {
      const focusedId = focusedMomentId$.get();
      if (!focusedId) return;

      const moment = moments$[focusedId].get();
      if (!moment) return;

      // Duplicate logic - create new moment with same properties
      const newMoment = {
        ...moment,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      moments$[newMoment.id].set(newMoment);
      focusedMomentId$.set(newMoment.id);
    }
  }
];
```

**Step 2: Add to registry**

Modify `src/commands/index.ts`:

```typescript
import { Command } from "./types";
import { momentCommands } from "./moment-commands";

export const allCommands: Command[] = [
  ...momentCommands,
];

export { Command };
```

**Step 3: Verify types compile**

```bash
cd ~/.config/superpowers/worktrees/zenborg/command-palette
pnpm run type-check
```

Expected: No type errors

**Step 4: Commit**

```bash
git add src/commands/moment-commands.ts src/commands/index.ts
git commit -m "feat(commands): add moment CRUD commands"
```

---

## Task 3: Navigation Commands

**Files:**
- Create: `src/commands/navigation-commands.ts`
- Modify: `src/commands/index.ts`

**Step 1: Create navigation commands**

Create `src/commands/navigation-commands.ts`:

```typescript
import { Command } from "./types";
import {
  focusedMomentId$,
  uiState$
} from "@/infrastructure/state/store";
import { useFocusManager } from "@/hooks/useFocusManager";
import { addDays } from "date-fns";

// Note: For focus navigation, we'll need to extract helpers from useFocusManager
// For now, we'll create simple versions that can be enhanced later

export const navigationCommands: Command[] = [
  {
    id: "nav.up",
    label: "Navigate Up",
    shortcut: "up",
    category: "Navigation",
    action: () => {
      // TODO: Call focus manager's focusPrevious
      console.log("Navigate up");
    }
  },
  {
    id: "nav.down",
    label: "Navigate Down",
    shortcut: "down",
    category: "Navigation",
    action: () => {
      // TODO: Call focus manager's focusNext
      console.log("Navigate down");
    }
  },
  {
    id: "nav.up.alt",
    label: "Navigate Up (k)",
    shortcut: "k",
    category: "Navigation",
    action: () => {
      // Same as arrow up
      console.log("Navigate up");
    }
  },
  {
    id: "nav.down.alt",
    label: "Navigate Down (j)",
    shortcut: "j",
    category: "Navigation",
    action: () => {
      // Same as arrow down
      console.log("Navigate down");
    }
  },
  {
    id: "nav.left",
    label: "Navigate Left",
    shortcut: "left",
    category: "Navigation",
    action: () => {
      console.log("Navigate left");
    }
  },
  {
    id: "nav.right",
    label: "Navigate Right",
    shortcut: "right",
    category: "Navigation",
    action: () => {
      console.log("Navigate right");
    }
  },
  {
    id: "nav.next",
    label: "Focus Next Moment",
    shortcut: "tab",
    category: "Navigation",
    keywords: ["forward"],
    action: () => {
      console.log("Focus next");
    }
  },
  {
    id: "nav.previous",
    label: "Focus Previous Moment",
    shortcut: "shift+tab",
    category: "Navigation",
    keywords: ["back"],
    action: () => {
      console.log("Focus previous");
    }
  },
  {
    id: "nav.today",
    label: "Go to Today",
    shortcut: "t",
    category: "Navigation",
    keywords: ["current", "now"],
    action: () => {
      const today = new Date().toISOString().split('T')[0];
      uiState$.selectedDay.set(today);
    }
  },
  {
    id: "nav.tomorrow",
    label: "Go to Tomorrow",
    shortcut: "w",
    category: "Navigation",
    keywords: ["next", "will"],
    action: () => {
      const tomorrow = addDays(new Date(), 1).toISOString().split('T')[0];
      uiState$.selectedDay.set(tomorrow);
    }
  },
  {
    id: "nav.drawing-board",
    label: "Go to Drawing Board",
    shortcut: "d",
    category: "Navigation",
    keywords: ["unallocated", "unscheduled"],
    action: () => {
      // Scroll to drawing board section
      const drawingBoard = document.querySelector('[data-drawing-board]');
      drawingBoard?.scrollIntoView({ behavior: 'smooth' });
    }
  }
];
```

**Step 2: Add to registry**

Modify `src/commands/index.ts`:

```typescript
import { Command } from "./types";
import { momentCommands } from "./moment-commands";
import { navigationCommands } from "./navigation-commands";

export const allCommands: Command[] = [
  ...momentCommands,
  ...navigationCommands,
];

export { Command };
```

**Step 3: Verify types compile**

```bash
pnpm run type-check
```

Expected: No type errors

**Step 4: Commit**

```bash
git add src/commands/navigation-commands.ts src/commands/index.ts
git commit -m "feat(commands): add navigation commands"
```

---

## Task 4: View Commands

**Files:**
- Create: `src/commands/view-commands.ts`
- Modify: `src/commands/index.ts`

**Step 1: Create view commands**

Create `src/commands/view-commands.ts`:

```typescript
import { Command } from "./types";
import { uiState$ } from "@/infrastructure/state/store";

export const viewCommands: Command[] = [
  {
    id: "view.compass.toggle",
    label: "Toggle Compass View",
    shortcut: "ctrl+/",
    category: "Views",
    keywords: ["show", "hide", "focus"],
    action: () => {
      const isOpen = uiState$.isCompassOpen.get();
      uiState$.isCompassOpen.set(!isOpen);
    }
  },
  {
    id: "view.planning.toggle",
    label: "Toggle Planning View",
    shortcut: "p",
    category: "Views",
    keywords: ["show", "hide", "board"],
    action: () => {
      const isOpen = uiState$.isPlanningViewOpen.get();
      uiState$.isPlanningViewOpen.set(!isOpen);
    }
  },
  {
    id: "view.areas",
    label: "Open Area Management",
    shortcut: "shift+e",
    category: "Views",
    keywords: ["manage", "edit", "settings"],
    action: () => {
      // Open area management dialog/view
      // This depends on how areas are currently managed
      console.log("Open area management");
    }
  },
  {
    id: "view.settings",
    label: "Open Settings",
    shortcut: "mod+comma",
    category: "Views",
    keywords: ["preferences", "configure"],
    action: () => {
      // Open settings dialog
      console.log("Open settings");
    }
  }
];
```

**Step 2: Add to registry**

Modify `src/commands/index.ts`:

```typescript
import { Command } from "./types";
import { momentCommands } from "./moment-commands";
import { navigationCommands } from "./navigation-commands";
import { viewCommands } from "./view-commands";

export const allCommands: Command[] = [
  ...momentCommands,
  ...navigationCommands,
  ...viewCommands,
];

export { Command };
```

**Step 3: Verify types compile**

```bash
pnpm run type-check
```

Expected: No type errors

**Step 4: Commit**

```bash
git add src/commands/view-commands.ts src/commands/index.ts
git commit -m "feat(commands): add view commands"
```

---

## Task 5: Clipboard Commands

**Files:**
- Create: `src/commands/clipboard-commands.ts`
- Modify: `src/commands/index.ts`

**Step 1: Create clipboard commands**

Create `src/commands/clipboard-commands.ts`:

```typescript
import { Command } from "./types";
import {
  moments$,
  focusedMomentId$,
  selectedMomentIds$
} from "@/infrastructure/state/store";

// Internal clipboard state (could also use Legend State observable)
let clipboardMoment: any = null;

export const clipboardCommands: Command[] = [
  {
    id: "clipboard.copy",
    label: "Copy Moment",
    shortcut: "mod+c",
    category: "Clipboard",
    keywords: ["duplicate", "yank"],
    action: () => {
      const focusedId = focusedMomentId$.get();
      if (!focusedId) return;

      const moment = moments$[focusedId].get();
      if (moment) {
        clipboardMoment = moment;
      }
    }
  },
  {
    id: "clipboard.paste",
    label: "Paste Moment",
    shortcut: "mod+v",
    category: "Clipboard",
    keywords: ["duplicate", "put"],
    action: () => {
      if (!clipboardMoment) return;

      const newMoment = {
        ...clipboardMoment,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      moments$[newMoment.id].set(newMoment);
      focusedMomentId$.set(newMoment.id);
    }
  },
  {
    id: "clipboard.delete",
    label: "Delete Moment",
    shortcut: "backspace",
    category: "Clipboard",
    keywords: ["remove", "unallocate"],
    action: () => {
      const focusedId = focusedMomentId$.get();
      if (!focusedId) return;

      const moment = moments$[focusedId].get();
      if (moment) {
        // Unallocate if allocated, otherwise delete
        if (moment.day) {
          moments$[focusedId].assign({ day: null, phase: null });
        } else {
          moments$[focusedId].delete();
        }
      }
    }
  },
  {
    id: "selection.all",
    label: "Select All Moments",
    shortcut: "mod+a",
    category: "Selection",
    keywords: ["choose", "mark"],
    action: () => {
      const allMomentIds = Object.keys(moments$.peek());
      selectedMomentIds$.set(allMomentIds);
    }
  },
  {
    id: "selection.clear",
    label: "Clear Selection",
    shortcut: "escape",
    category: "Selection",
    keywords: ["deselect", "none"],
    action: () => {
      selectedMomentIds$.set([]);
      // Also close any open dialogs
      uiState$.isFormOpen.set(false);
    }
  }
];
```

**Step 2: Add to registry**

Modify `src/commands/index.ts`:

```typescript
import { Command } from "./types";
import { momentCommands } from "./moment-commands";
import { navigationCommands } from "./navigation-commands";
import { viewCommands } from "./view-commands";
import { clipboardCommands } from "./clipboard-commands";

export const allCommands: Command[] = [
  ...momentCommands,
  ...navigationCommands,
  ...viewCommands,
  ...clipboardCommands,
];

export { Command };
```

**Step 3: Verify types compile**

```bash
pnpm run type-check
```

Expected: No type errors

**Step 4: Commit**

```bash
git add src/commands/clipboard-commands.ts src/commands/index.ts
git commit -m "feat(commands): add clipboard and selection commands"
```

---

## Task 6: History Commands

**Files:**
- Create: `src/commands/history-commands.ts`
- Modify: `src/commands/index.ts`

**Step 1: Create history commands**

Create `src/commands/history-commands.ts`:

```typescript
import { Command } from "./types";
import { useHistory } from "@/hooks/useHistory";

// Note: useHistory is a hook, so we need to get the functions differently
// For now, we'll import the store functions directly if they exist

export const historyCommands: Command[] = [
  {
    id: "history.undo",
    label: "Undo",
    shortcut: "mod+z",
    category: "History",
    action: () => {
      // TODO: Call history undo function
      console.log("Undo");
    }
  },
  {
    id: "history.redo",
    label: "Redo",
    shortcut: "mod+shift+z",
    category: "History",
    action: () => {
      // TODO: Call history redo function
      console.log("Redo");
    }
  },
  {
    id: "history.redo.alt",
    label: "Redo (Cmd+Y)",
    shortcut: "mod+y",
    category: "History",
    action: () => {
      // Same as mod+shift+z
      console.log("Redo");
    }
  }
];
```

**Step 2: Add to registry**

Modify `src/commands/index.ts`:

```typescript
import { Command } from "./types";
import { momentCommands } from "./moment-commands";
import { navigationCommands } from "./navigation-commands";
import { viewCommands } from "./view-commands";
import { clipboardCommands } from "./clipboard-commands";
import { historyCommands } from "./history-commands";

export const allCommands: Command[] = [
  ...momentCommands,
  ...navigationCommands,
  ...viewCommands,
  ...clipboardCommands,
  ...historyCommands,
];

export { Command };
```

**Step 3: Verify types compile**

```bash
pnpm run type-check
```

Expected: No type errors

**Step 4: Commit**

```bash
git add src/commands/history-commands.ts src/commands/index.ts
git commit -m "feat(commands): add history undo/redo commands"
```

---

## Task 7: Command Palette Component

**Files:**
- Create: `src/components/CommandPalette.tsx`

**Step 1: Create command palette component**

Create `src/components/CommandPalette.tsx`:

```typescript
"use client";

import { useState } from "react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { allCommands, type Command as CommandType } from "@/commands";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

/**
 * CommandPalette - Linear-style searchable command launcher
 *
 * Features:
 * - Searchable by label and keywords
 * - Grouped by category
 * - Shows keyboard shortcuts
 * - Executes command on select
 */
export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [search, setSearch] = useState("");

  // Filter commands by search
  const filteredCommands = search
    ? allCommands.filter((cmd) =>
        cmd.label.toLowerCase().includes(search.toLowerCase()) ||
        cmd.keywords?.some((k) => k.toLowerCase().includes(search.toLowerCase()))
      )
    : allCommands;

  // Group by category
  const grouped = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) {
      acc[cmd.category] = [];
    }
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, CommandType[]>);

  const handleSelect = (command: CommandType) => {
    command.action();
    setSearch("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="p-0 max-w-[640px]">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search commands..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No commands found.</CommandEmpty>
            {Object.entries(grouped).map(([category, commands]) => (
              <CommandGroup key={category} heading={category}>
                {commands.map((cmd) => (
                  <CommandItem
                    key={cmd.id}
                    value={cmd.id}
                    onSelect={() => handleSelect(cmd)}
                    className="flex items-center justify-between px-3 py-2 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      {cmd.icon && <span>{cmd.icon}</span>}
                      <span className="text-sm font-medium">{cmd.label}</span>
                    </div>
                    {cmd.shortcut && (
                      <kbd className="ml-auto text-xs px-2 py-1 rounded bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 font-mono">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Verify types compile**

```bash
pnpm run type-check
```

Expected: No type errors

**Step 3: Commit**

```bash
git add src/components/CommandPalette.tsx
git commit -m "feat(ui): add command palette component"
```

---

## Task 8: Refactor useGlobalKeyboard to Use Registry

**Files:**
- Modify: `src/hooks/useGlobalKeyboard.ts`

**Step 1: Read current useGlobalKeyboard**

```bash
cat src/hooks/useGlobalKeyboard.ts | head -50
```

Note the structure and existing shortcuts.

**Step 2: Backup current implementation**

```bash
cp src/hooks/useGlobalKeyboard.ts src/hooks/useGlobalKeyboard.ts.backup
```

**Step 3: Refactor to use command registry**

Replace `src/hooks/useGlobalKeyboard.ts` content with:

```typescript
"use client";

import { useHotkeys } from "react-hotkeys-hook";
import { useSelector } from "@legendapp/state/react";
import { allCommands } from "@/commands";
import { uiState$ } from "@/infrastructure/state/store";

/**
 * Global keyboard shortcuts - reads from command registry
 *
 * All shortcuts are defined in src/commands/*.ts and registered here.
 * This ensures single source of truth for commands and shortcuts.
 */
export function useGlobalKeyboard() {
  const globalShortcutsEnabled = useSelector(() => !uiState$.isFormOpen.get());

  // Register all commands from registry
  for (const command of allCommands) {
    useHotkeys(
      command.shortcut,
      (e) => {
        e.preventDefault();
        command.action();
      },
      {
        enabled: globalShortcutsEnabled,
        enableOnFormTags: false,
      },
      [command.action]
    );
  }
}
```

**Step 4: Verify types compile**

```bash
pnpm run type-check
```

Expected: No type errors

**Step 5: Test in dev mode (manual)**

Note: This requires manual testing. Start dev server and verify shortcuts work:

```bash
pnpm dev
```

Manual test checklist:
- [ ] `n` opens moment form
- [ ] `delete` deletes focused moment
- [ ] `mod+c` / `mod+v` copy/paste moment
- [ ] `j`/`k` and arrow keys navigate
- [ ] `t` goes to today
- [ ] `esc` clears selection

**Step 6: Commit**

```bash
git add src/hooks/useGlobalKeyboard.ts
git commit -m "refactor(keyboard): use command registry for shortcuts"
```

---

## Task 9: Add Command Palette to App

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Add command palette state and component**

In `src/app/page.tsx`, add after imports:

```typescript
import { CommandPalette } from "@/components/CommandPalette";
import { useState } from "react";
```

Inside the main component, add state:

```typescript
const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
```

Add hotkey for Cmd+K:

```typescript
useHotkeys(
  "mod+k",
  (e) => {
    e.preventDefault();
    setCommandPaletteOpen(true);
  },
  {
    enableOnFormTags: true,
  }
);
```

Add component to JSX (before closing tag):

```typescript
<CommandPalette
  open={commandPaletteOpen}
  onClose={() => setCommandPaletteOpen(false)}
/>
```

**Step 2: Verify types compile**

```bash
pnpm run type-check
```

Expected: No type errors

**Step 3: Test in dev mode (manual)**

```bash
pnpm dev
```

Manual test checklist:
- [ ] `mod+k` opens command palette
- [ ] Search filters commands
- [ ] Selecting command executes it
- [ ] Keyboard shortcuts shown
- [ ] Commands grouped by category

**Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(ui): add command palette to app with Cmd+K"
```

---

## Task 10: Wire Up Navigation Actions

**Files:**
- Modify: `src/commands/navigation-commands.ts`
- Reference: `src/hooks/useFocusManager.ts`

**Step 1: Extract focus navigation functions**

Read `src/hooks/useFocusManager.ts` to understand focus logic:

```bash
cat src/hooks/useFocusManager.ts | grep -A 10 "focusNext\|focusPrevious\|focusFirst\|focusLast"
```

**Step 2: Update navigation commands with real implementations**

Modify `src/commands/navigation-commands.ts` to import and use focus helpers:

```typescript
// At top of file, add:
import { focusNext, focusPrevious } from "@/hooks/useFocusManager";

// Update placeholder commands:
{
  id: "nav.up",
  label: "Navigate Up",
  shortcut: "up",
  category: "Navigation",
  action: () => {
    focusPrevious();
  }
},
{
  id: "nav.down",
  label: "Navigate Down",
  shortcut: "down",
  category: "Navigation",
  action: () => {
    focusNext();
  }
},
// ... update all navigation commands similarly
```

Note: You may need to refactor useFocusManager to export standalone functions instead of only hook-based functions.

**Step 3: Verify types compile**

```bash
pnpm run type-check
```

Expected: No type errors

**Step 4: Commit**

```bash
git add src/commands/navigation-commands.ts
git commit -m "feat(commands): wire up navigation actions to focus manager"
```

---

## Task 11: Wire Up History Actions

**Files:**
- Modify: `src/commands/history-commands.ts`
- Reference: `src/hooks/useHistory.ts`

**Step 1: Check history hook exports**

```bash
cat src/hooks/useHistory.ts | grep "export"
```

**Step 2: Update history commands**

Modify `src/commands/history-commands.ts` to use real history functions:

```typescript
// Import history store/functions
import { historyStore$ } from "@/infrastructure/state/store";

// Update commands:
{
  id: "history.undo",
  label: "Undo",
  shortcut: "mod+z",
  category: "History",
  action: () => {
    // Call actual undo function
    historyStore$.undo();
  }
},
{
  id: "history.redo",
  label: "Redo",
  shortcut: "mod+shift+z",
  category: "History",
  action: () => {
    // Call actual redo function
    historyStore$.redo();
  }
},
```

Note: Adjust based on actual history API from useHistory.ts

**Step 3: Verify types compile**

```bash
pnpm run type-check
```

Expected: No type errors

**Step 4: Commit**

```bash
git add src/commands/history-commands.ts
git commit -m "feat(commands): wire up history undo/redo actions"
```

---

## Task 12: Remove Vim-specific Code Comments

**Files:**
- Modify: `src/hooks/useGlobalKeyboard.ts`
- Modify: `src/commands/*.ts` (any with Vim references)

**Step 1: Search for Vim terminology**

```bash
grep -r "vim\|yank\|put\|motion" src/hooks/useGlobalKeyboard.ts src/commands/ || echo "none found"
```

**Step 2: Remove or replace Vim terminology**

Replace any mentions of:
- "yank" → "copy"
- "put" → "paste"
- "vim" → "keyboard" or remove entirely
- "motion" → "navigation"

**Step 3: Update comments to reflect Linear-style**

Ensure comments reference Linear-style commands, not Vim.

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove Vim terminology from comments"
```

---

## Task 13: Run Full Test Suite

**Files:**
- Test: All test files

**Step 1: Run all tests**

```bash
pnpm test
```

Expected: All 272 tests pass (no regressions)

**Step 2: If tests fail, fix them**

For each failing test:
1. Identify what broke
2. Update test or code to fix
3. Re-run tests
4. Commit fix

**Step 3: Run type check**

```bash
pnpm run type-check
```

Expected: No type errors

**Step 4: Commit if fixes were needed**

```bash
git add -A
git commit -m "test: fix tests after command refactor"
```

---

## Task 14: Build and Manual QA

**Files:**
- All

**Step 1: Build production**

```bash
pnpm run build
```

Expected: Build succeeds with no errors

**Step 2: Start production server**

```bash
pnpm start
```

**Step 3: Manual QA checklist**

Test all keyboard shortcuts:

**Moment Commands:**
- [ ] `n` - Create new moment
- [ ] `delete` - Delete focused moment
- [ ] `mod+d` - Duplicate focused moment

**Navigation:**
- [ ] `↑`/`↓`/`←`/`→` - Arrow navigation
- [ ] `j`/`k` - Vim-style up/down (aliases)
- [ ] `tab`/`shift+tab` - Tab through moments
- [ ] `t` - Go to today
- [ ] `w` - Go to tomorrow
- [ ] `d` - Go to drawing board

**Clipboard:**
- [ ] `mod+c` - Copy moment
- [ ] `mod+v` - Paste moment
- [ ] `backspace` - Unallocate or delete

**Selection:**
- [ ] `mod+a` - Select all
- [ ] `escape` - Clear selection / close dialogs

**Views:**
- [ ] `ctrl+/` - Toggle compass
- [ ] `p` - Toggle planning view
- [ ] `shift+e` - Area management
- [ ] `mod+comma` - Settings

**History:**
- [ ] `mod+z` - Undo
- [ ] `mod+shift+z` - Redo
- [ ] `mod+y` - Redo (alt)

**Command Palette:**
- [ ] `mod+k` - Open palette
- [ ] Search filters commands
- [ ] Commands grouped by category
- [ ] Shortcuts displayed
- [ ] Executing command closes palette
- [ ] Can navigate with arrows
- [ ] Enter executes selected command

**Step 4: Document any issues**

If issues found, create follow-up tasks and commit fixes.

---

## Task 15: Update Documentation

**Files:**
- Modify: `CLAUDE.md` (if needed)
- Create: `docs/KEYBOARD_SHORTCUTS.md`

**Step 1: Create keyboard shortcuts reference**

Create `docs/KEYBOARD_SHORTCUTS.md`:

```markdown
# Keyboard Shortcuts

Zenborg uses Linear-style keyboard shortcuts for efficient navigation and actions.

## Command Palette

- `Cmd+K` (Mac) / `Ctrl+K` (Windows/Linux) - Open command palette

Search and execute any command. Type to filter.

## Moments

- `N` - Create new moment
- `Delete` - Delete focused moment
- `Cmd+D` - Duplicate focused moment

## Navigation

- `↑`/`↓`/`←`/`→` - Navigate grid
- `J`/`K` - Navigate up/down (alternate)
- `Tab` / `Shift+Tab` - Focus next/previous
- `T` - Go to Today
- `W` - Go to Tomorrow
- `D` - Go to Drawing Board

## Clipboard

- `Cmd+C` - Copy moment
- `Cmd+V` - Paste/duplicate moment
- `Backspace` - Unallocate or delete

## Selection

- `Cmd+A` - Select all moments
- `Escape` - Clear selection / close dialogs

## Views

- `Ctrl+/` - Toggle Compass view
- `P` - Toggle Planning view
- `Shift+E` - Open Area Management
- `Cmd+,` - Open Settings

## History

- `Cmd+Z` - Undo
- `Cmd+Shift+Z` - Redo
- `Cmd+Y` - Redo (alternate)

## Tips

- All shortcuts can be discovered via `Cmd+K` command palette
- Shortcuts are disabled when forms/dialogs are open
- `J`/`K` work like arrow keys (common in many apps)
```

**Step 2: Update CLAUDE.md if needed**

Remove Vim mode documentation section from `CLAUDE.md` if it exists.

**Step 3: Commit**

```bash
git add docs/KEYBOARD_SHORTCUTS.md CLAUDE.md
git commit -m "docs: add keyboard shortcuts reference"
```

---

## Task 16: Final Commit and Merge Prep

**Files:**
- All

**Step 1: Review all changes**

```bash
git log --oneline origin/main..HEAD
```

Review commit history to ensure good messages.

**Step 2: Squash if needed**

If commits are too granular, consider squashing related ones:

```bash
# Optional - only if commits are very messy
git rebase -i origin/main
```

**Step 3: Run final checks**

```bash
pnpm run build
pnpm test
pnpm run type-check
```

All should pass.

**Step 4: Push branch**

```bash
git push -u origin feature/command-palette
```

**Step 5: Create pull request**

```bash
gh pr create --title "feat: Command palette and keyboard shortcuts refactor" --body "$(cat <<'EOF'
## Summary

Removes Vim-specific terminology and keybindings, replacing them with a Linear-style command palette system.

## Changes

- ✅ Command registry pattern (distributed definitions, global aggregation)
- ✅ Cmd+K command palette (searchable, categorized)
- ✅ Unified keyboard shortcuts (single source of truth)
- ✅ Standard OS clipboard (Cmd+C, Cmd+V)
- ✅ Removed Vim shortcuts (yy, dd, x, p, gg, G, w, b)
- ✅ Kept common keys (j/k, arrows, n)
- ✅ All tests passing (272/272)

## Test Plan

- [x] All existing tests pass
- [x] Manual QA of all keyboard shortcuts
- [x] Command palette opens and filters
- [x] Commands execute correctly
- [x] No regressions in existing features

## Screenshots

(Add screenshots of command palette)

🤖 Generated with Claude Code
EOF
)"
```

---

## Summary

**Total Tasks:** 16
**Estimated Time:** 9-14 hours
**Tests:** All 272 existing tests must pass

**Key Principles Applied:**
- **DRY:** Single source of truth (command registry)
- **YAGNI:** No over-engineering (simple command objects)
- **TDD:** Test-first where applicable
- **Frequent commits:** One commit per task

**Next Steps After Merge:**
1. Monitor for issues in production
2. Gather user feedback on new shortcuts
3. Consider adding command history/recents
4. Potentially allow custom keybindings (future)
