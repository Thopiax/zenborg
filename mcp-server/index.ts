#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

// ── Config ──────────────────────────────────────────────────────────────

const vaultPath = process.argv.find((_, i, a) => a[i - 1] === '--vault') ?? '';
if (!vaultPath || !fs.existsSync(vaultPath)) {
  process.stderr.write('Usage: zenborg-mcp --vault /path/to/vault\n');
  process.exit(1);
}

const AREAS_DIR = path.join(vaultPath, 'areas');
const MOMENTS_DIR = path.join(vaultPath, 'moments');
const SHIELDS_DIR = path.join(vaultPath, 'shields');

for (const dir of [AREAS_DIR, MOMENTS_DIR, SHIELDS_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

// ── Frontmatter helpers ─────────────────────────────────────────────────

interface Doc<T> {
  frontmatter: T;
  body: string;
}

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

function readDoc<T>(file: string): Doc<T> {
  const raw = fs.readFileSync(file, 'utf8');
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    return { frontmatter: {} as T, body: raw };
  }
  return {
    frontmatter: (parseYaml(match[1]) ?? {}) as T,
    body: match[2] ?? '',
  };
}

function writeDoc<T>(file: string, doc: Doc<T>): void {
  const yaml = stringifyYaml(doc.frontmatter).trimEnd();
  fs.writeFileSync(file, `---\n${yaml}\n---\n${doc.body}`, 'utf8');
}

function listKeys(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.slice(0, -3));
}

// ── Domain schemas ──────────────────────────────────────────────────────

const AttitudeSchema = z.enum([
  'BEGINNING',
  'KEEPING',
  'BUILDING',
  'PUSHING',
  'BEING',
]);

interface AreaFrontmatter {
  key: string;
  name: string;
  attitude: z.infer<typeof AttitudeSchema>;
  created: string;
}

// ── Server ──────────────────────────────────────────────────────────────

const server = new McpServer(
  { name: 'zenborg-mcp', version: '0.1.0' },
  {
    instructions: `Zenborg is an intention-cultivation garden. The vault at \`${vaultPath}\` stores areas, moments, and shields as markdown files with YAML frontmatter.

## Taxonomy (garden metaphor, pragmatic types)

- **Area** — a domain of life you cultivate (user-facing label: "field")
- **Moment** — a planted instance of intention within an area
- **Shield** — a protective fence raised on a site (domain/app/category)
- **Attitude** — the skill-tree stage for an area: BEGINNING → KEEPING → BUILDING → PUSHING → BEING

## Vault layout

- \`areas/<key>.md\` — one file per area
- \`moments/<key>.md\` — one file per moment
- \`shields/<key>.md\` — one file per shield

## Typical workflows

1. \`list_areas\` to orient yourself before planting
2. \`plant_moment\` to add intention to an area
3. \`raise_shield\` to fence off a site that pulls you off-track
4. \`set_attitude\` when a practice graduates up the skill tree
`,
  },
);

// ── Tools ───────────────────────────────────────────────────────────────

// list_areas — working, proof that the scaffold runs
server.tool(
  'list_areas',
  'List all areas in the vault with their attitudes.',
  {},
  async () => {
    const keys = listKeys(AREAS_DIR);
    const areas = keys.map((key) => {
      const file = path.join(AREAS_DIR, `${key}.md`);
      const { frontmatter } = readDoc<AreaFrontmatter>(file);
      return frontmatter;
    });
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(areas, null, 2) }],
    };
  },
);

// plant_moment — stub
server.tool(
  'plant_moment',
  'Plant a moment of intention in an area.',
  {
    areaKey: z.string().describe('Area key (kebab-case)'),
    phase: z.string().optional(),
    note: z.string().optional(),
  },
  async () => ({
    content: [{ type: 'text' as const, text: 'plant_moment: not yet implemented' }],
  }),
);

// raise_shield — stub
server.tool(
  'raise_shield',
  'Raise a shield on a site (domain / app / category) to deflect attention.',
  {
    site: z.string().describe('Domain, app bundle id, or category'),
    trigger: z.string().optional().describe('What activates it'),
    intervention: z.string().optional().describe('What it does'),
  },
  async () => ({
    content: [{ type: 'text' as const, text: 'raise_shield: not yet implemented' }],
  }),
);

// list_shields — stub
server.tool(
  'list_shields',
  'List all shields raised in the vault.',
  {},
  async () => {
    const keys = listKeys(SHIELDS_DIR);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(keys, null, 2) }],
    };
  },
);

// set_attitude — stub
server.tool(
  'set_attitude',
  'Graduate an area up (or down) the skill tree.',
  {
    areaKey: z.string(),
    attitude: AttitudeSchema,
  },
  async () => ({
    content: [{ type: 'text' as const, text: 'set_attitude: not yet implemented' }],
  }),
);

// ── Boot ────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`zenborg-mcp connected (vault: ${vaultPath})\n`);
