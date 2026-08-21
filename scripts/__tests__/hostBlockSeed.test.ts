import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The composition edge, tested where it lives.
 *
 * `hostBlock.ts` carries no host and can no longer be asked what is on the
 * list, which is the whole point of moving it. The reasoning that used to sit
 * in that file's doc comment was worth keeping though, so it moved with the
 * list: the "//" note on each entry is the record of why that host, and this
 * pins the decisions the notes describe.
 *
 * These assertions are about one person's list. Nothing here ships to a peer;
 * the guarantee that it does not is in `src/__tests__/blankByDefault.test.ts`.
 */

const seed = JSON.parse(
  readFileSync(
    path.join(import.meta.dirname, "..", "host-block-seed.hosts.json"),
    "utf8",
  ),
) as {
  hosts: { host: string; "//": string }[];
  consideredAndLeftOff: { host: string; "//": string }[];
};

const walled = seed.hosts.map((h) => h.host);
const leftOff = seed.consideredAndLeftOff.map((h) => h.host);

describe("the seed list", () => {
  it("walls YouTube and both chess sites, and nothing else", () => {
    expect(walled).toEqual(["youtube.com", "chess.com", "lichess.org"]);
  });

  it("covers lichess, which the chess.com entry never reached", () => {
    // The one real hole in the old list: a registrably different site, serving
    // the same reach, matched by nothing.
    expect(walled).toContain("lichess.org");
  });

  it("names no subdomain the match pattern already covers", () => {
    // `*://*.youtube.com/*` matches `m.youtube.com`, so naming it is a second
    // name for a route already closed.
    expect(walled).not.toContain("m.youtube.com");
    expect(walled).not.toContain("www.youtube.com");
    expect(leftOff).toContain("m.youtube.com");
  });

  it("names no pure redirector, which closes no route of its own", () => {
    // Every path through `youtu.be` terminates at a `youtube.com` request, and
    // `lnkd.in` the same for LinkedIn. Adding them moves where the refusal
    // appears; it does not add a refusal.
    expect(walled).not.toContain("youtu.be");
    expect(walled).not.toContain("lnkd.in");
    expect(leftOff).toEqual(expect.arrayContaining(["youtu.be", "lnkd.in"]));
  });

  it("no longer walls LinkedIn, which belongs on a gate", () => {
    // keel/docs/pain/2026-08-19-linkedin-reloads-the-feed-because-it-is-on-the-
    // wrong-primiti.md: an access-block on a running SPA is a reload loop, not
    // a wall.
    expect(walled).not.toContain("linkedin.com");
    expect(leftOff).toContain("linkedin.com");
  });

  it("says why for every host, walled or not", () => {
    for (const entry of [...seed.hosts, ...seed.consideredAndLeftOff]) {
      expect(entry["//"].trim().length).toBeGreaterThan(0);
    }
  });

  it("holds no host twice, on either side of the decision", () => {
    const all = [...walled, ...leftOff];
    expect(new Set(all).size).toBe(all.length);
  });
});
