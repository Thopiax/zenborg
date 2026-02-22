/**
 * PaneHeader - Standardized header for resizable panes
 *
 * Provides consistent title + subtitle styling across the /plant page panels.
 * Uses pt-16 to clear the top navigation bar.
 */
interface PaneHeaderProps {
  title: string;
  subtitle: string;
}

export function PaneHeader({ title, subtitle }: PaneHeaderProps) {
  return (
    <div className="px-6 pt-16 pb-4">
      <h2 className="text-xl font-mono font-bold text-stone-900 dark:text-stone-100 mb-1">
        {title}
      </h2>
      <p className="text-sm text-stone-500 dark:text-stone-400 font-mono">
        {subtitle}
      </p>
    </div>
  );
}
