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
