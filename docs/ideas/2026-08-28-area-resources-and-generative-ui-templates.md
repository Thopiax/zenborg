# Area resources and generative UI templates

**Captured:** 2026-08-28

## The seed

Areas (and their habits) should have a concept of **resources** — recipes for cooking, books for learning, playlists for music. And zenborg should provide **templates** that turn those resources into living, rendered surfaces via a single artifact link.

## Three ideas in one

### 1. Resources via the sidecar (no new collection)

Don't add `resources.json`. Resources fit the existing architecture:

- **Sidecar for content** — `~/.kairos/areas/<slug>/docs/recipes/`, `areas/<slug>/docs/books/`. Markdown files, zero code.
- **Relationship graph for structure** — when #68 ships, a resource becomes a node connected to areas/habits via typed edges. That's the queryable surface.
- **Integrations for ingest** — when #59 ships, adapters pull from external sources (Mela/Paprika for recipes, Literal/Goodreads for books) and drop files into the sidecar + create graph edges.

Open question: should resources carry **state** (reading/read/want-to-try/tried)? That's what sidecars can't do and relationship-graph edge labels might.

### 2. Area-scoped AI skills via AGENTS.md

The sidecar convention already has the slots:

```
~/.kairos/areas/<slug>/
├── AGENTS.md      # area-scoped agent context + template declaration
├── docs/          # content (recipes, books, etc.)
└── skills/        # area-scoped skills
```

One generic `area-assist` skill resolves which area the user means (fuzzy, same as tend), reads that area's `AGENTS.md` for instructions, reads `docs/` for content, and acts accordingly. "What should I cook tonight" → resolves to bon-vivant → reads recipes → suggests one.

Existing garden skills (tend, sunrise, sunset) should also read `AGENTS.md` when operating on an area.

### 3. Generative UI templates — the main idea

**Zenborg provides templates. Claude renders them over sidecar content.**

```
AGENTS.md          → declares the template ("recipe-book")
docs/recipes/*.md  → the content (structured markdown)
artifact URL       → one link, generative UI renders the template
```

Template = the shape. Sidecar = the data. Artifact = the surface.

- "Show me my recipes" → Claude reads `AGENTS.md`, sees `template: recipe-book`, reads `docs/recipes/`, renders a card-grid artifact.
- "Show me my reading list" → same flow, `template: reading-library`, list view with status.
- Same link every time, content always current.

The template doesn't need to be code shipped in the app — it's a generative UI instruction Claude follows when rendering. A new template is a new paragraph in a markdown file, not a new component. The data contract (what fields a recipe needs vs a book) lives in the template description inside `AGENTS.md`.

## Template examples

| Template | Area | Content shape | UI shape |
|---|---|---|---|
| recipe-book | bon vivant | title, ingredients, steps, source | card grid, filterable |
| reading-library | learning | title, author, status, notes | list with status chips |
| playlist | music | title, artist, mood, link | compact list |
| workout-log | fitness | exercise, sets, reps, date | table/timeline |

## Connects to

- #59 — integrations populate the sidecar
- #68 — relationship graph connects resources to habits/areas
- Garden skills plugin — area-assist as the command surface
- `docs/ideas/2026-07-02-goals-as-derived-state-skill-pyramid.md` — skills as the agent interface
