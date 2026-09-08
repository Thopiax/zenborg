# Journal

The gardener's written reflections — check-ins, gratitude, free writing.

## Sources

| Source | Type | Probe tools |
|--------|------|-------------|
| hey | CLI | `hey journal read --markdown --quiet` |
| penceive | CLI | write-only (no read command) |
| supernote | CLI | `supynote download Note --merge-by-date` (sync, not direct read) |

## Key fields

### HEY journal (`hey journal read`)

- Entry date — derived from output header
- Body text — markdown
- Word count — derived
- Tags/mood — not structured; may appear in body text

### Penceive

- Write-only oracle — no probe possible; captures exist but can't be read back through this oracle
- Entries land in the penceive journal, accessible through penceive's own interface

### Supernote (sync)

- Handwritten note pages synced to filesystem
- Date-merged into `$JOURNALS_DIR` — probe reads the output directory listing, not the sync itself

## Noise (skip on probe)

- HEY API internals (thread IDs, contact metadata)
- Supernote raw `.note` binary format — only the merged output matters

## Gotchas

- HEY journal `read` returns all entries (no date filter flag) — output may be large; truncate
- Penceive has no `read` — probe can only verify `check` passes
- Supernote sync requires LAN access to the device; will fail if device is off
- Route preference is `["hey", "penceive"]` — hey is primary for reads, penceive for append-only writes
