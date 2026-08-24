"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Check } from "lucide-react";
import type { WeekGridBlock } from "@/infrastructure/state/weekGridViewModel";

interface WeekMomentBlockProps {
  block: WeekGridBlock;
  areaColor: string;
  onAccept: (momentId: string) => void;
  onRename: (momentId: string, name: string) => void;
  onSelect?: (momentId: string) => void;
}

export function WeekMomentBlock({
  block,
  areaColor,
  onAccept,
  onRename,
  onSelect,
}: WeekMomentBlockProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(block.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commitRename = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== block.name) {
      onRename(block.momentId, trimmed);
    }
    setEditing(false);
  }, [editValue, block.name, block.momentId, onRename]);

  const cancelRename = useCallback(() => {
    setEditValue(block.name);
    setEditing(false);
  }, [block.name]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editing) {
      if (e.key === "Enter") {
        e.preventDefault();
        commitRename();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelRename();
      }
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (block.tentative) {
        onAccept(block.momentId);
      } else {
        setEditing(true);
      }
    }
  };

  const handleDoubleClick = () => {
    if (!block.tentative) {
      setEditing(true);
    }
  };

  const handleClick = () => {
    onSelect?.(block.momentId);
  };

  const style: React.CSSProperties = {
    gridRow: `${block.gridRowStart} / span ${block.gridRowSpan}`,
    ...(block.tentative
      ? {
          borderColor: areaColor,
          backgroundColor: "transparent",
          borderWidth: "1px",
          borderStyle: "solid",
        }
      : {
          backgroundColor: areaColor,
        }),
  };

  return (
    <li
      data-testid="week-block"
      className={`relative rounded-sm px-1.5 py-0.5 text-xs overflow-hidden cursor-pointer focus:outline-none focus:ring-1 focus:ring-stone-400 ${
        block.tentative
          ? "text-stone-500 dark:text-stone-400"
          : "text-white dark:text-stone-100"
      }`}
      style={style}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onDoubleClick={handleDoubleClick}
      onClick={handleClick}
    >
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          role="textbox"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent border-none outline-none text-xs p-0 m-0"
        />
      ) : (
        <span className="truncate block">{block.name}</span>
      )}
      {block.tentative && (
        <button
          type="button"
          aria-label="Accept moment"
          onClick={(e) => {
            e.stopPropagation();
            onAccept(block.momentId);
          }}
          className="absolute top-0.5 right-0.5 p-0.5 rounded-sm hover:bg-stone-200 dark:hover:bg-stone-700 opacity-0 group-hover:opacity-100 focus:opacity-100"
        >
          <Check className="w-3 h-3 text-stone-500 dark:text-stone-400" />
        </button>
      )}
    </li>
  );
}
