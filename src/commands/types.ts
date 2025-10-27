export interface Command {
  id: string;              // "moment.create", "nav.today"
  label: string;           // "Create Moment"
  shortcut: string;        // "n", "mod+k", "delete"
  category: string;        // "Moments", "Navigation", "Views"
  keywords?: string[];     // ["new", "add"]
  icon?: React.ReactNode;  // Optional icon
  action: () => void;      // Execute the command
}
