# Contributing to Zenborg

Thank you for your interest in contributing to Zenborg! This document provides guidelines for contributing to the project.

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm (recommended) or npm

### Setup

```bash
# Clone the repository
git clone https://github.com/Thopiax/zenborg.git
cd zenborg

# Install dependencies
pnpm install

# Run development server
pnpm dev
```

## Development Workflow

### Code Style

This project uses [Biome](https://biomejs.dev/) for linting and formatting:

```bash
# Check code
pnpm lint

# Format code
pnpm format
```

### Testing

```bash
# Run unit tests
pnpm test

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage

# E2E tests (requires Playwright installed)
npx playwright test
```

### Architecture

Zenborg follows **Hexagonal Architecture** (Ports & Adapters) with DDD principles:

- `src/domain/` - Pure TypeScript business logic (no frameworks)
- `src/infrastructure/` - Framework implementations (Legend State, IndexedDB)
- `src/application/` - Use cases and services
- `src/presentation/` - React components and UI

**Important**: Keep domain logic isolated from UI and infrastructure concerns.

See [CLAUDE.md](./CLAUDE.md) for detailed architecture documentation.

## Making Changes

### Branching

- Create a feature branch from `main`
- Use descriptive names: `feature/add-phase-config`, `fix/vim-navigation-bug`

### Commits

- Write clear, concise commit messages
- Use conventional commits format (optional but appreciated):
  - `feat:` - New features
  - `fix:` - Bug fixes
  - `docs:` - Documentation changes
  - `refactor:` - Code refactoring
  - `test:` - Test additions or fixes

### Pull Requests

1. Ensure tests pass locally
2. Update documentation if needed
3. Reference related issues
4. Provide clear description of changes

## Project Philosophy

Before contributing, please understand Zenborg's core principles:

- **No task completion tracking** - This is about presence, not performance
- **3-word constraint** - Moments are named in 1-3 words maximum
- **Vim-first interaction** - Keyboard efficiency is a priority
- **Local-first** - Data stays in the browser (IndexedDB)
- **Mindful tech** - Intentionally calm, not attention-extracting

See [CLAUDE.md - Project Philosophy](./CLAUDE.md#project-philosophy-from-attend-system) for more context.

## Need Help?

- Check [CLAUDE.md](./CLAUDE.md) for comprehensive documentation
- Open an issue for questions or discussions
- Join discussions in existing issues

## Code of Conduct

Please note that this project is released with a [Code of Conduct](./CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
