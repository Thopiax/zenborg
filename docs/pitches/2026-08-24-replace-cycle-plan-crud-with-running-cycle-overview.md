---
$signature:
  $type: tech.equanimi.secretariat.signature
  signer: did:key:z6MkpcX3mHt44yNEDPDWJic8ocJdagzERxx5u2Qh1dWcVRVN
  signerRole: agent
  docHash: sha256:e4540cd4f1b74cb630e42e7f1c0c61498846abcf5467411697c971905970da5a
  signedAt: 2026-08-24T20:29:29.858167Z
  signature: ed25519:bTfcJtQS93E3cRffkeGJ9IgmkAfSk4way4Ve9vI6DKI/aYjpZYixUY6rulzAFizdmZBMwGUCiuglhvQEHhcSBQ==
appetite: small
source: conversation 2026-08-24 — Rafa observed cycle plans are unused through the MCP
status: draft
tag: pitch
type: pitch
---

# Pitch — Replace cycle plan CRUD with running cycle overview

**Bet:** Replace the six cycle-plan CRUD tools with one read-only `get_running_cycle` tool that orients the agent in the current season, so the MCP surface matches how cycle planning actually works.

**Why it matters:** The cycle-planning skill rejected the budget model months ago ("Do not compute. Fit the days together."). Six tools still expose it, burning agent context on affordances nobody calls. One orientation tool gives agents what they actually need: where are we in the season, and which habits are getting water.

---

## Boundaries

**JBTD:** As an agent running a morning agenda or a weekly review, I want to see the running cycle's shape in one tool call so that I orient without stitching `list_cycles` + `list_cycle_plans` + `list_wilting_habits` together. Baseline today: agents call `list_cycles(filter: "active")` then `get_cycle_review(cycleId)`, which returns budget-vs-actual columns nobody reads.

**Out:**
- Removing `cyclePlans.json` from the vault or touching the Tauri app's CycleDeck. The data stays; the MCP read surface changes.
- Changing `get_cycle_review`. It serves the end-of-cycle reflection and is correct for that job.
- Touching `get_cycle_planning_proposals`. It serves the cycle-planning skill.

## Elements

- **`get_running_cycle` tool** (`mcp-server/index.ts`). Returns: cycle name, intention, `startDate`, `endDate`, days elapsed, days remaining (null if open-ended), per-habit health snapshot (habit name, area, attitude, health status, days since last moment), and a wilting list. Derives the active cycle from dates (same as `isCycleActive`). Returns a "no active cycle" message when none is running.

- **Remove `list_cycle_plans` and `get_cycle_plan`** from the MCP tool registry. The underlying `cyclePlans` collection is still read internally by `get_cycle_review`, `get_cycle_planning_proposals`, `computeHealth`, and `resolveRhythm`. Only the agent-facing CRUD surface disappears.

- **Demote `budget_habit_to_cycle`, `increment_habit_budget`, `decrement_habit_budget`, `remove_habit_from_deck`** from the tool registry. These write cycle plans that no skill calls. Keep the implementation functions for internal use by `allocate_from_plan` (which also stays, since the CycleDeck uses it).

- **Update `TOOLS.md`** to replace the "Cycles + plans" section with the new tool's contract.

## Risks

**Rabbit holes:**
- Over-designing the health snapshot. `computeHealth` and `daysSinceLast` already exist; call them, format, return. No new computation.
- Debating whether `allocate_from_plan` should also go. It should not: the CycleDeck allocates from plans, and removing it breaks the app.

**Off-sides:**
- Adding a "cycle dashboard" to the Tauri app. This pitch is MCP-only.
- Rethinking the cycle-plan data model itself. The model is fine; the agent surface is what drifted.

## Acceptance

1. `get_running_cycle` returns the active cycle with intention, elapsed/remaining days, and per-habit health when a cycle is running.
2. `get_running_cycle` returns a clear "no active cycle" when none is running.
3. `list_cycle_plans`, `get_cycle_plan`, `budget_habit_to_cycle`, `increment_habit_budget`, `decrement_habit_budget`, `remove_habit_from_deck` no longer appear in the MCP tool list.
4. `allocate_from_plan` still works (CycleDeck path).
5. `get_cycle_review` and `get_cycle_planning_proposals` still work unchanged.
6. `TOOLS.md` documents the new tool and removes the old ones.
7. `pnpm smoke` passes in `mcp-server/`.

---

_Drafted by Claude (scribe)._