# Command Palette & Keyboard Shortcuts Refactor

**Date:** 2025-10-26
**Status:** Design Complete
**Author:** Claude + Rafa

## Summary

We will remove Vim-specific terminology and keybindings from Zenborg and replace them with a Linear-style command palette system. The app will support both direct keyboard shortcuts and a searchable command palette (Cmd+K), with all commands defined in a single registry.

## Goals

1. Remove all Vim terminology (yank, put, motions like gg/G/w/b)
2. Build Cmd+K command palette for command discovery
3. Unify command definitions (single source of truth)
4. Support both direct shortcuts and palette access
5. Use standard OS clipboard shortcuts (Cmd+C, Cmd+V)

## Non-Goals

- No modal system (Normal/Insert/Command modes)
- No command-line interface at bottom of screen
- No extensive keyboard customization (shortcuts are fixed)

## Architecture

### Command Registry Pattern

Commands are defined as plain TypeScript objects near their related features, then aggregated into a global registry. Both the keyboard hook and command palette read from this registry.

```
src/commands/
├── index.ts                    # Exports allCommands array
├── types.ts                    # Command interface
├── moment-commands.ts          # CRUD operations
├── navigation-commands.ts      # Day/phase navigation
├── view-commands.ts           # Compass, areas, settings
└── clipboard-commands.ts       # Copy, paste, delete
```

### Command Definition

```typescript
interface Command {
  id: string;              // "moment.create", "nav.today"
  label: string;           // "Create Moment" (shown in palette)
  shortcut: string;        // "n", "mod+k", "delete"
  category: string;        // "Moments", "Navigation", "Views"
  keywords?: string[];     // ["new", "add"] (for search)
  icon?: React.ReactNode;  // Optional icon for palette
  action: () => void;      // Executes the command
}
```

Actions access Legend State observables directly:

```typescript
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
    action: () => {
      const focusedId = focusedMomentId$.get();
      if (focusedId) {
        moments$[focusedId].delete();
      }
    }
  }
];
```

### Keyboard Integration

`useGlobalKeyboard` reads the command registry and registers hotkeys:

```typescript
// src/hooks/useGlobalKeyboard.ts
import { useHotkeys } from 'react-hotkeys-hook';
import { allCommands } from '@/commands';

export function useGlobalKeyboard() {
  const globalShortcutsEnabled = useSelector(
    () => !uiState$.isFormOpen.get()
  );

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

### Command Palette UI

The palette uses shadcn/ui's Command component (built on cmdk):

```typescript
// src/components/CommandPalette.tsx
import { Command, CommandInput, CommandList, CommandGroup, CommandItem } from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { allCommands } from "@/commands";

export function CommandPalette({ open, onClose }: Props) {
  const [search, setSearch] = useState("");

  const filteredCommands = search
    ? allCommands.filter(cmd =>
        cmd.label.toLowerCase().includes(search.toLowerCase()) ||
        cmd.keywords?.some(k => k.toLowerCase().includes(search))
      )
    : allCommands;

  const grouped = groupBy(filteredCommands, 'category');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="p-0">
        <Command>
          <CommandInput placeholder="Search commands..." />
          <CommandList>
            {Object.entries(grouped).map(([category, commands]) => (
              <CommandGroup key={category} heading={category}>
                {commands.map(cmd => (
                  <CommandItem onSelect={() => {
                    cmd.action();
                    onClose();
                  }}>
                    {cmd.label}
                    <kbd>{cmd.shortcut}</kbd>
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

## Keyboard Shortcuts Changes

### Removed (Vim-specific)

| Old Shortcut | Action | Reason |
|--------------|--------|--------|
| `yy` | Yank (copy) | Vim-specific, replaced by Cmd+C |
| `p` / `shift+p` | Put (paste) | Vim-specific, replaced by Cmd+V |
| `dd` | Delete line | Vim-specific, replaced by Delete key |
| `x` | Quick delete | Vim-specific, redundant with Delete |
| `gg` | Go to first | Vim-specific motion |
| `G` | Go to last | Vim-specific motion |
| `w` | Next moment | Vim-specific word motion |
| `b` | Previous moment | Vim-specific word motion |

### Kept (Common beyond Vim)

| Shortcut | Action | Reason |
|----------|--------|--------|
| `j` | Down | Common (Gmail, Linear, etc.) |
| `k` | Up | Common (Gmail, Linear, etc.) |
| `↑↓←→` | Navigate | Standard arrows |
| `n` | New moment | Linear-style |

### Added

| Shortcut | Action | Pattern |
|----------|--------|---------|
| `mod+k` | Open command palette | Universal (Linear, Slack, VSCode) |
| `mod+c` | Copy moment | OS standard |
| `mod+v` | Paste/duplicate | OS standard |
| `delete` | Delete focused moment | Standard |
| `tab` | Focus next | Standard web navigation |
| `shift+tab` | Focus previous | Standard web navigation |

## Migration Plan

### Phase 1: Command Registry Setup

1. Create `src/commands/` directory structure
2. Define `Command` interface in `types.ts`
3. Extract existing actions from `useGlobalKeyboard.ts` into command objects
4. Organize commands by category (moments, navigation, views, clipboard)
5. Export `allCommands` array from `index.ts`

### Phase 2: Refactor useGlobalKeyboard

1. Remove inline `useHotkeys()` calls
2. Loop through `allCommands` and register each shortcut
3. Update shortcuts to match new keybindings
4. Remove Vim-specific shortcuts (yy, dd, x, p, gg, G, w, b)
5. Add standard shortcuts (mod+c, mod+v, tab, shift+tab)

### Phase 3: Build Command Palette

1. Create `CommandPalette.tsx` component
2. Implement search filtering by label and keywords
3. Group commands by category
4. Display shortcuts as kbd hints
5. Execute action and close on select
6. Add `mod+k` shortcut to open palette

### Phase 4: Clipboard Refactor

1. Remove custom yank buffer (or keep internal, change shortcuts)
2. Implement `mod+c` to copy focused moment
3. Implement `mod+v` to duplicate moment
4. Keep `delete` key for deletion
5. Update history tracking if needed

### Phase 5: Navigation Updates

1. Keep `j`/`k` as ↑↓ aliases
2. Remove `gg`, `G`, `w`, `b` shortcuts
3. Add `tab`/`shift+tab` for focus navigation
4. Ensure arrow keys still work
5. Update focus manager helpers

### Phase 6: Testing & Cleanup

1. Test all shortcuts work correctly
2. Test command palette search and execution
3. Remove Vim terminology from comments
4. Update variable names (e.g., `yankBuffer` → `clipboardBuffer`)
5. Verify no regressions in existing functionality

## Command Categories

### Moments (CRUD)

- Create Moment (`n`)
- Delete Moment (`delete`)
- Duplicate Moment (`mod+d` or `mod+v`)
- Edit Moment (when focused, context-dependent)

### Navigation

- Navigate Up/Down (`↑`/`↓`, `j`/`k`)
- Navigate Left/Right (`←`/`→`)
- Focus Next (`tab`)
- Focus Previous (`shift+tab`)
- Go to Today (`t`)
- Go to Tomorrow (`w`)
- Go to Drawing Board (`d`)

### Views

- Toggle Compass (`ctrl+/`)
- Toggle Planning View (`p`)
- Open Area Management (`shift+e`)
- Open Settings (TBD)

### Selection & Clipboard

- Select All (`mod+a`)
- Clear Selection (`escape`)
- Copy Moment (`mod+c`)
- Paste/Duplicate (`mod+v`)
- Delete (`delete`, `backspace` for unallocate)

### History

- Undo (`mod+z`)
- Redo (`mod+shift+z`, `mod+y`)

## Benefits

1. **Discovery**: Users can explore commands via Cmd+K palette
2. **Consistency**: Single source of truth for commands and shortcuts
3. **Familiarity**: OS-standard clipboard shortcuts, Linear-style palette
4. **Maintainability**: Commands defined near related code, easy to add/modify
5. **No Vim confusion**: Removes learning curve for non-Vim users

## Technical Considerations

### Legend State Integration

Commands access observables directly via `.get()` and `.set()`. No dependency injection or context objects needed. Actions are closures with direct access to the store.

```typescript
action: () => {
  const focusedId = focusedMomentId$.get();
  if (focusedId) {
    moments$[focusedId].delete();
  }
}
```

### React Hotkeys Hook

All shortcuts continue using `react-hotkeys-hook`. The registry simply provides structured data for loop-based registration instead of manual `useHotkeys()` calls.

### Command Palette Library

Uses existing `cmdk` library (via shadcn Command component). Same pattern as `AreaSelector`, consistent with codebase design.

### Conditional Enabling

Commands respect `globalShortcutsEnabled` flag (disabled when forms open). Palette can also check `isEnabled` per command if needed (future enhancement).

## Future Enhancements (Out of Scope)

- Command history (recent commands at top of palette)
- Custom keybindings (user-configurable shortcuts)
- Command chaining (sequential commands)
- Context-aware commands (different commands based on focus)
- Command aliases (multiple shortcuts for same command)

## Success Criteria

1. All Vim terminology removed from code and comments
2. Command palette opens with Cmd+K and executes commands
3. All shortcuts work identically to before (behavior preserved)
4. New clipboard shortcuts (Cmd+C/V) work correctly
5. Tab/Shift+Tab navigation works
6. No regressions in existing features
7. Code is cleaner (single source of truth for commands)

## Files Modified

- `src/hooks/useGlobalKeyboard.ts` - Refactored to read from registry
- `src/commands/**/*.ts` - New command definitions
- `src/components/CommandPalette.tsx` - New palette component
- `src/app/page.tsx` - Add Cmd+K handler and palette
- `package.json` - No new dependencies needed (cmdk already installed)

## Files Created

- `src/commands/types.ts`
- `src/commands/index.ts`
- `src/commands/moment-commands.ts`
- `src/commands/navigation-commands.ts`
- `src/commands/view-commands.ts`
- `src/commands/clipboard-commands.ts`
- `src/components/CommandPalette.tsx`

## Estimated Effort

- Command registry setup: 2-3 hours
- useGlobalKeyboard refactor: 1-2 hours
- Command palette UI: 2-3 hours
- Clipboard refactor: 1-2 hours
- Navigation updates: 1 hour
- Testing & cleanup: 2-3 hours

**Total: 9-14 hours** (1-2 days of focused work)

## Open Questions

None. Design is complete and ready for implementation.
