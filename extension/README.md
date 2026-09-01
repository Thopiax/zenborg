# zenborg browser extension

**See where your attention goes — privately, on your own device.**

The web surface of zenborg. It observes, and when asked, it steers. Three things:

- **Activity writer** — coarse attention events on every site (tab switches, navigations, focus/idle spans), so you can see where your time goes and how your focus fragments.
- **Per-domain sensors** — on domains that appear in a fence or area map, type-based sensors record key-action completions (video started/finished, post seen, game finished). Counts and timings, never content. The observe tier is derived automatically — no manual watchlist.
- **Friction primitives** — fences (standing blocks), gates (dwell-triggered pauses), cooldowns (timed locks), and CSS transforms (element hiding). Declared by zenborg via MCP, enforced here.

## Build & load

```bash
pnpm install
pnpm build        # production build → dist/chrome-mv3/
```

Then in a Chromium browser:

1. `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select `dist/chrome-mv3/`

Dev: `pnpm dev` (hot-reload). Built with [WXT](https://wxt.dev).

## What it logs

- **Coarse events** (every site): `tab_activated`, `navigation_committed`, `focus_start` / `focus_end`, `idle_start` / `idle_end`, `tab_opened` / `tab_closed`.
- **Sensor completions** (observed domains): `video_started` / `video_ended`, `post_seen`, `product_seen`, `game_finished` — domain + capped scalars, gated behind the hostile-page boundary.

Events land in extension-local IndexedDB. The native messaging relay flushes them to `~/.kairos/keel/log/` as `.browser.jsonl` files, and the manage page can export on demand.

## Sovereignty & privacy

zenborg is built foundation-first: **sovereignty before everything**. The privacy
properties below aren't a policy you have to trust — they're structural, enforced
by what the extension is *capable* of.

**Local-First Ownership.** All state lives in `chrome.storage.local` and
extension-local IndexedDB. No account, no server, no sync. zenborg works fully
offline and nothing breaks if equanimitech disappears tomorrow.

**zenborg cannot read your browsing.** The manifest requests `declarativeNetRequest`
— *not* `declarativeNetRequestWithHostAccess`, *not* `webRequest`, and *no*
`host_permissions`. Blocking happens by static rule inside the browser engine;
the extension never sees request contents or page bodies. zenborg makes **no
outbound network calls** — events stay local until the relay.

**Modification Rights.** Open source, forkable. Your fences are yours to read
and reason about — a small, legible set, not a black box.

## Incognito

For fences to hold in incognito, flip the switch once:

1. `chrome://extensions` → zenborg → **Details**
2. Enable **Allow in Incognito**

zenborg runs `incognito: "spanning"` (one shared instance, shared local storage), so
fences carry over with no separate setup.

## License

MIT
