# Session reports

Every Claude Code session ends by writing one report here. Thach pastes it
into the advisor chat (claude.ai), which checks it against the repo, decides
what to do about each problem, and hands back the prompt for the next
session. The report is the only thing that travels between the two, so it
must be complete on its own: the advisor does not see the session's chat.

**File name:** `docs/reports/YYYY-MM-DD-<scope>.md`, for example
`2026-10-05-S1.md`. A second session on the same scope and day adds `-2`.
The report is committed together with the scope's changes.

**Rules**
- Real output only. Paste command output as it came out; never summarise a
  failure as a pass. Trim long passing output to its summary lines, never
  trim a failure.
- Say what was NOT done as plainly as what was done.
- Every decision the agent made alone is listed with its reason, so the
  advisor can overturn it.
- Facts the agent could not verify (anything on the device) are marked
  unverified, never "works".
- English, like every file in this repo.

## Template

```markdown
# Session report: <scope id> - <scope title>

Date: <YYYY-MM-DD>   Branch: <branch>   Base commit: <short hash before the session>
Result: DONE | PARTIAL | STOPPED (<one-line reason>)

## 1. Goal
<the scope in one or two sentences, as given in the prompt>

## 2. What was done
| Item | Status | Files | Tests |
|---|---|---|---|
| <finding id or task> | done / partial / not started | <paths> | <test names> |

## 3. Tests written first (bug fixes)
For each bug: the test name, the failing output before the fix (trimmed to the
assertion), and the passing output after.

## 4. Decisions made alone
| Decision | Why | Where | Alternative rejected |
|---|---|---|---|

## 5. Problems and open questions
Errors hit and how they were solved; anything that blocked the session;
questions only Thach can answer (rule, product, design). Write "None" if none.

## 6. Floor checks (CONSTRAINTS.md), real output
- F1/F3 `npx jest`: <summary line: suites, tests, passed/failed>
- F4 `npx tsc --noEmit`: <output or "no output (0 errors)">
- F5 `npx eslint src/ --max-warnings=0`: <output>
- F6/F7 debug and ts-ignore grep: <output>
- F2, F8, F9: <pass / fail with one line each>

## 7. Warn checks
W1-W3: <one line each>

## 8. Device check list for Thach (unverified until he confirms)
1. <step> -> expected: <what he should see>

## 9. Files changed
<output of `git status --short`>

## 10. Proposed git commands (not run)
git add <paths>
git commit -m "<type>: <message>"

## 11. Next step
<the next scope id, and anything it must know from this session>
```
