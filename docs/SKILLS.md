# Engineering Skills

A curated subset of Addy Osmani's
[agent-skills](https://github.com/addyosmani/agent-skills) (MIT License),
chosen for what this app actually needs: fixing bugs in money logic and
polishing a React Native UI. The same source and install method as
DataClarity, with fewer skills because the app is smaller.

## 1. Precedence

`CLAUDE.md` always wins over any skill. Known conflicts, resolved there:

- `incremental-implementation` tells the agent to commit after each slice. In
  this repo **the agent never commits or pushes**: it proposes the commands
  and Thach runs them (`CLAUDE.md` section 12).
- Autonomous multi-task runs conflict with **one scope per session**. The
  agent never starts the next scope without Thach's approval.

## 2. Installed skills

| Skill | Used here for | Reference files it needs |
|---|---|---|
| incremental-implementation | Thin verified slices inside one session scope | `definition-of-done.md` |
| test-driven-development | Failing test first for every bug fix (each audit finding becomes a regression test) | `testing-patterns.md` |
| debugging-and-error-recovery | Root-cause first: instrument, measure, then fix (the method that solved the invisible-button bug) | none |
| frontend-ui-engineering | Screens, animation, accessibility | `accessibility-checklist.md` |
| doubt-driven-development | Fresh-context adversarial review, **only** for money logic (payouts, Balance/In-Play, settlement, leaving the table) and rule changes. Not for UI work | `orchestration-patterns.md` |

## 3. Deliberately not installed

| Skill | Reason |
|---|---|
| spec-driven-development, planning-and-task-breakdown | Specs and the plan already exist and stay the single source of truth |
| api-and-interface-design, security-and-hardening | No backend, no network, no accounts (ADR-0001) |
| ci-cd-and-automation | CI is one small workflow, already written |
| context-engineering | `CLAUDE.md` + Current Status already cover it at this size |
| browser-testing-with-devtools | Native app tested in Expo Go, not a browser |
| performance-optimization | No measured performance problem |

## 4. Where things live

| Path | Content |
|---|---|
| `.claude/skills/<name>/` | Installed skills (copied, not symlinked: Windows) |
| `.claude/references/` | Checklists the skills link to as `../../references/<file>.md` |
| `.claude/THIRD_PARTY_LICENSES/agent-skills-LICENSE` | MIT license of the source |
| `skills-lock.json` | Pinned source and hash of every installed skill |

The per-skill install copies only `skills/<name>/`, not the repo-level
`references/` folder, so the reference files are copied by hand (session S0
in `SESSION_PROMPT.md`).

## 5. Maintenance

- List: `npx skills list`
- Update: `npx skills update -p` (read the diff before committing)
- Restore on a new machine: `npx skills experimental_install` (reads `skills-lock.json`)

Skills run with full agent permissions. Read a skill's `SKILL.md` before
installing or updating it.
