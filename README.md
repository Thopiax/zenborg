# Zenborg - Intention Compass

> *An attention orchestration system for budgeting moments toward personal flourishing.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## What is Zenborg?

Zenborg is a **local-first web application** for conscious attention allocation. Not a task manager. Not a habit tracker. Not a calendar.

**The Question**: *"Where will I place my consciousness today?"*

### Core Philosophy

- **Orchestration, not elimination**: Accept distractions, budget for them
- **Consciousness as currency**: Allocate attention, not time
- **Presence over outcomes**: No "done" buttons, no completion tracking
- **Keyboard-first efficiency**: Modal keyboard interactions for power users

## Features

- **3-word moments** - Name your intentions clearly (e.g., "Morning Run", "Deep Work")
- **Phase-based days** - Morning, Afternoon, Evening, Night (customizable)
- **Modal keyboard system** - Navigate with keyboard shortcuts, allocate with commands
- **Local-first** - All data stored in IndexedDB, works offline
- **Minimal design** - Monochromatic UI, flat hierarchy, no modals
- **PWA ready** - Install as a standalone app

## Quick Start

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Open http://localhost:3000
```

## Basic Usage

```bash
i                    # Enter Insert mode - create a moment
Morning Run          # Type 1-3 words
Tab Tab              # Cycle through areas (Wellness, Craft, etc.)
Enter                # Save

j j                  # Navigate down with keyboard
t 1                  # Quick allocate: Today, Morning
Enter                # Confirm
```

**Learn more**: See [CLAUDE.md](./CLAUDE.md) for complete documentation.

## Tech Stack

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS 4** - Utility-first styling
- **Legend State** - Reactive local-first state management
- **Vitest + Playwright** - Unit and E2E testing

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## Philosophy

This project evolved from a physical whiteboard system using magnets. Key insights:

> "It is not about eliminating distractions from my life. Accept them, make some room for them to avoid them growing too much."

> "I'm not budgeting hours; I'm allocating attention. The difference changes everything."

> "The system measures through presence, not performance. Did I consciously allocate my attention today? That's the only metric that matters."

**Read more**: [CLAUDE.md - Project Philosophy](./CLAUDE.md#project-philosophy-from-attend-system)

## License

MIT License - See [LICENSE](./LICENSE) for details.

## Acknowledgments

Built with the philosophy that **structure should guide our organic growth** and that **technology should enhance rather than extract human attention**.

*"Where will I place my consciousness today?"*
